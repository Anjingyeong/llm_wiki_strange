/**
 * Automatic failure taxonomy for retrieval-only evaluation.
 * Search failures are classified independently from LLM answer quality.
 */
export function classifyFailures(caseRow, retrievedDocs, results, keywordRate) {
  const failures = [];
  const expected = caseRow.expectedDocumentSlugs || [];
  const answerable = caseRow.answerable !== false;
  const top1 = retrievedDocs[0] || null;
  const top5 = retrievedDocs.slice(0, 5);
  const scores = results.map((result) => Number(result.score || 0));
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const duplicateCount = results.length - new Set(results.map((r) => r.documentId || r.slug)).size;

  if (!answerable) {
    if (results.length > 0 && maxScore >= 0.08) {
      failures.push({ code: 'NO_ANSWER_FAILURE', detail: `unanswerable query returned chunks maxScore=${maxScore}` });
    }
    return failures;
  }

  if (retrievedDocs.length === 0) {
    failures.push({ code: 'EXPECTED_DOC_NOT_RETRIEVED', detail: 'no chunks returned' });
    return failures;
  }

  const anyExpected = expected.some((doc) => retrievedDocs.includes(doc));
  if (expected.length && !anyExpected) {
    failures.push({ code: 'EXPECTED_DOC_NOT_RETRIEVED', detail: `expected one of ${expected.join(', ')}` });
  }

  if (expected.length && top1 && !expected.includes(top1) && expected.some((doc) => top5.includes(doc))) {
    failures.push({ code: 'WRONG_TOP1', detail: `top1=${top1}` });
  }

  if (expected.length && anyExpected && maxScore < 0.12) {
    failures.push({ code: 'LOW_SIMILARITY', detail: `maxScore=${maxScore}` });
  }

  if (Array.isArray(caseRow.expectedKeywords) && caseRow.expectedKeywords.length) {
    if (keywordRate != null && keywordRate < 0.34) {
      failures.push({ code: 'KEYWORD_MISS', detail: `keywordHitRate=${keywordRate}` });
    }
  }

  if (expected.length && !anyExpected && maxScore >= 0.12) {
    failures.push({ code: 'SEMANTIC_MISS', detail: 'vector returned unrelated high scores' });
  }

  if (caseRow.filters && Object.keys(caseRow.filters).length > 0) {
    const filterOk = results.every((result) => matchesFilters(result, caseRow.filters));
    if (!filterOk) {
      failures.push({ code: 'FILTER_FAILURE', detail: JSON.stringify(caseRow.filters) });
    }
  }

  if (duplicateCount > 0) {
    failures.push({ code: 'DUPLICATE_RESULT', detail: `duplicates=${duplicateCount}` });
  }

  if (expected.length > 1 && top1) {
    // Prefer newer docs when both expected: weak signal only when oldest expected wins top1 and newer also expected
    const newer = pickLikelyNewer(expected);
    if (newer && top1 !== newer && expected.includes(top1) && expected.includes(newer) && !top5.includes(newer)) {
      failures.push({ code: 'STALE_DOCUMENT_SELECTED', detail: `top1=${top1} missing newer=${newer}` });
    }
  }

  return failures;
}

function matchesFilters(chunk, filters) {
  if (filters.category && chunk.category !== filters.category) {
    return false;
  }
  if (filters.tag) {
    const tags = Array.isArray(chunk.tags) ? chunk.tags : [];
    if (!tags.map(String).includes(String(filters.tag))) {
      return false;
    }
  }
  return true;
}

function pickLikelyNewer(slugs) {
  const dated = slugs
    .map((slug) => {
      const match = String(slug).match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? { slug, date: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
  return dated[0]?.slug || null;
}

export const TAXONOMY_CODES = [
  'EXPECTED_DOC_NOT_RETRIEVED',
  'WRONG_TOP1',
  'LOW_SIMILARITY',
  'KEYWORD_MISS',
  'SEMANTIC_MISS',
  'FILTER_FAILURE',
  'DUPLICATE_RESULT',
  'NO_ANSWER_FAILURE',
  'STALE_DOCUMENT_SELECTED',
];
