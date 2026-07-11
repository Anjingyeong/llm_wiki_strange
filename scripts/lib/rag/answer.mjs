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
  const top = chunks[0] ?? {};
  const topScore = top.score ?? 0;
  if (mode === 'baseline') {
    return topScore >= 0.02;
  }

  // Hybrid / default: do not reject strong vector-only hits solely because BM25
  // is empty (semantic paraphrases like "왜 오래된 프레임을 버리나요?").
  const hasLexicalMatch = chunks.some((chunk) => {
    const matched = chunk.matchedBy ?? [];
    return matched.includes('bm25') || matched.includes('lexical');
  });
  const topVector = top.vectorScore ?? top.rawScore ?? 0;
  const strongVector = topVector >= 0.45 || topScore >= 0.08;
  if (hasLexicalMatch && topScore >= 0.02) {
    return true;
  }
  if (strongVector && topScore >= 0.02) {
    return true;
  }
  return false;
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

/**
 * Topic-scoped expansion only. Avoid bolting the entire stack onto every
 * "흐름/구조/파이프라인" question.
 */
function expandQuery(question) {
  const q = question.toLowerCase();
  const aliases = [];

  const add = (...terms) => {
    for (const t of terms) {
      if (t && !aliases.includes(t)) aliases.push(t);
    }
  };

  // Topic extract first
  if (/tensor\s*rt|tensorrt|텐서/.test(q)) {
    add('TensorRT', 'engine', 'backend', 'benchmark', 'actual_backend', 'PyTorch', '.engine');
  }
  if (/mqtt|safety\/events|이벤트\s*스키마|이벤트\s*경로|subscriber/.test(q)) {
    add('MQTT', 'safety/events', 'payload', 'subscriber', 'WebSocket', 'topic', 'schema', 'AlertEvent');
  }
  if (/overlay|오버레이|frameid|frame_id|동기/.test(q)) {
    add('frameId', 'capturedAtMs', 'overlay', 'buffer', 'STOMP', 'OverlaySyncBuffer', 'timestamp');
  }
  if (/latest|frame\s*queue|오래된\s*프레임|실시간\s*(영상\s*)?지연|버리/.test(q)) {
    add('latest-frame', 'CameraFrameQueue', 'put_latest', 'get_latest', 'drop_stale', 'RTSP', 'latency');
  }
  if (/낙상|fall|faint|실신|lifecycle|상태\s*머신/.test(q)) {
    add('NEW_FALL', 'UNRECOVERED', 'POST_FALL', 'FallState', 'LifecycleKind', 'FAINT_SUSPECTED');
  }
  if (/worker|세션|eof|재시작|초기화|camera\s*worker/.test(q)) {
    add('WorkerSession', 'streamRunId', 'sessionGeneration', 'reset', 'supervisor', 'VIDEO_EOF');
  }
  if (/vlm|rag|자연어|넘어졌는지\s*검색|사고\s*검색/.test(q)) {
    add('VLM', 'RAG', 'Incident', 'snapshot', 'semantic search', 'pgvector');
  }
  if (/yolo|pose|bytetrack|lstm|파이프라인|pipeline/.test(q) && aliases.length === 0) {
    add('YOLO', 'Pose', 'ByteTrack', 'LSTM', 'RTSP', 'MQTT');
  }

  // Mode-only light boosts (no full stack dump)
  if (/검증|테스트|결과|근거|pass|fail|합격|실패/.test(q)) {
    add('검증', 'PASS', 'FAIL', '테스트');
  }
  if (/포트폴리오|이력서|면접|자소서|기여/.test(q)) {
    add('포트폴리오', '이력서', '면접');
  }

  if (aliases.length === 0) {
    return question;
  }
  return `${question} ${aliases.join(' ')}`;
}

// Exported for unit tests
export { expandQuery, hasSufficientContext, detectAnswerMode };

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
