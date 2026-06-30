import { tokenize } from './embedding.mjs';
import { searchRelevantChunks } from './search.mjs';

const MAX_CONTEXT_CHUNKS = 4;
const MAX_CONTEXT_CHARS = 3600;
const DEFAULT_LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

function makeSource(chunk) {
  return {
    documentId: chunk.documentId,
    section: chunk.section,
    slug: chunk.slug,
    title: chunk.title,
    score: chunk.score,
    sourceLink: `#/${chunk.slug}`,
  };
}

function selectSentences(question, chunks) {
  const queryTokens = new Set(tokenize(question));
  const sentences = [];
  for (const chunk of chunks) {
    const chunkSentences = chunk.text.split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/u);
    for (const sentence of chunkSentences) {
      const normalized = sentence.trim();
      if (!normalized) {
        continue;
      }
      const hasOverlap = tokenize(normalized).some((token) => queryTokens.has(token));
      if (hasOverlap) {
        sentences.push(normalized);
        const nextSentence = chunkSentences[chunkSentences.indexOf(sentence) + 1]?.trim();
        if (nextSentence) {
          sentences.push(nextSentence);
        }
      }
      if (sentences.length >= 5) {
        return sentences;
      }
    }
  }
  return sentences;
}

function buildExtractiveAnswer(question, chunks) {
  const selected = selectSentences(question, chunks);
  const fallback = chunks[0]?.text.slice(0, 420).trim();
  const evidence = selected.length ? selected : fallback ? [fallback] : [];
  return evidence.length === 0
    ? '관련 문서가 부족함. 문서에서 확인되지 않음.'
    : `검색된 문서 기반 답변입니다. ${evidence.join(' ')}`;
}

function buildContext(chunks) {
  let used = 0;
  const context = [];
  for (const chunk of chunks.slice(0, MAX_CONTEXT_CHUNKS)) {
    const next = `[${chunk.title} / ${chunk.section} / ${chunk.documentId}]\n${chunk.text}`;
    if (used + next.length > MAX_CONTEXT_CHARS) {
      break;
    }
    context.push(next);
    used += next.length;
  }
  return context.join('\n\n---\n\n');
}

async function callExternalLlm(question, chunks, env) {
  const apiKey = env.RAG_LLM_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(env.RAG_LLM_ENDPOINT ?? DEFAULT_LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.RAG_LLM_MODEL ?? DEFAULT_LLM_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You answer only from the provided wiki context. If the context is insufficient, answer exactly that the documents do not confirm it. Cite document titles and ids.',
          },
          {
            role: 'user',
            content: `질문: ${question}\n\n검색된 문서 context:\n${buildContext(chunks)}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function answerQuestionFromIndex(index, question, options = {}) {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    return {
      status: 'insufficient_context',
      answer: '관련 문서가 부족함. 질문을 입력해 주세요.',
      sources: [],
    };
  }

  const chunks = searchRelevantChunks(index, normalizedQuestion, options);
  if (chunks.length === 0) {
    return {
      status: 'insufficient_context',
      answer: '관련 문서가 부족함. 문서에서 확인되지 않음.',
      sources: [],
    };
  }

  const externalAnswer =
    options.allowExternalLlm === false ? null : await callExternalLlm(normalizedQuestion, chunks, options.env ?? process.env);

  return {
    status: 'answered',
    answer: externalAnswer ?? buildExtractiveAnswer(normalizedQuestion, chunks),
    sources: chunks.map(makeSource),
  };
}
