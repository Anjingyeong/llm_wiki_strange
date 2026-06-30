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
  const evidence = [];

  for (const chunk of chunks) {
    const hasTable = chunk.text.includes('|') && chunk.text.includes('\n');
    if (hasTable) {
      evidence.push(`\n${chunk.text}\n`);
    } else {
      const selected = selectSentences(question, [chunk]);
      if (selected.length) {
        evidence.push(selected.join(' '));
      }
    }
  }

  if (evidence.length === 0 && chunks.length > 0) {
    evidence.push(chunks[0].text.slice(0, 500).trim());
  }

  return evidence.length === 0
    ? '관련 문서가 부족함. 문서에서 확인되지 않음.'
    : `검색된 문서 기반 답변입니다.\n\n${evidence.join('\n\n')}`;
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

  const systemPrompt = `You answer questions only using the provided wiki context.
If the context is insufficient, you must answer exactly "관련 문서가 부족함. 문서에서 확인되지 않음." (do not try to make up facts).

For questions asking about verification results, test commands, PASS/FAIL logs, or portfolio evidence, structure your response using this EXACT format:

### 핵심 요약
[Provide a 1-2 sentence high-level summary of the verification or evidence]

### 검증 근거 표
[If the context contains a table or verification log with PASS/FAIL, commands, results, or notes, reproduce it as a clean Markdown table. If there are commands or results in the text that can be formatted as a table, convert them into a Markdown table with columns: '점검 항목', '검증 방법 및 명령', '결과', '비고']

### 포트폴리오 활용 의미
[Provide a bulleted list of 1-2 sentences explaining how this verification serves as portfolio evidence (e.g., distinguishing between implementation, design, and plan)]

### 참고 문서
[List referenced documents with their titles and IDs as links if possible or plain text, e.g., - [Document Title](slug)]

For all other general questions, provide a grounded answer based strictly on the context, keeping any markdown tables intact. Do not invent any values that are not in the context.`;

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
            content: systemPrompt,
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

function detectAnswerMode(question) {
  const q = question.toLowerCase();
  const evidenceKeywords = ['검증', '결과', 'pass', 'fail', '포트폴리오', '근거', '이력서', 'bullet', 'qa', '질문', '답변', '정리'];
  const hasKeyword = evidenceKeywords.some(kw => q.includes(kw));
  return hasKeyword ? 'evidence_template' : 'general';
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
    answerMode: detectAnswerMode(normalizedQuestion),
  };
}
