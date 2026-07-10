#!/usr/bin/env node
/**
 * Baseline-preserving retrieval evaluation harness.
 * Does not modify operational hybrid search defaults or replace the live index.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { searchRelevantChunks } from './lib/rag-core.mjs';
import { collectGitMeta, nowStamp } from './lib/rag-eval/git-meta.mjs';
import {
  countDuplicates,
  hitAtK,
  keywordHitRate,
  mean,
  mrrAtK,
  ndcgAtK,
  percentile,
  recallAtK,
  uniqueDocumentOrder,
} from './lib/rag-eval/metrics.mjs';
import { evaluatePromotion } from './lib/rag-eval/promotion.mjs';
import { TAXONOMY_CODES, classifyFailures } from './lib/rag-eval/taxonomy.mjs';
import { parseSimpleYaml } from './lib/rag-eval/yaml.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const config = await loadYaml(join(ROOT, 'rag-evaluation/config/evaluation.yaml'));
  const policy = await loadYaml(join(ROOT, 'rag-evaluation/config/promotion-policy.yaml'));
  const experimentName = process.env.RAG_EXPERIMENT || config.experimentName || 'baseline-vector-search';
  const retrievalMode = process.env.RAG_RETRIEVAL_MODE || config.retrievalMode || 'baseline';
  const topK = Number(process.env.RAG_TOP_K || config.topK || 5);

  const datasetPath = join(ROOT, config.datasetPath || 'rag-evaluation/datasets/golden_queries.v1.jsonl');
  const indexPath = resolve(
    ROOT,
    process.env.RAG_INDEX_PATH || config.indexPath || 'data/ragVectorIndex.json',
  );
  const dataset = await loadJsonl(datasetPath);
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const git = collectGitMeta(ROOT);
  const stamp = nowStamp();
  const runId = `${stamp}_${git.gitCommit}_${experimentName}`;
  const runDir = join(ROOT, config.runsDir || 'rag-evaluation/runs', runId);
  await mkdir(runDir, { recursive: true });

  const environment = {
    node: process.version,
    platform: process.platform,
    evaluateAnswer: Boolean(config.evaluateAnswer),
    enableLlmAnswer: Boolean(config.enableLlmAnswer),
  };

  const manifest = {
    runId,
    timestamp: new Date().toISOString(),
    gitCommit: git.gitCommit,
    gitBranch: git.gitBranch,
    dirtyWorkingTree: git.dirtyWorkingTree,
    experimentName,
    retrievalMode,
    embeddingModel: index.embedding?.provider || 'local-hash-tfidf',
    embeddingDimension: index.embedding?.dimensions || index.chunks?.[0]?.embedding?.length || 0,
    chunkingVersion: config.chunkingVersion || 'section-blocks-v1',
    indexVersion: index.version ?? null,
    rerankerModel: retrievalMode === 'baseline' ? 'none' : 'hybrid-default',
    topK,
    datasetVersion: config.datasetVersion || 'golden_queries.v1',
    documentCount: new Set((index.chunks || []).map((chunk) => chunk.documentId)).size,
    chunkCount: (index.chunks || []).length,
    environment,
  };

  const perQuery = [];
  const failures = [];
  const latencies = [];
  const taxonomyCounts = Object.fromEntries(TAXONOMY_CODES.map((code) => [code, 0]));

  for (const caseRow of dataset) {
    const started = performance.now();
    const results = searchRelevantChunks(index, caseRow.query, {
      mode: retrievalMode,
      limit: topK,
      retrieveLimit: Number(config.retrieveLimit || 40),
      filters: caseRow.filters || {},
      pureVector: retrievalMode === 'baseline',
      debug: false,
    });
    const elapsed = performance.now() - started;
    latencies.push(elapsed);

    const retrievedDocs = uniqueDocumentOrder(results);
    const joinedText = results.map((result) => `${result.sectionTitle || ''} ${result.text || ''}`).join('\n');
    const keywordRate = keywordHitRate(joinedText, caseRow.expectedKeywords || []);
    const expected = caseRow.expectedDocumentSlugs || [];
    const answerable = caseRow.answerable !== false;

    const rowMetrics = {
      hitAt1: answerable ? hitAtK(retrievedDocs, expected, 1) : null,
      hitAt3: answerable ? hitAtK(retrievedDocs, expected, 3) : null,
      hitAt5: answerable ? hitAtK(retrievedDocs, expected, 5) : null,
      recallAt5: answerable ? recallAtK(retrievedDocs, expected, 5) : null,
      mrr: answerable ? mrrAtK(retrievedDocs, expected, 5) : null,
      ndcgAt5: answerable ? ndcgAtK(retrievedDocs, expected, 5) : null,
      keywordHitRate: keywordRate,
      duplicateCount: countDuplicates(results),
      // Pure vector baseline often returns weak positives; treat empty OR only weak scores as correct no-result.
      noResultCorrect: !answerable
        ? (results.length === 0 || Math.max(0, ...results.map((r) => Number(r.score) || 0)) < 0.08 ? 1 : 0)
        : null,
      metadataFilterOk: caseRow.filters && Object.keys(caseRow.filters).length
        ? results.every((result) => matchesFilters(result, caseRow.filters))
          ? 1
          : 0
        : null,
      latencyMs: Number(elapsed.toFixed(3)),
      retrievedChunkCount: results.length,
      retrievedDocumentSlugs: retrievedDocs,
      topScores: results.slice(0, topK).map((result) => ({
        documentId: result.documentId,
        section: result.sectionTitle || result.section,
        score: result.score,
      })),
    };

    const caseFailures = classifyFailures(caseRow, retrievedDocs, results, keywordRate);
    for (const failure of caseFailures) {
      taxonomyCounts[failure.code] = (taxonomyCounts[failure.code] || 0) + 1;
      failures.push({
        id: caseRow.id,
        query: caseRow.query,
        category: caseRow.category,
        code: failure.code,
        detail: failure.detail,
      });
    }

    perQuery.push({
      id: caseRow.id,
      query: caseRow.query,
      category: caseRow.category,
      difficulty: caseRow.difficulty,
      answerable,
      expectedDocumentSlugs: expected,
      metrics: rowMetrics,
      failures: caseFailures.map((failure) => failure.code),
    });
  }

  const answerableRows = perQuery.filter((row) => row.answerable);
  const unanswerableRows = perQuery.filter((row) => !row.answerable);
  const filterRows = perQuery.filter((row) => row.metrics.metadataFilterOk != null);

  const metrics = {
    queryCount: perQuery.length,
    answerableCount: answerableRows.length,
    unanswerableCount: unanswerableRows.length,
    hitAt1: mean(answerableRows.map((row) => row.metrics.hitAt1).filter((value) => value != null)),
    hitAt3: mean(answerableRows.map((row) => row.metrics.hitAt3).filter((value) => value != null)),
    hitAt5: mean(answerableRows.map((row) => row.metrics.hitAt5).filter((value) => value != null)),
    recallAt5: mean(answerableRows.map((row) => row.metrics.recallAt5).filter((value) => value != null)),
    mrr: mean(answerableRows.map((row) => row.metrics.mrr).filter((value) => value != null)),
    ndcgAt5: mean(answerableRows.map((row) => row.metrics.ndcgAt5).filter((value) => value != null)),
    metadataFilterAccuracy: filterRows.length
      ? mean(filterRows.map((row) => row.metrics.metadataFilterOk))
      : null,
    duplicateIncidentOrDocumentCount: perQuery.reduce((sum, row) => sum + (row.metrics.duplicateCount || 0), 0),
    noResultAccuracy: unanswerableRows.length
      ? mean(unanswerableRows.map((row) => row.metrics.noResultCorrect))
      : null,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    meanRetrievedChunks: mean(perQuery.map((row) => row.metrics.retrievedChunkCount)),
    failureTaxonomy: taxonomyCounts,
    // LLM answer metrics reserved (search-only stage)
    answerFaithfulness: null,
    citationAccuracy: null,
    answerRelevance: null,
    noAnswerAccuracy: null,
    meanInputTokens: null,
    meanOutputTokens: null,
    meanCost: null,
    p95EndToEndLatencyMs: null,
  };

  const bestPath = join(ROOT, config.bestPath || 'rag-evaluation/best.json');
  let best = null;
  if (await exists(bestPath)) {
    best = JSON.parse(await readFile(bestPath, 'utf8'));
  }
  const promotion = evaluatePromotion(metrics, best?.metrics || null, policy);

  const comparison = {
    against: best?.runId || null,
    promote: promotion.promote,
    reasons: promotion.reasons,
    regressions: promotion.regressions,
    candidate: pickComparable(metrics),
    best: best ? pickComparable(best.metrics) : null,
  };

  await writeJson(join(runDir, 'manifest.json'), manifest);
  await writeJson(join(runDir, 'config-snapshot.json'), { evaluation: config, promotion: policy });
  await writeJson(join(runDir, 'metrics.json'), metrics);
  await writeJsonl(join(runDir, 'per-query-results.jsonl'), perQuery);
  await writeJsonl(join(runDir, 'failures.jsonl'), failures);
  await writeJson(join(runDir, 'latency.json'), {
    samplesMs: latencies.map((value) => Number(value.toFixed(3))),
    p50: metrics.p50LatencyMs,
    p95: metrics.p95LatencyMs,
  });
  await writeJson(join(runDir, 'comparison.json'), comparison);
  await writeFile(join(runDir, 'report.md'), renderReport({ manifest, metrics, comparison, taxonomyCounts, failures }), 'utf8');

  // Seed/update baseline snapshot for named baseline experiment without deleting prior runs.
  if (experimentName === (config.baselineName || 'baseline-vector-search')) {
    const baselinePath = join(ROOT, config.baselinesDir || 'rag-evaluation/baselines', 'baseline-vector-search.json');
    await writeJson(baselinePath, { ...manifest, metrics, runDir: relativePosix(runDir) });
  }

  const updateBest = process.env.RAG_EVAL_UPDATE_BEST !== 'false';
  const shouldPromote = Boolean(promotion.promote && updateBest);
  if (shouldPromote) {
    await writeJson(bestPath, {
      runId,
      experimentName,
      retrievalMode,
      promotedAt: new Date().toISOString(),
      metrics,
      runDir: relativePosix(runDir),
      note: 'Search metrics only. Operational index not replaced by this harness.',
    });
  }

  await appendLeaderboard(join(ROOT, config.leaderboardPath || 'rag-evaluation/leaderboard.csv'), {
    runId,
    timestamp: manifest.timestamp,
    experimentName,
    retrievalMode,
    gitCommit: git.gitCommit,
    hitAt1: metrics.hitAt1,
    hitAt5: metrics.hitAt5,
    recallAt5: metrics.recallAt5,
    mrr: metrics.mrr,
    ndcgAt5: metrics.ndcgAt5,
    noResultAccuracy: metrics.noResultAccuracy,
    p95LatencyMs: metrics.p95LatencyMs,
    promoted: shouldPromote,
  });

  await writeFailureTaxonomyCsv(join(ROOT, config.failureTaxonomyPath || 'rag-evaluation/failure-taxonomy.csv'), taxonomyCounts);
  await writeFile(
    join(ROOT, config.latestPath || 'rag-evaluation/latest.md'),
    renderLatest({ manifest, metrics, comparison, runDir: relativePosix(runDir) }),
    'utf8',
  );

  const summary = {
    runId,
    runDir: relativePosix(runDir),
    promoted: shouldPromote,
    eligibleForPromotion: promotion.promote,
    hitAt5: round4(metrics.hitAt5),
    recallAt5: round4(metrics.recallAt5),
    mrr: round4(metrics.mrr),
    ndcgAt5: round4(metrics.ndcgAt5),
    noResultAccuracy: round4(metrics.noResultAccuracy),
    p95LatencyMs: round4(metrics.p95LatencyMs),
    topFailures: Object.entries(taxonomyCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
  console.log(JSON.stringify(summary, null, 2));
  // Machine-parseable single line for experiment runners
  console.log(`EVAL_SUMMARY_JSON:${JSON.stringify(summary)}`);
}

function matchesFilters(chunk, filters) {
  if (filters.category && chunk.category !== filters.category) {
    return false;
  }
  return true;
}

function pickComparable(metrics) {
  return {
    hitAt1: metrics.hitAt1,
    hitAt3: metrics.hitAt3,
    hitAt5: metrics.hitAt5,
    recallAt5: metrics.recallAt5,
    mrr: metrics.mrr,
    ndcgAt5: metrics.ndcgAt5,
    metadataFilterAccuracy: metrics.metadataFilterAccuracy,
    noResultAccuracy: metrics.noResultAccuracy,
    p95LatencyMs: metrics.p95LatencyMs,
    duplicateIncidentOrDocumentCount: metrics.duplicateIncidentOrDocumentCount,
  };
}

function renderReport({ manifest, metrics, comparison, taxonomyCounts, failures }) {
  const topTax = Object.entries(taxonomyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `- ${code}: ${count}`)
    .join('\n');
  const sampleFailures = failures.slice(0, 15)
    .map((failure) => `- ${failure.id} [${failure.code}] ${failure.detail}`)
    .join('\n');
  return `# Retrieval Eval Report

## Manifest
- runId: ${manifest.runId}
- experiment: ${manifest.experimentName}
- retrievalMode: ${manifest.retrievalMode}
- git: ${manifest.gitBranch}@${manifest.gitCommit} dirty=${manifest.dirtyWorkingTree}
- dataset: ${manifest.datasetVersion}
- docs/chunks: ${manifest.documentCount}/${manifest.chunkCount}
- embedding: ${manifest.embeddingModel} dim=${manifest.embeddingDimension}

## Metrics (search only)
| Metric | Value |
| --- | ---: |
| Hit@1 | ${round4(metrics.hitAt1)} |
| Hit@3 | ${round4(metrics.hitAt3)} |
| Hit@5 | ${round4(metrics.hitAt5)} |
| Recall@5 | ${round4(metrics.recallAt5)} |
| MRR | ${round4(metrics.mrr)} |
| nDCG@5 | ${round4(metrics.ndcgAt5)} |
| Metadata Filter Accuracy | ${round4(metrics.metadataFilterAccuracy)} |
| No-result Accuracy | ${round4(metrics.noResultAccuracy)} |
| Duplicate count | ${metrics.duplicateIncidentOrDocumentCount} |
| p50 latency ms | ${round4(metrics.p50LatencyMs)} |
| p95 latency ms | ${round4(metrics.p95LatencyMs)} |
| mean retrieved chunks | ${round4(metrics.meanRetrievedChunks)} |

LLM answer metrics were not evaluated in this run (evaluateAnswer=false).

## Promotion
- promote: ${comparison.promote}
- reasons: ${comparison.reasons.join('; ') || 'n/a'}
- regressions: ${comparison.regressions.join('; ') || 'none'}

## Failure taxonomy
${topTax}

## Sample failures
${sampleFailures || '- none'}
`;
}

function renderLatest({ manifest, metrics, comparison, runDir }) {
  return `# Latest retrieval evaluation

- runId: \`${manifest.runId}\`
- runDir: \`${runDir}\`
- experiment: **${manifest.experimentName}** (\`${manifest.retrievalMode}\`)
- Hit@5: **${round4(metrics.hitAt5)}** · Recall@5: **${round4(metrics.recallAt5)}** · MRR: **${round4(metrics.mrr)}**
- No-result Accuracy: **${round4(metrics.noResultAccuracy)}** · p95: **${round4(metrics.p95LatencyMs)} ms**
- promoted: **${comparison.promote}**
- operational index replaced: **false** (policy)
`;
}

async function appendLeaderboard(path, row) {
  const header = 'runId,timestamp,experimentName,retrievalMode,gitCommit,hitAt1,hitAt5,recallAt5,mrr,ndcgAt5,noResultAccuracy,p95LatencyMs,promoted\n';
  let existing = '';
  if (await exists(path)) {
    existing = await readFile(path, 'utf8');
  } else {
    existing = header;
  }
  if (!existing.startsWith('runId,')) {
    existing = header + existing;
  }
  const line = [
    row.runId,
    row.timestamp,
    row.experimentName,
    row.retrievalMode,
    row.gitCommit,
    round4(row.hitAt1),
    round4(row.hitAt5),
    round4(row.recallAt5),
    round4(row.mrr),
    round4(row.ndcgAt5),
    round4(row.noResultAccuracy),
    round4(row.p95LatencyMs),
    row.promoted,
  ].join(',');
  await writeFile(path, `${existing.trimEnd()}\n${line}\n`, 'utf8');
}

async function writeFailureTaxonomyCsv(path, counts) {
  const lines = ['code,count'];
  for (const code of TAXONOMY_CODES) {
    lines.push(`${code},${counts[code] || 0}`);
  }
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
}

async function loadYaml(path) {
  const text = await readFile(path, 'utf8');
  return parseSimpleYaml(text);
}

async function loadJsonl(path) {
  const text = await readFile(path, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonl(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function relativePosix(path) {
  return path.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/');
}

function round4(value) {
  if (value == null || Number.isNaN(value)) {
    return '';
  }
  return Number(value.toFixed(4));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
