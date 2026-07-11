/**
 * Client-side wiki document search (not RAG).
 * Pure functions for Node tests and browser search.ts.
 */

const STOP_KO = new Set([
  '이', '가', '을', '를', '은', '는', '에', '의', '와', '과', '도', '로', '으로',
  '및', '등', '그', '저', '수', '것', '때', '더', '좀', '위해', '대한', '있는',
  '하는', '한', '된', '하는가', '어떻게', '무엇', '어떤', '왜',
]);
const STOP_EN = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'was', 'were', 'be', 'as', 'by', 'from', 'that', 'this', 'it', 'at', 'how', 'what',
  'why', 'when', 'which',
]);

/**
 * @param {string} value
 */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_/\\.+]+/gu, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Expand identifier variants: frameId → frame_id, frame id; cameraLoginId; TensorRT.
 * @param {string} token
 * @returns {string[]}
 */
/** Korean / informal aliases → searchable English tokens */
const QUERY_ALIASES = {
  텐서알티: ['tensorrt', 'tensor rt', 'tensor_rt'],
  텐서rt: ['tensorrt'],
  프레임아이디: ['frameid', 'frame_id', 'frame id'],
  오버레이: ['overlay'],
  낙상: ['fall', 'faint', 'lifecycle'],
};

export function expandTokenVariants(token) {
  const t = token.trim();
  if (!t) return [];
  const out = new Set([t, normalizeSearchText(t)]);
  const aliasHit = QUERY_ALIASES[t] || QUERY_ALIASES[normalizeSearchText(t)];
  if (aliasHit) {
    for (const a of aliasHit) out.add(a);
  }
  // camelCase / PascalCase split
  const camelParts = t
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    .toLowerCase();
  for (const p of camelParts.split(/\s+/u).filter(Boolean)) {
    out.add(p);
  }
  out.add(camelParts.replace(/\s+/gu, ' '));
  out.add(camelParts.replace(/\s+/gu, '_'));
  out.add(t.replace(/_/gu, ' ').toLowerCase());
  out.add(t.replace(/-/gu, ' ').toLowerCase());
  // tensor rt
  if (/tensor\s*rt/iu.test(t) || t === 'tensorrt') {
    out.add('tensorrt');
    out.add('tensor rt');
    out.add('tensor_rt');
  }
  if (t === 'frameid' || t === 'frame_id' || t === 'frame id') {
    out.add('frameid');
    out.add('frame_id');
    out.add('frame id');
  }
  if (t.includes('cameralogin') || t === 'camera_login_id') {
    out.add('cameraloginid');
    out.add('camera_login_id');
    out.add('camera login id');
  }
  return [...out].filter(Boolean);
}

/**
 * @param {string} query
 */
export function tokenizeQuery(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return { normalized, tokens: [], significant: [], phrase: normalized };
  }
  const rawTokens = normalized.split(/\s+/u).filter(Boolean);
  const expanded = [];
  for (const tok of rawTokens) {
    expanded.push(...expandTokenVariants(tok));
  }
  const tokens = [...new Set(expanded.map((t) => normalizeSearchText(t)).filter(Boolean))];
  const significant = tokens.filter(
    (t) => t.length > 1 && !STOP_KO.has(t) && !STOP_EN.has(t),
  );
  return {
    normalized,
    tokens: significant.length ? significant : tokens,
    significant: significant.length ? significant : tokens,
    phrase: normalized,
    compact: normalized.replace(/\s+/gu, ''),
    rawTokens,
  };
}

/**
 * Cap body frequency contribution.
 * @param {string} haystack
 * @param {string} token
 * @param {number} cap
 */
function cappedCount(haystack, token, cap = 4) {
  if (!token) return 0;
  let count = 0;
  let from = 0;
  while (count < cap) {
    const idx = haystack.indexOf(token, from);
    if (idx < 0) break;
    count += 1;
    from = idx + token.length;
  }
  return count;
}

/**
 * @param {object} document SearchDocument-like
 * @param {{ phrase: string, tokens: string[], significant: string[] }} q
 */
export function scoreSearchDocument(document, q) {
  if (!q.phrase && !q.tokens.length) {
    return { score: 0, reasons: [], snippet: '', sectionId: null };
  }

  const title = normalizeSearchText(document.title ?? '');
  const nav = normalizeSearchText(document.navTitle ?? '');
  const shortT = normalizeSearchText(document.shortTitle ?? '');
  const display = normalizeSearchText(
    document.displayTitle ?? document.navTitle ?? document.shortTitle ?? document.title ?? '',
  );
  const slug = normalizeSearchText(document.slug ?? '');
  const summary = normalizeSearchText(document.summary ?? document.excerpt ?? '');
  const tags = normalizeSearchText((document.tags ?? []).join(' '));
  const relatedFiles = normalizeSearchText((document.relatedFiles ?? []).join(' '));
  const category = normalizeSearchText(document.category ?? '');
  const body = normalizeSearchText(document.text ?? '');

  const reasons = new Set();
  let score = 0;

  // 1. Full phrase title / nav
  if (q.phrase && (title === q.phrase || nav === q.phrase || display === q.phrase || shortT === q.phrase)) {
    score += 120;
    reasons.add('제목 일치');
  } else if (q.phrase && (title.includes(q.phrase) || nav.includes(q.phrase) || display.includes(q.phrase))) {
    score += 70;
    reasons.add('제목 일치');
  }

  // Compact identifier (camera_login_id → cameraloginid) exact-ish match
  if (q.compact && q.compact.length >= 6) {
    const compactBody = body.replace(/\s+/gu, '');
    const compactFiles = relatedFiles.replace(/\s+/gu, '');
    const compactTitle = `${title}${nav}${shortT}${slug}`.replace(/\s+/gu, '');
    if (compactFiles.includes(q.compact) || compactTitle.includes(q.compact)) {
      score += 90;
      reasons.add('코드 심볼 일치');
    } else if (compactBody.includes(q.compact)) {
      score += 55;
      reasons.add('코드 심볼 일치');
    }
  }

  // phrase boost in body
  if (q.phrase && q.phrase.length >= 4 && body.includes(q.phrase)) {
    score += 28;
    reasons.add('본문 일치');
  }

  const fieldsAll = (field) => q.tokens.length > 0 && q.tokens.every((t) => field.includes(t));

  // 3. All tokens in title fields
  if (fieldsAll(title) || fieldsAll(nav) || fieldsAll(display)) {
    score += 55;
    reasons.add('제목 일치');
  }

  for (const token of q.tokens) {
    // 2. Code symbol / file exact-ish
    if (
      relatedFiles.includes(token)
      || relatedFiles.includes(token.replace(/\s+/gu, '_'))
      || relatedFiles.includes(token.replace(/\s+/gu, '/'))
    ) {
      score += 40;
      reasons.add('코드 심볼 일치');
    }
    if (slug === token || slug.includes(token)) {
      score += 22;
      reasons.add('제목 일치');
    }
    if (title.includes(token) || nav.includes(token) || shortT.includes(token) || display.includes(token)) {
      score += 18;
      reasons.add('제목 일치');
    }
    if (tags.includes(token)) {
      score += 12;
      reasons.add('태그 일치');
    }
    if (summary.includes(token)) {
      score += 10;
      reasons.add('요약 일치');
    }
    if (category.includes(token)) {
      score += 6;
    }
    // section-ish: look for token near "heading-like" chunks in body text (weak)
    // 7. Body with frequency cap
    const c = cappedCount(body, token, 2);
    if (c > 0) {
      score += c * 1.5;
      reasons.add('본문 일치');
    }
  }

  // Coverage: prefer docs that match all significant tokens
  if (q.significant.length >= 2) {
    const covered = q.significant.filter(
      (t) =>
        title.includes(t)
        || nav.includes(t)
        || shortT.includes(t)
        || summary.includes(t)
        || tags.includes(t)
        || relatedFiles.includes(t)
        || body.includes(t),
    ).length;
    if (covered === q.significant.length) {
      score += 35;
    } else if (covered > 0) {
      score += covered * 4;
    }
  }

  const snippet = buildSnippet(document, q);
  const sectionId = guessSectionId(document, q);

  return {
    score,
    reasons: [...reasons],
    snippet,
    sectionId,
  };
}

/**
 * @param {object} document
 * @param {{ phrase: string, tokens: string[] }} q
 */
function buildSnippet(document, q) {
  const text = String(document.text ?? document.excerpt ?? document.summary ?? '');
  if (!text) return '';
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const token of q.tokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0 && q.phrase) {
    bestIdx = lower.indexOf(q.phrase);
  }
  if (bestIdx < 0) {
    return (document.excerpt || document.summary || text).slice(0, 160);
  }
  const start = Math.max(0, bestIdx - 40);
  const end = Math.min(text.length, bestIdx + 120);
  let snip = text.slice(start, end).replace(/\s+/gu, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < text.length) snip = `${snip}…`;
  return snip;
}

/**
 * @param {object} document
 * @param {{ tokens: string[] }} q
 */
function guessSectionId(document, q) {
  const text = String(document.text ?? '');
  // headings collected as plain in text; generate-search-index may not preserve ids
  // Prefer slugify of first token hit near "## "
  const lines = text.split(/\n/u);
  for (const line of lines) {
    const m = /^(#{2,3})\s+(.+)$/u.exec(line.trim());
    if (!m) continue;
    const heading = m[2] ?? '';
    const hNorm = normalizeSearchText(heading);
    if (q.tokens.some((t) => hNorm.includes(t))) {
      return slugifyHeading(heading);
    }
  }
  return null;
}

function slugifyHeading(text) {
  const normalized = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return normalized || 'section';
}

/**
 * @param {readonly object[]} index
 * @param {string} query
 * @param {{ limit?: number, minScore?: number }} [options]
 */
export function searchDocumentsInIndex(index, query, options = {}) {
  const limit = options.limit ?? 24;
  const minScore = options.minScore ?? 1;
  const q = tokenizeQuery(query);
  if (!q.phrase) return [];

  const scored = [];
  for (const document of index) {
    const { score, reasons, snippet, sectionId } = scoreSearchDocument(document, q);
    if (score >= minScore) {
      scored.push({
        ...document,
        score,
        matchReasons: reasons,
        snippet,
        matchedSectionId: sectionId,
      });
    }
  }

  // Prefer full-token coverage first: re-sort with coverage as soft key already in score
  scored.sort(
    (a, b) =>
      b.score - a.score
      || String(a.displayTitle ?? a.title).localeCompare(String(b.displayTitle ?? b.title), 'ko'),
  );

  // If we have strong full matches, prefer them; else return partials
  return scored.slice(0, limit);
}
