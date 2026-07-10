export function uniqueDocumentOrder(results) {
  const seen = new Set();
  const ordered = [];
  for (const result of results) {
    const id = result.documentId || result.slug;
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

export function hitAtK(retrievedDocs, expectedDocs, k) {
  if (!expectedDocs.length) {
    return null;
  }
  const top = retrievedDocs.slice(0, k);
  return expectedDocs.some((doc) => top.includes(doc)) ? 1 : 0;
}

export function recallAtK(retrievedDocs, expectedDocs, k) {
  if (!expectedDocs.length) {
    return null;
  }
  const top = new Set(retrievedDocs.slice(0, k));
  const hits = expectedDocs.filter((doc) => top.has(doc)).length;
  return hits / expectedDocs.length;
}

export function mrrAtK(retrievedDocs, expectedDocs, k = 5) {
  if (!expectedDocs.length) {
    return null;
  }
  const top = retrievedDocs.slice(0, k);
  for (let index = 0; index < top.length; index += 1) {
    if (expectedDocs.includes(top[index])) {
      return 1 / (index + 1);
    }
  }
  return 0;
}

export function ndcgAtK(retrievedDocs, expectedDocs, k = 5) {
  if (!expectedDocs.length) {
    return null;
  }
  const expected = new Set(expectedDocs);
  let dcg = 0;
  const top = retrievedDocs.slice(0, k);
  for (let index = 0; index < top.length; index += 1) {
    const rel = expected.has(top[index]) ? 1 : 0;
    dcg += rel / Math.log2(index + 2);
  }
  const idealCount = Math.min(expectedDocs.length, k);
  let idcg = 0;
  for (let index = 0; index < idealCount; index += 1) {
    idcg += 1 / Math.log2(index + 2);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}

export function keywordHitRate(text, keywords) {
  if (!keywords.length) {
    return null;
  }
  const hay = String(text || '').toLowerCase();
  const hits = keywords.filter((keyword) => hay.includes(String(keyword).toLowerCase())).length;
  return hits / keywords.length;
}

export function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function countDuplicates(results) {
  const ids = results.map((result) => result.documentId || result.slug).filter(Boolean);
  return ids.length - new Set(ids).size;
}
