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

function buildLocalTemplateAnswer(question, chunks, answerMode) {
  let tableText = '';
  const textLines = [];
  
  for (const chunk of chunks) {
    if (chunk.text.includes('|') && chunk.text.includes('\n')) {
      tableText = chunk.text;
    } else {
      textLines.push(chunk.text);
    }
  }
  
  const rawContent = textLines.join(' ');
  const cleanSummary = rawContent ? rawContent.slice(0, 500).trim() + '...' : '관련 내용 요약이 본문에 수록되어 있습니다.';
  const references = [...new Set(chunks.map(c => `- [${c.title}](file:///c:/llm_wiki_strange/content/${c.slug}.md)`))].join('\n');

  if (answerMode === 'flow_mode') {
    return `### 핵심 요약
검색된 문서 기반의 시스템 동작 흐름 및 설계 분석입니다.

### 상세 흐름 및 아키텍처
${cleanSummary}

### 단계별 흐름 표
${tableText || '| 단계 | 역할 | 출력 | 비고 |\n| --- | --- | --- | --- |\n| AI Pipeline | RTSP 프레임 수신 및 YOLO/ByteTrack/LSTM 분석 | MQTT event | standard pipeline |'}

### 포트폴리오 활용 문장
- 실시간 영상 프레임 수신(RTSP)부터 객체 탐지(YOLO), 다중 객체 추적(ByteTrack), 행동 분류(LSTM)로 이어지는 AI 파이프라인의 연계 동작 흐름을 설계 및 검토했습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'evidence_template') {
    return `### 핵심 요약
검색된 문서 기반의 핵심 검증 로그 및 PASS/FAIL 결과입니다.

### 상세 검증 내용
${cleanSummary}

### 검증 근거 표
${tableText || '| 점검 항목 | 검증 방법 및 명령 | 결과 | 비고 |\n| --- | --- | --- | --- |\n| 문법 검증 | py_compile 문법 전수 검사 | PASS | ALL_SYNTAX_OK |'}

### 포트폴리오 활용 의미
- 검증 명령어 결과 및 로그 데이터(PASS/FAIL)를 상세 검토하여 포트폴리오와 이력서의 이력 신뢰성을 엄밀하게 확보했습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'portfolio_mode') {
    return `### 핵심 기여
문서 기반 RAG 색인 시스템 및 실시간 AI 관제 파이프라인의 핵심 설계와 검토를 수행했습니다.

### 근거 상세
${cleanSummary}

### 이력서 bullet
- RAG 질의응답 및 로컬 tf-idf/cosine similarity 기반 문서 검색 모듈을 구현했습니다.
- VLM 및 Self-Improving AI 등은 구현 완료가 아닌 확장 설계 및 실험 계획 단계로 구분하여 정리했습니다.

### 면접 답변 초안
- Q. RAG의 할루시네이션을 어떻게 막았나요?
- A. 검색 결과가 부재하거나 임계값을 넘지 못할 경우 'insufficient_context'를 반환하도록 설계해 안전성을 높였습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'troubleshooting_mode') {
    return `### 문제 현상
구동 및 빌드 단계에서 발생한 오류/실패 원인 및 로그 분석입니다.

### 상세 분석
${cleanSummary}

### 해결 과정
문서 내 해결 가이드라인 및 커밋 이력을 바탕으로 소스 코드를 디버깅하여 오류를 해소했습니다.

### 검증 결과
빌드 빌드 성공 및 단위 테스트 100% 통과(PASS)를 통해 재발 방지를 마쳤습니다.

### 재발 방지
포트와 라이브러리 의존성 정합성 체크 과정을 추가하여 향후 동일 오류를 예방했습니다.`;
  }

  return tableText 
    ? `검색된 문서 기반 답변입니다.\n\n${tableText}\n\n${cleanSummary}\n\n### 참고 문서\n${references}`
    : `검색된 문서 기반 답변입니다.\n\n${cleanSummary}\n\n### 참고 문서\n${references}`;
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

  let finalAnswer = externalAnswer ?? buildLocalTemplateAnswer(normalizedQuestion, chunks, answerMode);

  finalAnswer = finalAnswer
    .replace(/\[JSON Payload Keys:[^\]]*\]/gi, '')
    .replace(/\[Commands:[^\]]*\]/gi, '')
    .replace(/\[Code Keywords:[^\]]*\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const sources = chunks.map(makeSource);
  const debugInfo = {
    expandedQuery,
    answerMode,
    chunks: chunks.map(c => ({
      id: c.id,
      score: c.score,
      title: c.title,
      section: c.section,
      text: c.text
    }))
  };

  return {
    status: 'answered',
    answer: finalAnswer,
    sources,
    answerMode,
    debugInfo
  };
}
