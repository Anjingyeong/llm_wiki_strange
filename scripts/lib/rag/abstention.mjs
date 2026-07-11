/**
 * Multi-signal RAG abstention helpers (pure, unit-testable).
 * Separates retrieval relevance from answer support.
 */

const STOP = new Set([
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '으로', '에서',
  '하다', '있는', '하는', '대한', '위해', '통해', '또한', '그리고', '또는',
  '무엇', '어떻게', '왜', '언제', '어디서', '누가', '인가요', '했나요', '되나요',
  '됩니다', '습니다', '있나요', '할까요', '인가', '오늘', '내일', '어제',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'for',
  'on', 'and', 'or', 'what', 'how', 'why', 'does', 'do', 'did', 'can', 'will',
  'with', 'from', 'that', 'this', 'it', 'as', 'at', 'by',
]);

/** High-frequency generic tokens that alone must not ground retrieval. */
const GENERIC = new Set([
  '정책', '방식', '회사', '대응', '문제', '결과', '처리', '상태', '기능', '사용',
  '관련', '시스템', '운영', '규정', '알고리즘', '방법', '내용', '정보', '기준',
  '대상', '경우', '부분', '전체', '기본', '설정', '구조', '흐름', '적용', '구현',
  '필요', '가능', '확인', '지원', '제공', '관리', '개선', '발생', '수행', '진행',
  '실제', '현재', '이전', '이후', '다음', '이상', '이하', '정도', '수준',
  '전략', '장애', '면접', '오늘', '경기', '사용량', '감소', '증가', '이내',
  '구매', '가격', '얼마', '누구', '어떤', '항상', '정확히', '발생하면',
  '문제', 'javascript', // off-domain “JS 면접 문제” must not ground via 면접 alone
  'policy', 'system', 'method', 'result', 'status', 'function', 'support',
  'actual', 'current', 'how', 'what', 'why', 'problem', 'strategy',
]);

const NUMERIC_STATUS_PATTERNS = [
  /몇\s*퍼센트/,
  /몇\s*%/,
  /몇\s*ms/i,
  /몇\s*와트/,
  /몇\s*초/,
  /정확히\s*얼마/,
  /얼마인가요/,
  /얼마인가/,
  /가격은\s*얼마/,
  /비용은\s*얼마/,
  /항상/,
  /실제\s*적용/,
  /적용됐/,
  /적용되었/,
  /완료됐/,
  /완료되었/,
  /운영\s*중/,
  /검증됐/,
  /검증되었/,
  /감소했/,
  /증가했/,
  /\d+\s*%/,
  /\d+\s*ms/i,
  /\d+\s*초/,
];

/**
 * Strip common Korean endings so "검색하는" ≈ "검색", "기능은" ≈ "기능".
 */
export function normalizeToken(token) {
  let t = String(token || '').toLowerCase();
  if (!t) return t;
  // Latin/code tokens: keep
  if (/[a-z0-9_./-]/i.test(t) && !/[가-힣]/.test(t)) return t;
  t = t
    .replace(/(았나요|었나요|였나요|인가요|됐나요|했나요|되나요|할까요)$/u, '')
    .replace(/(합니다|입니다|됩니다|습니다)$/u, '')
    .replace(/(되어|되는|하는|있는|했던|시킨)$/u, '')
    .replace(/(부터|까지|에서|으로|로서)$/u, '')
    .replace(/(을|를|이|가|은|는|의|에|로|와|과|도|만)$/u, '');
  return t;
}

/**
 * Light tokenizer: letters/digits/underscore/path punctuation.
 */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_./-]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map(normalizeToken)
    .filter((t) => t.length >= 2);
}

export function contentTokens(text) {
  return [...new Set(
    tokenize(text).filter((t) => !STOP.has(t) && !GENERIC.has(t)),
  )];
}

export function allMeaningfulTokens(text) {
  return [...new Set(tokenize(text).filter((t) => !STOP.has(t)))];
}

function isDistinctiveToken(t) {
  if (!t) return false;
  if (/[a-z0-9_./-]/i.test(t) && t.length >= 3) return true;
  return t.length >= 3;
}

/**
 * Exact code symbols / entities: camelCase, snake_case, dotted paths, tech tokens.
 */
export function extractExactSymbols(question) {
  const q = String(question || '');
  const found = new Set();
  const patterns = [
    /\b[A-Za-z][A-Za-z0-9]*(?:[A-Z][A-Za-z0-9]+)+\b/g, // camelCase
    /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g, // snake_case
    /\b[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_./-]+\b/g, // safety/events
    /\b(?:TensorRT|PyTorch|ByteTrack|WebRTC|MQTT|YOLO|LSTM|RTSP|MJPEG|frameId|cameraLoginId|streamRunId|workerRunId|VIDEO_EOF)\b/gi,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m) {
      for (const s of m) found.add(s);
    }
  }
  return [...found];
}

export function detectNumericOrStatusIntent(question) {
  const q = String(question || '');
  return NUMERIC_STATUS_PATTERNS.some((re) => re.test(q));
}

/**
 * Metric families that require explicit evidence in chunks (not just related docs).
 */
export function detectMetricFamily(question) {
  const q = String(question || '');
  if (/와트|전력/.test(q)) {
    return {
      family: 'power_watts',
      need: [/와트|watt|전력|power\s*consum/i],
      needNumber: true,
      // require the unit/measure itself, not just related product docs
      strict: true,
    };
  }
  if (/사고율|재해율/.test(q) && /퍼센트|%|감소|증가/.test(q)) {
    return { family: 'accident_rate', need: [/사고율|재해율|감소율/i], needNumber: true, strict: true };
  }
  if (/정확도/.test(q) && /퍼센트|%|몇/.test(q)) {
    return { family: 'accuracy_pct', need: [/정확도|accuracy/i], needNumber: true, strict: true };
  }
  if (/id\s*switch|switch\s*비율|스위치/i.test(q)) {
    return {
      family: 'id_switch',
      // Require explicit switch-rate language, not mere "ByteTrack" + any %
      need: [/id\s*switch|switch\s*rate|id\s*switch\s*ratio|스위치\s*비율/i],
      needNumber: true,
      strict: true,
    };
  }
  if (/비용|가격|보상금|급여|운영\s*비용|구매\s*가격/.test(q)) {
    return {
      family: 'cost_money',
      // Require money/cost language with currency or explicit price — not bare 비용 next to camera counts.
      need: [/운영\s*비용|구매\s*가격|단가|USD|\$|원\b|비용은\s*\d|가격은\s*\d/i],
      needNumber: true,
      strict: true,
    };
  }
  // Max device count (e.g. 카메라 최대 몇 대) — docs saying "N대 동시" without a hard max are not enough
  if (/카메라|cctv/i.test(q) && /몇\s*대|최대\s*(몇|몇\s*대|대수)|정확히\s*최대|지원\s*가능.*대/.test(q)) {
    return {
      family: 'device_count_max',
      need: [/최대\s*\d+\s*대|hard\s*max|max\s*cameras|\d+\s*대\s*제한/i],
      needNumber: true,
      strict: true,
    };
  }
  if (/몇\s*ms|지연.*몇|latency/i.test(q) || (/지연/.test(q) && /항상|이내|ms|초/.test(q))) {
    return {
      family: 'latency',
      need: [/지연|latency/i],
      needNumber: true,
      strict: true,
      // Bound must be the measured value language — bare 보장 is not a bound.
      requiredBound: /1\s*초|1000\s*ms/.test(q)
        ? /1\s*초|1000\s*ms/i
        : (/\d+\s*ms/i.test(q) ? /\d+\s*ms/i : null),
    };
  }
  if (/몇\s*퍼센트|몇\s*%/.test(q)) {
    return { family: 'generic_pct', need: [/%|퍼센트/], needNumber: true, strict: true };
  }
  if (/항상/.test(q)) {
    // Bare "보장" alone is NOT always-claim evidence (e.g. "성능 개선을 보장하지는 않는다").
    const msBound = q.match(/(\d+)\s*ms/i);
    const secBound = q.match(/(\d+)\s*초/);
    return {
      family: 'always_claim',
      need: [/항상|always|never/i],
      needNumber: Boolean(msBound || secBound),
      strict: true,
      requiredBound: msBound
        ? new RegExp(`${msBound[1]}\\s*ms`, 'i')
        : (secBound ? new RegExp(`${secBound[1]}\\s*초`) : null),
    };
  }
  return null;
}

/** Denial / “no measurement” language near a metric claim. */
const METRIC_DENIAL = [
  /데이터\s*(는|가|이)?\s*없/,
  /수치\s*(는|가|이)?\s*없/,
  /측정\s*(값|결과|데이터|기록)?\s*(는|이|가)?\s*(없|안\s*함|하지\s*않)/,
  /기록\s*(이|은|가)?\s*없/,
  /미확인/,
  /확인\s*되지\s*않/,
  /확인\s*불가/,
  /제공\s*하지\s*않/,
  /포함\s*되지\s*않/,
  /존재하지\s*않/,
  /not\s+(measured|available|recorded|provided)/i,
  /no\s+(data|measurement|metric|figure)/i,
  /없음/,
  /없다/,
  /unknown/i,
];

/**
 * True when corpus denies having the asked metric (even if stray digits exist elsewhere).
 */
export function corpusDeniesMetric(corpus, metric) {
  const text = String(corpus || '');
  if (!metric?.need?.length) {
    return METRIC_DENIAL.some((re) => re.test(text));
  }
  // Window around each family-keyword hit; denial in-window blocks support.
  for (const re of metric.need) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m;
    while ((m = global.exec(text))) {
      const start = Math.max(0, m.index - 80);
      const end = Math.min(text.length, m.index + m[0].length + 80);
      const window = text.slice(start, end);
      if (METRIC_DENIAL.some((d) => d.test(window))) {
        return true;
      }
    }
  }
  // Global denial of measurements when question asks for a number.
  if (metric.needNumber && /(?:측정|수치|데이터|결과).{0,24}(?:없|미확인)|(?:없|미확인).{0,24}(?:측정|수치|데이터)/.test(text)) {
    // Only deny if no affirmative number sits next to a family keyword.
    if (!numberNearFamily(text, metric.need)) return true;
  }
  return false;
}

/**
 * Require a digit within ±64 chars of a family keyword — not any digit in the doc.
 */
export function numberNearFamily(corpus, needPatterns) {
  const text = String(corpus || '');
  for (const re of needPatterns || []) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m;
    while ((m = global.exec(text))) {
      const start = Math.max(0, m.index - 64);
      const end = Math.min(text.length, m.index + m[0].length + 64);
      if (/\d+(?:\.\d+)?/.test(text.slice(start, end))) return true;
    }
  }
  return false;
}

/**
 * Always-language co-located with optional bound (rejects bare 보장 elsewhere).
 */
export function alwaysClaimSupported(corpus, metric, question) {
  const text = String(corpus || '');
  const q = String(question || '');
  // Explicit always/never only — not 보장 alone.
  if (!/항상|always|never/i.test(text)) {
    return false;
  }
  if (metric?.requiredBound) {
    // Bound must appear near always-language or near the latency/ms concept.
    const boundSrc = metric.requiredBound.source;
    const near = new RegExp(
      `(?:항상|always|never).{0,48}(?:${boundSrc})|(?:${boundSrc}).{0,48}(?:항상|always|never|이내|이하)`,
      'i',
    );
    if (!near.test(text)) return false;
  }
  // YOLO/30ms style: if question names a tech + always + ms, require that ms near always.
  if (/\d+\s*ms/i.test(q) && metric?.family === 'always_claim') {
    const ms = q.match(/(\d+)\s*ms/i);
    if (ms) {
      const re = new RegExp(
        `(?:항상|always).{0,40}${ms[1]}\\s*ms|${ms[1]}\\s*ms.{0,40}(?:항상|always|이내|이하)`,
        'i',
      );
      if (!re.test(text)) return false;
    }
  }
  return true;
}

/** Tokens that must appear in chunks when present in the question (near-domain traps). */
const HIGH_STAKES = new Set([
  '법적', '책임', '책임자', '보험', '보상', '보상금', '가격', '비용', '급여',
  '심박', '심박수', '음성', '얼굴', '얼굴인식', '화재', '와트', '전력',
  '가입', '조건', '야구', '주식', '날씨', '쿠버네티스', '블록체인',
  '제조사', 'cctv', '공식', '장애율',
]);

function chunkSearchText(chunk) {
  return [
    chunk.displayTitle,
    chunk.title,
    chunk.sectionTitle,
    chunk.section,
    chunk.slug,
    chunk.documentId,
    chunk.text,
  ]
    .filter(Boolean)
    .join(' ');
}

function titleSectionText(chunk) {
  return [chunk.displayTitle, chunk.title, chunk.sectionTitle, chunk.section, chunk.slug]
    .filter(Boolean)
    .join(' ');
}

function tokenPresentIn(token, haystackLower) {
  if (!token) return false;
  const t = normalizeToken(token);
  if (!t) return false;
  if (haystackLower.includes(t)) return true;
  // partial for longer tokens
  if (t.length >= 4) {
    for (const part of haystackLower.split(/[^a-z0-9가-힣_./-]+/i)) {
      if (part.length >= 3 && (part.includes(t) || t.includes(part))) return true;
    }
  }
  return false;
}

/**
 * Fraction of content tokens from `query` found in `docText`.
 */
export function tokenCoverage(queryTokens, docText) {
  const tokens = queryTokens || [];
  if (tokens.length === 0) {
    return { coverage: 0, matched: [], unmatched: [] };
  }
  const hay = String(docText || '').toLowerCase();
  const matched = tokens.filter((t) => tokenPresentIn(t, hay));
  return {
    coverage: matched.length / tokens.length,
    matched,
    unmatched: tokens.filter((t) => !matched.includes(t)),
  };
}

function maxCoverageAcross(chunks, tokens, textFn = chunkSearchText) {
  let best = { coverage: 0, matched: [], unmatched: tokens, slug: null };
  for (const chunk of chunks) {
    const cov = tokenCoverage(tokens, textFn(chunk));
    if (cov.coverage > best.coverage || (cov.coverage === best.coverage && cov.matched.length > best.matched.length)) {
      best = { ...cov, slug: chunk.slug || chunk.documentId };
    }
  }
  return best;
}

function unionCoverage(chunks, tokens, textFn = chunkSearchText) {
  if (!tokens.length) return { coverage: 0, matched: [], unmatched: tokens };
  const hay = chunks.map(textFn).join('\n').toLowerCase();
  const matched = tokens.filter((t) => tokenPresentIn(t, hay));
  return {
    coverage: matched.length / tokens.length,
    matched,
    unmatched: tokens.filter((t) => !matched.includes(t)),
  };
}

function hasSymbolInChunks(symbols, chunks) {
  if (!symbols.length) return false;
  for (const chunk of chunks) {
    const hay = chunkSearchText(chunk).toLowerCase();
    for (const s of symbols) {
      if (hay.includes(String(s).toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * Compute structural signals for gate decisions.
 */
export function computeContextSignals(chunks, originalQuestion, expandedQuery) {
  const list = Array.isArray(chunks) ? chunks : [];
  const top = list[0] ?? null;
  const top2 = list[1] ?? null;
  const topScore = top?.score ?? 0;
  const topVector = top?.vectorScore ?? top?.rawScore ?? 0;
  // Margin only meaningful when a second result exists; otherwise 0.
  const margin = top && top2 ? topScore - (top2.score ?? 0) : 0;

  const origContent = contentTokens(originalQuestion);
  const origAll = allMeaningfulTokens(originalQuestion);
  const expanded = expandedQuery ?? originalQuestion;
  const expContent = contentTokens(expanded);
  const aliasOnly = expContent.filter((t) => !origContent.includes(t) && !origAll.includes(t));

  // Union coverage across top chunks (better for multi-chunk answers)
  const origCov = unionCoverage(list.slice(0, 5), origContent);
  const origAllCov = unionCoverage(list.slice(0, 5), origAll);
  const aliasCov = unionCoverage(list.slice(0, 5), aliasOnly);
  const titleCov = unionCoverage(list.slice(0, 5), origContent.filter(isDistinctiveToken), titleSectionText);

  const symbols = extractExactSymbols(originalQuestion);
  const symbolMatch = hasSymbolInChunks(symbols, list.slice(0, 5));

  const hasLexicalMatch = list.some((chunk) => {
    const matched = chunk.matchedBy ?? [];
    return matched.includes('bm25') || matched.includes('lexical');
  });

  const multiRetrieverAgreement = list.slice(0, 3).some((chunk) => {
    const matched = chunk.matchedBy ?? [];
    const hasVec = matched.includes('vector') || matched.includes('rrf');
    const hasLex = matched.includes('bm25') || matched.includes('lexical');
    return hasVec && hasLex;
  });

  const topK = list.slice(0, 5);
  const slugCounts = new Map();
  for (const c of topK) {
    const s = c.slug || c.documentId || '';
    slugCounts.set(s, (slugCounts.get(s) ?? 0) + 1);
  }
  let maxSlugCount = 0;
  for (const n of slugCounts.values()) maxSlugCount = Math.max(maxSlugCount, n);
  const documentConcentration = topK.length ? maxSlugCount / topK.length : 0;

  // Topic-triggered expansion: expandQuery added aliases because original matched a topic regex.
  const topicTriggeredExpansion = expanded !== originalQuestion && aliasOnly.length > 0;

  // Original question shows a wiki-domain topic intent (not free-form alias injection).
  const originalTopicIntent = /영상|끝난|eof|mqtt|tensor|낙상|fall|frame|overlay|worker|카메라|하드코딩|고정\s*목록|동적|등록|rtsp|세션|파이프라인|pipeline|vlm|rag|bytetrack|yolo|lstm|webrtc|알림|넘어|검색|사고\s*검색/i.test(
    String(originalQuestion || ''),
  );

  // Expansion-only: aliases match but original has no doc link. Free-form injected
  // aliases (tests / bad expand) stay rejected; domain paraphrases may continue.
  const expansionOnlyMatch =
    aliasOnly.length > 0
    && origCov.coverage < 0.05
    && aliasCov.coverage > 0
    && !symbolMatch
    && !originalTopicIntent;

  return {
    topScore,
    topVector,
    margin,
    hasLexicalMatch,
    multiRetrieverAgreement,
    documentConcentration,
    originalContentTokens: origContent,
    originalAllTokens: origAll,
    aliasTokens: aliasOnly,
    originalContentCoverage: origCov.coverage,
    originalContentMatched: origCov.matched,
    originalAllCoverage: origAllCov.coverage,
    aliasCoverage: aliasCov.coverage,
    titleSectionCoverage: titleCov.coverage,
    titleSectionMatched: titleCov.matched,
    symbols,
    symbolMatch,
    expansionOnlyMatch,
    topicTriggeredExpansion,
    originalTopicIntent,
    prePostCoverageDelta: origCov.coverage - (aliasOnly.length ? aliasCov.coverage : 0),
    numericOrStatusIntent: detectNumericOrStatusIntent(originalQuestion),
    metricFamily: detectMetricFamily(originalQuestion),
    empty: list.length === 0,
  };
}

/**
 * Retrieval relevance gate (does not invent answers).
 * Returns { relevant, reason }.
 */
export function evaluateRetrievalRelevance(chunks, mode = 'hybrid', meta = {}) {
  const originalQuestion = meta.originalQuestion ?? meta.question ?? '';
  const expandedQuery = meta.expandedQuery ?? originalQuestion;
  const signals = meta.signals ?? computeContextSignals(chunks, originalQuestion, expandedQuery);

  if (signals.empty) {
    return { relevant: false, reason: 'empty', signals };
  }

  const contentHits = signals.originalContentMatched?.length ?? 0;
  const titleHits = (signals.titleSectionMatched || []).filter(isDistinctiveToken).length;
  const distinctiveHits = (signals.originalContentMatched || []).filter(isDistinctiveToken).length;

  if (mode === 'baseline' || mode === 'vector' || mode === 'vector-only') {
    if (signals.topScore < 0.02) {
      return { relevant: false, reason: 'baseline_low_score', signals };
    }
    if (signals.symbolMatch) {
      return { relevant: true, reason: 'baseline_symbol', signals };
    }
    if (contentHits >= 2 || distinctiveHits >= 1 && signals.topVector >= 0.35) {
      return { relevant: true, reason: 'baseline_token_grounded', signals };
    }
    if (signals.topVector >= 0.45 && signals.topScore >= 0.08 && contentHits >= 1) {
      return { relevant: true, reason: 'baseline_strong_vector', signals };
    }
    if (contentHits < 1 && distinctiveHits < 1) {
      return { relevant: false, reason: 'baseline_ungrounded', signals };
    }
    return { relevant: signals.topScore >= 0.08 && contentHits >= 1, reason: 'baseline_score', signals };
  }

  // Expansion-only match must not pass on vector strength alone.
  if (signals.expansionOnlyMatch && !signals.symbolMatch) {
    return { relevant: false, reason: 'expansion_only_no_original', signals };
  }

  // Exact symbol / entity path: allow lower NL coverage.
  if (signals.symbolMatch && signals.topScore >= 0.02) {
    return { relevant: true, reason: 'exact_symbol', signals };
  }

  // Topic-triggered expansion (e.g. 넘어졌는지 검색 → VLM) with multi-retriever support.
  // Requires original topic intent so free-form alias dumps cannot pass.
  if (
    signals.topicTriggeredExpansion
    && signals.originalTopicIntent !== false
    && /영상|끝난|eof|mqtt|tensor|낙상|fall|frame|overlay|worker|카메라|하드코딩|동적|등록|rtsp|세션|vlm|rag|알림|넘어/i.test(
      String(meta.originalQuestion || originalQuestion || ''),
    )
    && signals.multiRetrieverAgreement
    && signals.topScore >= 0.02
    && (contentHits >= 1 || signals.aliasCoverage >= 0.3)
  ) {
    return { relevant: true, reason: 'topic_expansion_grounded', signals };
  }

  // Strong semantic paraphrase path — needs real original-query link.
  const strongVector = signals.topVector >= 0.45 || signals.topScore >= 0.12;
  if (strongVector) {
    const hasOriginalLink =
      contentHits >= 2
      || (distinctiveHits >= 1 && signals.originalContentCoverage >= 0.2)
      || titleHits >= 1 && contentHits >= 1
      || (signals.multiRetrieverAgreement && distinctiveHits >= 1 && signals.originalAllCoverage >= 0.25);
    if (hasOriginalLink) {
      return { relevant: true, reason: 'strong_semantic', signals };
    }
    if (contentHits < 1 && distinctiveHits < 1) {
      return { relevant: false, reason: 'strong_vector_zero_original', signals };
    }
  }

  // Lexical path: require ≥2 content hits OR 1 distinctive long/latin token with agreement.
  if (signals.hasLexicalMatch && signals.topScore >= 0.02) {
    if (contentHits >= 2) {
      return { relevant: true, reason: 'lexical_content_tokens', signals };
    }
    if (titleHits >= 1 && contentHits >= 1 && distinctiveHits >= 1) {
      return { relevant: true, reason: 'lexical_title_overlap', signals };
    }
    const distinctive = (signals.originalContentMatched || []).some(isDistinctiveToken);
    if (
      distinctive
      && contentHits >= 1
      && distinctiveHits >= 1
      && signals.multiRetrieverAgreement
      && signals.topScore >= 0.04
      && signals.originalContentCoverage >= 0.35
    ) {
      return { relevant: true, reason: 'lexical_distinctive_token', signals };
    }
    if (signals.topScore >= 0.08 && contentHits >= 2) {
      return { relevant: true, reason: 'lexical_modest_score', signals };
    }
    return { relevant: false, reason: 'lexical_generic_only', signals };
  }

  if (signals.topScore >= 0.08 && contentHits >= 2 && titleHits >= 1) {
    return { relevant: true, reason: 'score_title_overlap', signals };
  }

  return { relevant: false, reason: 'insufficient_signals', signals };
}

/**
 * Whether chunk text supports a direct answer for numeric/status / near-domain intents.
 */
export function evaluateAnswerSupport(question, chunks) {
  const list = Array.isArray(chunks) ? chunks : [];
  const corpus = list.map(chunkSearchText).join('\n').toLowerCase();
  const intent = detectNumericOrStatusIntent(question);
  const metric = detectMetricFamily(question);
  const content = contentTokens(question);
  const present = content.filter((t) => tokenPresentIn(t, corpus));
  const missing = content.filter((t) => !tokenPresentIn(t, corpus));

  if (!list.length) {
    return { supported: false, reason: 'no_chunks', intent, metric };
  }

  // High-stakes nouns in the question must appear in retrieved text.
  const missingHighStakes = content.filter((t) => HIGH_STAKES.has(t) && !tokenPresentIn(t, corpus));
  if (missingHighStakes.length > 0) {
    return {
      supported: false,
      reason: 'high_stakes_token_missing',
      intent,
      metric,
      present,
      missing,
      missingHighStakes,
    };
  }

  // Metric / numeric / status: require family evidence, not mere related docs.
  if (metric) {
    const hasFamily = metric.need.some((re) => re.test(corpus));
    if (!hasFamily) {
      return { supported: false, reason: `metric_family_missing:${metric.family}`, intent: true, metric };
    }
    // Denial / “no data” next to the metric blocks support even if stray digits exist.
    if (corpusDeniesMetric(corpus, metric)) {
      return { supported: false, reason: 'metric_denied_in_chunks', intent: true, metric };
    }
    // Numbers must sit near the family keyword — not any digit in the document.
    if (metric.needNumber && !numberNearFamily(corpus, metric.need)) {
      return { supported: false, reason: 'numeric_no_number_near_family', intent: true, metric };
    }
    if (metric.requiredBound && !metric.requiredBound.test(corpus)) {
      return { supported: false, reason: 'metric_bound_missing', intent: true, metric };
    }
    // always_claim: explicit 항상/always/never only; bound co-location when asked.
    if (metric.family === 'always_claim' || (/항상/.test(String(question || '')) && metric.family === 'latency')) {
      if (!alwaysClaimSupported(corpus, metric, question)) {
        return { supported: false, reason: 'always_claim_unsupported', intent: true, metric };
      }
    }
    // Concrete bound + always for notification latency SLA language.
    if (metric.family === 'latency' && /항상|1\s*초|이내/.test(String(question || ''))) {
      const q = String(question || '');
      if (/알림/.test(q)) {
        const hasNotifLatencyPhrase = /알림.{0,16}지연|지연.{0,16}알림|notification\s*latency/i.test(corpus);
        const hasSla =
          /(?:알림.{0,16}지연|지연.{0,16}알림).{0,40}(?:1\s*초|1000\s*ms|항상|이내|이하)/i.test(corpus)
          || /(?:1\s*초|1000\s*ms|항상).{0,40}(?:알림.{0,16}지연|지연.{0,16}알림)/i.test(corpus);
        if (!hasNotifLatencyPhrase || !hasSla) {
          return { supported: false, reason: 'notification_latency_sla_missing', intent: true, metric };
        }
      } else if (/항상/.test(q)) {
        const near =
          /(?:지연|latency).{0,40}(?:항상|always)|(?:항상|always).{0,40}(?:지연|latency)/i.test(corpus);
        if (!near) {
          return { supported: false, reason: 'latency_bound_not_co_located', intent: true, metric };
        }
      }
    }
    // Strict metrics: family keyword alone is not enough if many question tokens missing
    if (metric.strict && missing.length >= 2) {
      return { supported: false, reason: 'metric_key_tokens_missing', intent: true, metric, missing };
    }
    if (missing.length && present.length <= 1 && content.length >= 3) {
      return { supported: false, reason: 'metric_key_tokens_missing', intent: true, metric };
    }
    return { supported: true, reason: 'metric_evidence_present', intent: true, metric };
  }

  if (intent) {
    const evidencePatterns = [
      /\d+(?:\.\d+)?\s*%/,
      /\d+(?:\.\d+)?\s*ms\b/i,
      /측정/,
      /벤치마크/,
      /benchmark/i,
      /검증/,
      /도입/,
      /보류/,
      /deferred/i,
      /실측/,
      /하드코딩/,
      /동적/,
    ];
    const asksNumber = /몇\s*퍼센트|몇\s*%|몇\s*ms|몇\s*와트|정확히\s*얼마|얼마인가요|얼마인가/.test(
      String(question || ''),
    );
    if (asksNumber && !/\d+(?:\.\d+)?/.test(corpus)) {
      return { supported: false, reason: 'numeric_no_number_in_chunks', intent: true, metric: null };
    }
    if (!evidencePatterns.some((re) => re.test(corpus))) {
      return { supported: false, reason: 'status_no_evidence_language', intent: true, metric: null };
    }
    if (content.length >= 2 && present.length < 2) {
      return { supported: false, reason: 'status_weak_token_overlap', intent: true, metric: null };
    }
    return { supported: true, reason: 'status_evidence_present', intent: true, metric: null };
  }

  // Structural evidence for end-of-video / session-reset paraphrases.
  const endOfVideoEvidence =
    /영상|끝난|이전\s*상태|EOF|세션/i.test(String(question || ''))
    && /video_eof|reset_analysis_session|sessiongeneration|streamrunid|worker\s*session|세션 경계/i.test(corpus);

  // Dynamic camera registry / not-hardcoded evidence already in chunks.
  const dynamicCameraEvidence =
    /카메라|cameraloginid|하드코딩|고정|동적|등록|cam_0/i.test(String(question || ''))
    && /하드코딩하지\s*않|동적\s*목록|active\s*camera|sync_camera_workers|camera\s*registry|plan_source_change_restarts|고정\s*네\s*개|cam_01\s*~\s*cam_04로\s*하드코딩하지/i.test(corpus);

  // Soften for short code/search paraphrases when ≥1 domain token hits.
  const softDomain =
    (
      present.some((t) => /검색|mqtt|overlay|frame|낙상|tensor|worker|camera|카메라|영상/i.test(t))
      || endOfVideoEvidence
      || dynamicCameraEvidence
    )
    && missing.every((t) => !HIGH_STAKES.has(t));

  if (endOfVideoEvidence) {
    return {
      supported: true,
      reason: 'end_of_video_session_evidence',
      intent: false,
      metric: null,
      present,
      missing,
    };
  }
  if (dynamicCameraEvidence && softDomain) {
    return {
      supported: true,
      reason: 'dynamic_camera_registry_evidence',
      intent: false,
      metric: null,
      present,
      missing,
    };
  }

  // Near-domain / general: require most distinctive content tokens to appear.
  if (content.length >= 3 && present.length / content.length < 0.4 && !softDomain) {
    return {
      supported: false,
      reason: 'key_tokens_missing_from_chunks',
      intent: false,
      metric: null,
      present,
      missing,
    };
  }
  if (content.length >= 3 && present.length / content.length < 0.34 && !softDomain) {
    return {
      supported: false,
      reason: 'key_tokens_missing_from_chunks',
      intent: false,
      metric: null,
      present,
      missing,
    };
  }
  if (content.length === 2 && present.length === 0) {
    return {
      supported: false,
      reason: 'key_tokens_missing_from_chunks',
      intent: false,
      metric: null,
      present,
      missing,
    };
  }

  return {
    supported: true,
    reason: 'non_status_with_context',
    intent: false,
    metric: null,
    present,
    missing,
  };
}

/**
 * Backward-compatible boolean gate used by older tests.
 * Prefer evaluateRetrievalRelevance for new code.
 */
export function hasSufficientContext(chunks, mode = 'hybrid', meta = {}) {
  return evaluateRetrievalRelevance(chunks, mode, meta).relevant;
}
