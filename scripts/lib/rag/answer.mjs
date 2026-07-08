import { searchRelevantChunks } from './search.mjs';
import { buildContextChunks } from './context.mjs';
import { buildLocalTemplateAnswer } from './templates.mjs';
import { generateAnswer } from './providers/index.mjs';
import { readEnv, readBooleanEnv, readNumberEnv } from './env.mjs';

function makeSource(chunk) {
  return {
    documentId: chunk.documentId,
    section: chunk.sectionTitle ?? chunk.section,
    sectionTitle: chunk.sectionTitle ?? chunk.section,
    slug: chunk.slug,
    displayTitle: chunk.displayTitle ?? chunk.title,
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

function hasSufficientContext(chunks, mode) {
  if (chunks.length === 0) {
    return false;
  }
  const topScore = chunks[0]?.score ?? 0;
  if (mode === 'baseline') {
    return topScore >= 0.02;
  }
  const hasLexicalMatch = chunks.some((chunk) => (chunk.matchedBy ?? []).includes('bm25'));
  return hasLexicalMatch && topScore >= 0.02;
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

  const env = options.env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const enableLlmAnswer = readBooleanEnv(env, 'ENABLE_LLM_ANSWER', false);
  const llmProvider = readEnv(env, 'LLM_PROVIDER', 'none');

  const expandedQuery = expandQuery(normalizedQuestion);
  const chunks = searchRelevantChunks(index, expandedQuery, options);
  
  if (!hasSufficientContext(chunks, options.mode)) {
    return {
      status: 'insufficient_context',
      answer: '관련 문서가 부족함. 문서에서 확인되지 않음.',
      sources: [],
    };
  }

  const answerMode = detectAnswerMode(normalizedQuestion);
  const sources = chunks.map(makeSource);
  
  const maxContextChunks = readNumberEnv(env, 'LLM_MAX_CONTEXT_CHUNKS', 8);
  const contextChunks = buildContextChunks(chunks, maxContextChunks);

  let finalAnswer = '';
  let fallback = false;
  let fallbackReason = null;
  let llmLatency = null;
  let llmAnswer = null;

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  if (enableLlmAnswer && llmProvider !== 'none') {
    let startLlm = 0;
    try {
      startLlm = now();
      llmAnswer = await generateAnswer({
        query: normalizedQuestion,
        contexts: contextChunks,
        provider: llmProvider,
        model: readEnv(env, 'LLM_MODEL', ''),
        maxOutputTokens: readNumberEnv(env, 'LLM_MAX_OUTPUT_TOKENS', 800),
        timeoutMs: readNumberEnv(env, 'LLM_TIMEOUT_MS', 10000),
        credentials: {
          geminiApiKey: readEnv(env, 'GEMINI_API_KEY', ''),
          cloudflareAccountId: readEnv(env, 'CLOUDFLARE_ACCOUNT_ID', ''),
          cloudflareApiToken: readEnv(env, 'CLOUDFLARE_API_TOKEN', ''),
          openaiApiKey: readEnv(env, 'OPENAI_API_KEY', '') || readEnv(env, 'RAG_LLM_API_KEY', '')
        },
        env
      });
      llmLatency = Number((now() - startLlm).toFixed(2));
      
      if (!llmAnswer || !llmAnswer.trim()) {
        throw new Error('LLM returned an empty response');
      }
      finalAnswer = llmAnswer;
    } catch (err) {
      llmLatency = startLlm > 0 ? Number((now() - startLlm).toFixed(2)) : 0;
      fallback = true;
      fallbackReason = err.message || String(err);
      
      const localAnswer = buildLocalTemplateAnswer(chunks, answerMode);
      finalAnswer = `[LLM 답변 생성 중 오류가 발생하여, RAG 기반 검색 결과를 먼저 제공해 드립니다.]\n\n${localAnswer}`;
    }
  } else {
    const localAnswer = buildLocalTemplateAnswer(chunks, answerMode);
    finalAnswer = `[현재 LLM 답변 생성은 비활성화되어 있어 관련 문서 검색 결과를 먼저 보여드립니다.]\n\n${localAnswer}`;
    fallbackReason = 'LLM Answer mode disabled';
  }

  finalAnswer = finalAnswer
    .replace(/\[JSON Payload Keys:[^\]]*\]/gi, '')
    .replace(/\[Commands:[^\]]*\]/gi, '')
    .replace(/\[Code Keywords:[^\]]*\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const debugInfo = {
    expandedQuery,
    answerMode,
    fallback,
    fallbackReason,
    llmLatency,
    search: chunks.debug ?? null,
    finalContextChunks: contextChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      displayTitle: chunk.displayTitle ?? chunk.title,
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
      displayTitle: c.displayTitle ?? c.title,
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
    fallback,
    fallbackReason,
    debugInfo
  };
}
