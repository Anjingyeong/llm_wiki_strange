import { tokenize } from './embedding.mjs';
import { searchRelevantChunks } from './search.mjs';
import { buildContext, buildContextChunks } from './context.mjs';
import { buildLocalTemplateAnswer } from './templates.mjs';

const DEFAULT_LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

function makeSource(chunk) {
  return {
    documentId: chunk.documentId,
    section: chunk.sectionTitle ?? chunk.section,
    sectionTitle: chunk.sectionTitle ?? chunk.section,
    slug: chunk.slug,
    title: chunk.title,
    category: chunk.category,
    updatedAt: chunk.updatedAt,
    sourcePath: chunk.sourcePath,
    score: chunk.score,
    matchedBy: chunk.matchedBy ?? [],
    reason: chunk.reason ?? '',
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

async function callExternalLlm(question, chunks, env, answerMode) {
  const apiKey = env.RAG_LLM_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const endpoint = env.RAG_LLM_ENDPOINT ?? DEFAULT_LLM_ENDPOINT;
  const model = env.RAG_LLM_MODEL ?? DEFAULT_LLM_MODEL;

  let promptConstraint = '';
  if (answerMode === 'flow_mode') {
    promptConstraint = `
Structure your response EXACTLY in this format:

### 핵심 요약
[Provide a 1-2 sentence high-level summary of the overall flow/architecture based ONLY on the context]

### 단계별 흐름 표
[Create a clean Markdown table with columns: '단계', '역할', '출력(데이터 포맷)', '비고' representing the pipeline layers from the context]

### 포트폴리오 활용 문장
[List 1-2 bulleted items showing how to write this flow in a resume/portfolio (strictly using exact action terms: '구현', '설계', '검토')]

### 참고 문서
[List referenced documents with titles and slugs/IDs from the context]
`;
  } else if (answerMode === 'evidence_template') {
    promptConstraint = `
Structure your response EXACTLY in this format:

### 핵심 요약
[Provide a 1-2 sentence high-level summary of the verification or evidence based ONLY on the context]

### 검증 근거 표
[Create a clean Markdown table with columns: '점검 항목', '검증 방법 및 명령', '결과', '비고'. Populate it only with existing validation details or PASS/FAIL logs from the context. Do not invent any new results]

### 포트폴리오 활용 의미
[List 1-2 bulleted items explaining how this serves as structured verification evidence (strictly using exact terms: '구현', '설계', '검토')]

### 참고 문서
[List referenced documents with titles and slugs/IDs from the context]
`;
  } else if (answerMode === 'portfolio_mode') {
    promptConstraint = `
Structure your response EXACTLY in this format:

### 핵심 기여
[Provide a 1-2 sentence description of the core engineering contribution based ONLY on the context]

### 근거
[Briefly detail what verification or documents support this contribution from the context]

### 이력서 bullet
[Write 1-2 professional resume bullet points. Strictly distinguish '구현', '설계', '검토', '실험 계획' as appropriate. VLM, Synthetic Data, and Self-Improving AI must be clearly marked as '확장 설계/실험 계획' rather than implemented]

### 면접 답변 초안
[Provide a short STAR method interview QA script matching the query based on the context]

### 참고 문서
[List referenced documents with titles and slugs/IDs from the context]
`;
  } else if (answerMode === 'troubleshooting_mode') {
    promptConstraint = `
Structure your response EXACTLY in this format:

### 문제 현상
[Describe the bug or issue observed from the context]

### 원인
[Explain the technical root cause of the error or failure from the context]

### 해결 과정
[Detail the debugging steps and how it was fixed or corrected based ONLY on the context]

### 검증 결과
[Show the resulting logs or checks verifying the fix from the context]

### 재발 방지
[Explain architectural rules or follow-ups to prevent recurrence from the context]
`;
  } else {
    promptConstraint = `
Answer the question strictly based on the context. Ensure any Markdown tables contained in the context are kept in clean tabular Markdown layout.
`;
  }

  const systemPrompt = `You are a professional Portfolio Assistant.
You answer questions only using the provided wiki context.
If the context is insufficient, you must answer exactly "관련 문서가 부족함. 문서에서 확인되지 않음." (do not try to make up facts).
Never invent values, metrics, or experiments that are not in the context.
Strictly avoid hallucination.

${promptConstraint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
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
  
  if (q.includes('흐름') || q.includes('동작') || q.includes('구조') || q.includes('아키텍처') || q.includes('pipeline') || q.includes('파이프라인')) {
    return 'flow_mode';
  }
  
  if (q.includes('검증') || q.includes('결과') || q.includes('테스트') || q.includes('pass') || q.includes('fail') || q.includes('합격') || q.includes('실패') || q.includes('근거')) {
    return 'evidence_template';
  }
  
  if (q.includes('포트폴리오') || q.includes('이력서') || q.includes('면접') || q.includes('자소서') || q.includes('요약')) {
    return 'portfolio_mode';
  }
  
  if (q.includes('오류') || q.includes('문제') || q.includes('해결') || q.includes('안 됨') || q.includes('원인') || q.includes('버그') || q.includes('에러')) {
    return 'troubleshooting_mode';
  }
  
  return 'general';
}

function expandQuery(question) {
  const q = question.toLowerCase();
  let expanded = question;
  
  if (q.includes('동작') || q.includes('흐름') || q.includes('구조') || q.includes('아키텍처') || q.includes('architecture') || q.includes('pipeline') || q.includes('파이프라인')) {
    expanded += " architecture pipeline RTSP YOLO Pose ByteTrack LSTM MQTT Spring React WebRTC HLS 동작 흐름 구조 아키텍처 파이프라인 Overview";
  }
  
  if (q.includes('검증') || q.includes('테스트') || q.includes('결과') || q.includes('근거') || q.includes('pass') || q.includes('fail') || q.includes('합격') || q.includes('실패')) {
    expanded += " 검증 결과 테스트 PASS FAIL 점검 항목 검증 방법 명령 결과 비고 py_compile";
  }

  if (q.includes('포트폴리오') || q.includes('이력서') || q.includes('면접') || q.includes('자소서') || q.includes('기여')) {
    expanded += " 포트폴리오 이력서 면접 답변 핵심 기여 근거 bullet 초안 질문 답변";
  }
  
  return expanded;
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

  const expandedQuery = expandQuery(normalizedQuestion);
  const chunks = searchRelevantChunks(index, expandedQuery, options);
  
  if (chunks.length === 0) {
    return {
      status: 'insufficient_context',
      answer: '관련 문서가 부족함. 문서에서 확인되지 않음.',
      sources: [],
    };
  }

  const answerMode = detectAnswerMode(normalizedQuestion);

  const externalAnswer =
    options.allowExternalLlm === false 
      ? null 
      : await callExternalLlm(normalizedQuestion, chunks, options.env ?? process.env, answerMode);

  let finalAnswer = externalAnswer ?? buildLocalTemplateAnswer(chunks, answerMode);

  finalAnswer = finalAnswer
    .replace(/\[JSON Payload Keys:[^\]]*\]/gi, '')
    .replace(/\[Commands:[^\]]*\]/gi, '')
    .replace(/\[Code Keywords:[^\]]*\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const sources = chunks.map(makeSource);
  const contextChunks = buildContextChunks(chunks);
  const debugInfo = {
    expandedQuery,
    answerMode,
    search: chunks.debug ?? null,
    finalContextChunks: contextChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.title,
      category: chunk.category,
      sectionTitle: chunk.sectionTitle,
      updatedAt: chunk.updatedAt,
      sourcePath: chunk.sourcePath,
      matchedBy: chunk.matchedBy,
      score: chunk.score,
    })),
    chunks: chunks.map(c => ({
      id: c.id,
      score: c.score,
      title: c.title,
      category: c.category,
      section: c.sectionTitle ?? c.section,
      updatedAt: c.updatedAt,
      sourcePath: c.sourcePath,
      matchedBy: c.matchedBy ?? [],
      text: c.text
    }))
  };

  return {
    status: 'answered',
    answer: finalAnswer,
    sources,
    contextChunks,
    answerMode,
    debugInfo
  };
}
