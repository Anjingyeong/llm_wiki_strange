#!/usr/bin/env node
/**
 * Stage-3 Hybrid Search experiment vs frozen Stage-2 structure-aware vector-only best.
 * Does not update operational best/pointer unless promotion policy passes.
 */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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
const SCRATCH = process.env.SCRATCH || 'C:/Users/user/AppData/Local/Temp/grok-goal-85250e9fc28f/implementer';

function gitShort() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: ROOT }).trim();
  } catch {
    return 'unknown';
  }
}

async function loadJsonl(path) {
  const text = await readFile(path, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function main() {
  await mkdir(SCRATCH, { recursive: true });
  const config = parseSimpleYaml(await readFile(join(ROOT, 'rag-evaluation/config/hybrid-stage3.yaml'), 'utf8'));
  const policy = parseSimpleYaml(await readFile(join(ROOT, 'rag-evaluation/config/promotion-policy.yaml'), 'utf8'));
  const dataset = await loadJsonl(join(ROOT, config.datasetPath || 'rag-evaluation/datasets/golden_queries.v1.jsonl'));
  const vectorIndex = JSON.parse(await readFile(join(ROOT, config.vectorIndexPath), 'utf8'));
  const contextualIndex = JSON.parse(await readFile(join(ROOT, config.contextualIndexPath), 'utf8'));
  const stage2Best = JSON.parse(await readFile(join(ROOT, 'rag-evaluation/best.json'), 'utf8'));
  const stage2Snap = JSON.parse(await readFile(join(SCRATCH, 'stage2-baseline-snapshot.txt'), 'utf8').catch(async () => {
    // inline minimal snap if missing
    return JSON.stringify({ samples: {}, metrics: stage2Best.metrics });
  }).then((t) => (typeof t === 'string' ? t : JSON.stringify(t))).catch(() => null));

  let stage2Samples = {};
  try {
    stage2Samples = JSON.parse(await readFile(join(SCRATCH, 'stage2-baseline-snapshot.txt'), 'utf8')).samples;
  } catch {
    stage2Samples = {};
  }

  const git = collectGitMeta(ROOT);
  const stamp = nowStamp();
  const runId = `${stamp}_${git.gitCommit || gitShort()}_hybrid-stage3`;
  const runDir = join(ROOT, 'rag-evaluation/runs', runId);
  await mkdir(runDir, { recursive: true });

  const topK = Number(config.topK || 5);
  const rrfGrid = normalizeGrid(config.rrfGrid, [
    { id: 'rrf60-bal', rrfK: 60, lexicalWeight: 1.0, vectorWeight: 1.0 },
  ]);
  const diversifyMap = {
    off: { maxChunksPerDocument: 0, documentDeduplication: false, headingDiversity: false },
    max1: { maxChunksPerDocument: 1, documentDeduplication: true, headingDiversity: false },
    max2: { maxChunksPerDocument: 2, documentDeduplication: true, headingDiversity: false },
  };

  // 1) RRF micro-sweep on hybrid-raw (no diversify) using structure-aware index
  const rrfSweep = [];
  for (const rrf of rrfGrid) {
    const evalResult = evaluateCandidate({
      id: `rrf-sweep-${rrf.id}`,
      mode: 'hybrid-raw',
      index: vectorIndex,
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: rrf.rrfK,
        lexicalWeight: rrf.lexicalWeight,
        vectorWeight: rrf.vectorWeight,
        lexicalTopN: config.lexicalTopN || 30,
        vectorTopN: config.vectorTopN || 30,
        diversifyConfig: null,
        maxChunksPerDocument: undefined,
      },
      dataset,
      topK,
    });
    rrfSweep.push({ ...rrf, metrics: evalResult.metrics, wrongTop1Count: evalResult.metrics.wrongTop1Count });
  }
  rrfSweep.sort((a, b) => (b.metrics.recallAt5 - a.metrics.recallAt5) || (b.metrics.mrr - a.metrics.mrr));
  const bestRrf = rrfSweep[0];

  // 2) Named candidates
  const candidateDefs = [
    {
      id: 'vector-only-structure-aware',
      mode: 'baseline',
      indexKey: 'vector',
      searchOptions: { mode: 'baseline', stage3: true },
    },
    {
      id: 'lexical-only',
      mode: 'lexical',
      indexKey: 'vector',
      searchOptions: { mode: 'lexical', stage3: true },
    },
    {
      id: 'hybrid-rrf',
      mode: 'hybrid-raw',
      indexKey: 'vector',
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: bestRrf.rrfK,
        lexicalWeight: bestRrf.lexicalWeight,
        vectorWeight: bestRrf.vectorWeight,
        lexicalTopN: 30,
        vectorTopN: 30,
        pureVector: true,
      },
    },
    {
      id: 'hybrid-diversify-max1',
      mode: 'hybrid-raw',
      indexKey: 'vector',
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: bestRrf.rrfK,
        lexicalWeight: bestRrf.lexicalWeight,
        vectorWeight: bestRrf.vectorWeight,
        diversifyConfig: diversifyMap.max1,
        maxChunksPerDocument: 1,
        pureVector: true,
      },
    },
    {
      id: 'hybrid-diversify-max2',
      mode: 'hybrid-raw',
      indexKey: 'vector',
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: bestRrf.rrfK,
        lexicalWeight: bestRrf.lexicalWeight,
        vectorWeight: bestRrf.vectorWeight,
        diversifyConfig: diversifyMap.max2,
        maxChunksPerDocument: 2,
        pureVector: true,
      },
    },
    {
      id: 'hybrid-contextual',
      mode: 'hybrid-raw',
      indexKey: 'contextual',
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: bestRrf.rrfK,
        lexicalWeight: bestRrf.lexicalWeight,
        vectorWeight: bestRrf.vectorWeight,
        pureVector: true,
      },
    },
    {
      id: 'hybrid-contextual-diversify-max2',
      mode: 'hybrid-raw',
      indexKey: 'contextual',
      searchOptions: {
        mode: 'hybrid-raw',
        stage3: true,
        rrfK: bestRrf.rrfK,
        lexicalWeight: bestRrf.lexicalWeight,
        vectorWeight: bestRrf.vectorWeight,
        diversifyConfig: diversifyMap.max2,
        maxChunksPerDocument: 2,
        pureVector: true,
      },
    },
  ];

  const candidateResults = [];
  for (const def of candidateDefs) {
    const index = def.indexKey === 'contextual' ? contextualIndex : vectorIndex;
    const evaluated = evaluateCandidate({
      id: def.id,
      mode: def.mode,
      index,
      searchOptions: def.searchOptions,
      dataset,
      topK,
    });
    candidateResults.push({
      id: def.id,
      mode: def.mode,
      indexKey: def.indexKey,
      searchOptions: def.searchOptions,
      ...evaluated,
    });
    console.log(
      JSON.stringify({
        candidate: def.id,
        hitAt5: round4(evaluated.metrics.hitAt5),
        recallAt5: round4(evaluated.metrics.recallAt5),
        mrr: round4(evaluated.metrics.mrr),
        wrongTop1: evaluated.metrics.wrongTop1Count,
        duplicates: evaluated.metrics.duplicateIncidentOrDocumentCount,
      }),
    );
  }

  const baseline = candidateResults.find((row) => row.id === 'vector-only-structure-aware');
  const promotions = candidateResults
    .filter((row) => row.id !== 'vector-only-structure-aware')
    .map((row) => {
      const vsBest = evaluatePromotion(
        {
          ...row.metrics,
          wrongTop1Count: row.metrics.wrongTop1Count,
        },
        {
          ...stage2Best.metrics,
          wrongTop1Count: stage2Best.metrics.wrongTop1Count
            ?? stage2Best.metrics.failureTaxonomy?.WRONG_TOP1
            ?? 11,
          duplicateIncidentOrDocumentCount:
            stage2Best.metrics.duplicateIncidentOrDocumentCount ?? 140,
        },
        policy,
      );
      return { id: row.id, ...vsBest, metrics: row.metrics };
    });

  const promotable = promotions
    .filter((row) => row.promote)
    .sort((a, b) => (b.metrics.recallAt5 - a.metrics.recallAt5) || (b.metrics.mrr - a.metrics.mrr));

  let promotionResult = {
    promoted: false,
    selected: null,
    note: 'No Stage-3 candidate beat Stage-2 structure-aware vector-only under policy (incl. wrongTop1/duplicates).',
  };

  if (promotable.length > 0) {
    const selected = promotable[0];
    const full = candidateResults.find((row) => row.id === selected.id);
    // Profiles if multiple pass
    const profiles = {
      quality: promotable[0]?.id || null,
      balanced: promotable.slice().sort((a, b) => (a.metrics.p95LatencyMs ?? 0) - (b.metrics.p95LatencyMs ?? 0) || (b.metrics.mrr - a.metrics.mrr))[0]?.id || null,
      fast: candidateResults.slice().sort((a, b) => (a.metrics.p95LatencyMs ?? 99) - (b.metrics.p95LatencyMs ?? 99))[0]?.id || null,
    };
    await writeFile(
      join(ROOT, 'rag-evaluation/best.json'),
      `${JSON.stringify({
        runId,
        experimentName: selected.id,
        retrievalMode: full.mode,
        promotedAt: new Date().toISOString(),
        metrics: full.metrics,
        runDir: relativePosix(runDir),
        chunkSchemaVersion: full.indexKey === 'contextual' ? 'structure-aware-contextual-v1' : 'structure-aware-v1',
        retrievalProfile: selected.id,
        profiles,
        rrf: bestRrf,
        note: 'Stage-3 hybrid promotion (search-only).',
      }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      join(ROOT, 'data/rag/retrieval-config.json'),
      `${JSON.stringify({
        profile: selected.id,
        mode: full.mode,
        rrfK: full.searchOptions.rrfK ?? null,
        lexicalWeight: full.searchOptions.lexicalWeight ?? null,
        vectorWeight: full.searchOptions.vectorWeight ?? null,
        diversify: full.searchOptions.diversifyConfig ?? null,
        indexKey: full.indexKey,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      'utf8',
    );
    if (full.indexKey === 'contextual') {
      await writeFile(
        join(ROOT, 'data/rag/current-index.json'),
        `${JSON.stringify({
          chunkSchemaVersion: 'structure-aware-contextual-v1',
          indexPath: 'data/rag/indexes/structure-aware-contextual-v1.json',
          updatedAt: new Date().toISOString(),
          note: 'Promoted by Stage-3 hybrid experiment',
        }, null, 2)}\n`,
        'utf8',
      );
      await copyFile(
        join(ROOT, 'data/rag/indexes/structure-aware-contextual-v1.json'),
        join(ROOT, 'data/ragVectorIndex.json'),
      );
    }
    promotionResult = {
      promoted: true,
      selected: selected.id,
      profiles,
      note: 'best.json and retrieval-config updated; index pointer updated only if contextual index required.',
    };
  }

  // Improved / worsened queries vs vector baseline
  const improved = [];
  const worsened = [];
  for (let i = 0; i < dataset.length; i += 1) {
    const baseRow = baseline.perQuery[i];
    for (const cand of candidateResults) {
      if (cand.id === baseline.id) continue;
      const row = cand.perQuery[i];
      const baseHit = baseRow.metrics.hitAt5 || 0;
      const candHit = row.metrics.hitAt5 || 0;
      if (candHit > baseHit) {
        improved.push({ id: dataset[i].id, query: dataset[i].query, candidate: cand.id, from: baseHit, to: candHit });
      } else if (candHit < baseHit) {
        worsened.push({ id: dataset[i].id, query: dataset[i].query, candidate: cand.id, from: baseHit, to: candHit, failures: row.failures });
      }
    }
  }
  const topImproved = uniqueById(improved).slice(0, 10);
  const topWorsened = uniqueById(worsened).slice(0, 10);

  const comparison = {
    stage2Best: {
      experimentName: stage2Best.experimentName,
      metrics: {
        hitAt5: stage2Best.metrics.hitAt5,
        recallAt5: stage2Best.metrics.recallAt5,
        mrr: stage2Best.metrics.mrr,
        ndcgAt5: stage2Best.metrics.ndcgAt5,
        wrongTop1Count: stage2Best.metrics.failureTaxonomy?.WRONG_TOP1 ?? stage2Best.metrics.wrongTop1Count,
        duplicateIncidentOrDocumentCount: stage2Best.metrics.duplicateIncidentOrDocumentCount,
      },
      failureSamples: stage2Samples,
    },
    bestRrf,
    rrfSweep: rrfSweep.map((row) => ({
      id: row.id,
      rrfK: row.rrfK,
      lexicalWeight: row.lexicalWeight,
      vectorWeight: row.vectorWeight,
      hitAt5: row.metrics.hitAt5,
      recallAt5: row.metrics.recallAt5,
      mrr: row.metrics.mrr,
      wrongTop1Count: row.metrics.wrongTop1Count,
    })),
    candidates: candidateResults.map((row) => ({
      id: row.id,
      metrics: row.metrics,
      byCategory: row.byCategory,
      overlapMean: row.metrics.lexicalVectorOverlap,
    })),
    promotions,
    promotionResult,
    topImproved,
    topWorsened,
  };

  // Aggregate score distributions from best hybrid candidate for reporting
  const primaryHybrid = candidateResults.find((row) => row.id === 'hybrid-rrf') || baseline;
  const scoreDistributions = primaryHybrid.scoreDistributions;

  const manifest = {
    runId,
    timestamp: new Date().toISOString(),
    gitCommit: git.gitCommit,
    gitBranch: git.gitBranch,
    dirtyWorkingTree: git.dirtyWorkingTree,
    experimentName: 'hybrid-stage3',
    datasetVersion: config.datasetVersion,
    stage2Anchor: stage2Best.experimentName,
    stage2FailureTaxonomy: stage2Best.metrics.failureTaxonomy,
    stage2FailureSamples: stage2Samples,
    bestRrf,
    candidates: candidateResults.map((row) => row.id),
    documentCount: new Set(vectorIndex.chunks.map((c) => c.documentId)).size,
    chunkCount: vectorIndex.chunks.length,
    contextualChunkCount: contextualIndex.chunks.length,
    embeddingModel: vectorIndex.embedding?.provider,
    embeddingDimension: vectorIndex.embedding?.dimensions,
    chunkSchemaVersion: vectorIndex.chunkSchemaVersion,
    environment: { node: process.version, platform: process.platform },
  };

  await writeJson(join(runDir, 'manifest.json'), manifest);
  await writeJson(join(runDir, 'config-snapshot.json'), { hybridStage3: config, promotion: policy, bestRrf });
  await writeJson(join(runDir, 'metrics.json'), {
    candidates: Object.fromEntries(candidateResults.map((row) => [row.id, row.metrics])),
    byCategory: Object.fromEntries(candidateResults.map((row) => [row.id, row.byCategory])),
    bestRrf,
  });
  await writeJsonl(
    join(runDir, 'per-query-results.jsonl'),
    dataset.map((q, index) => ({
      id: q.id,
      query: q.query,
      category: q.category,
      answerable: q.answerable !== false,
      byCandidate: Object.fromEntries(candidateResults.map((cand) => [cand.id, cand.perQuery[index]])),
    })),
  );
  await writeJsonl(
    join(runDir, 'failures.jsonl'),
    candidateResults.flatMap((cand) => cand.failures.map((f) => ({ ...f, candidate: cand.id }))),
  );
  await writeJson(join(runDir, 'score-distributions.json'), scoreDistributions);
  await writeJson(join(runDir, 'comparison.json'), comparison);

  const report = renderReport({
    manifest,
    stage2Best,
    stage2Samples,
    baseline,
    candidateResults,
    bestRrf,
    rrfSweep,
    promotionResult,
    promotions,
    topImproved,
    topWorsened,
    scoreDistributions,
  });
  await writeFile(join(runDir, 'report.md'), report, 'utf8');

  await mkdir(join(ROOT, 'rag-evaluation/experiments'), { recursive: true });
  await writeFile(join(ROOT, 'rag-evaluation/experiments/hybrid-stage3-latest.md'), report, 'utf8');
  await writeJson(join(ROOT, 'rag-evaluation/experiments/hybrid-stage3-latest.json'), {
    runId,
    promotionResult,
    bestRrf,
    candidates: candidateResults.map((row) => ({ id: row.id, metrics: row.metrics, byCategory: row.byCategory })),
    comparison,
  });
  await writeFile(join(ROOT, 'rag-evaluation/latest.md'), `# Latest evaluation\n\nStage-3 hybrid run \`${runId}\`\n\n${promotionResult.promoted ? `Promoted: **${promotionResult.selected}**` : 'No promotion — Stage-2 structure-aware vector-only remains best.'}\n`, 'utf8');

  // leaderboard append
  await appendLeaderboard(candidateResults, runId, git.gitCommit);

  try {
    await writeFile(join(SCRATCH, 'stage3-experiment.log'), report, 'utf8');
    await writeJson(join(SCRATCH, 'stage3-promotion.json'), promotionResult);
    await writeJson(join(SCRATCH, 'stage3-mode-smoke.json'), {
      bestRrf,
      sample: candidateResults.map((row) => ({ id: row.id, hitAt5: row.metrics.hitAt5, mrr: row.metrics.mrr })),
    });
  } catch (error) {
    console.warn('scratch write skipped:', error.message);
  }

  console.log(JSON.stringify({ runId, runDir: relativePosix(runDir), promotionResult, bestRrf, leaderboard: candidateResults.map((r) => ({ id: r.id, hitAt5: r.metrics.hitAt5, recallAt5: r.metrics.recallAt5, mrr: r.metrics.mrr })) }, null, 2));
}

function evaluateCandidate({ id, mode, index, searchOptions, dataset, topK }) {
  const perQuery = [];
  const failures = [];
  const latencies = [];
  const taxonomyCounts = Object.fromEntries(TAXONOMY_CODES.map((code) => [code, 0]));
  const answerableScores = { top1: [], top5Max: [] };
  const unanswerableScores = { top1: [], top5Max: [] };
  const overlaps = [];
  let wrongTop1Count = 0;
  let exactTermHit5 = [];
  let semanticRecall5 = [];

  for (const caseRow of dataset) {
    const started = performance.now();
    const results = searchRelevantChunks(index, caseRow.query, {
      ...searchOptions,
      limit: topK,
      retrieveLimit: 40,
      filters: caseRow.filters || {},
      debug: true,
    });
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    const debug = results.debug || {};
    const retrievedDocs = uniqueDocumentOrder(results);
    const scores = results.map((r) => Number(r.rawScore ?? r.score ?? 0));
    const top1Score = scores[0] ?? 0;
    const top5Max = scores.length ? Math.max(...scores.slice(0, 5)) : 0;
    if (caseRow.answerable !== false) {
      answerableScores.top1.push(top1Score);
      answerableScores.top5Max.push(top5Max);
    } else {
      unanswerableScores.top1.push(top1Score);
      unanswerableScores.top5Max.push(top5Max);
    }
    if (debug.overlap) {
      const den = Math.max(1, (debug.overlap.lexicalCount || 0) + (debug.overlap.vectorCount || 0));
      overlaps.push((2 * (debug.overlap.intersection || 0)) / den);
    }

    const joinedText = results.map((r) => `${r.sectionTitle || ''} ${r.text || r.content || ''}`).join('\n');
    const keywordRate = keywordHitRate(joinedText, caseRow.expectedKeywords || []);
    const expected = caseRow.expectedDocumentSlugs || [];
    const answerable = caseRow.answerable !== false;
    const hit5 = answerable ? hitAtK(retrievedDocs, expected, 5) : null;
    const hit1 = answerable ? hitAtK(retrievedDocs, expected, 1) : null;
    if (answerable && expected.length && hit5 === 1 && hit1 === 0) {
      wrongTop1Count += 1;
    }
    if (caseRow.category === 'exact-term' && answerable) {
      exactTermHit5.push(hit5 ?? 0);
    }
    if (['paraphrase', 'decision', 'multi-doc', 'mixed-lang'].includes(caseRow.category) && answerable) {
      semanticRecall5.push(recallAtK(retrievedDocs, expected, 5) ?? 0);
    }

    const caseFailures = classifyFailures(caseRow, retrievedDocs, results, keywordRate);
    // ensure DUPLICATE counted via chunk list
    if (countDuplicates(results) > 0 && !caseFailures.some((f) => f.code === 'DUPLICATE_RESULT')) {
      caseFailures.push({ code: 'DUPLICATE_RESULT', detail: `duplicates=${countDuplicates(results)}` });
    }
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
      answerable,
      expectedDocumentSlugs: expected,
      metrics: {
        hitAt1: hit1,
        hitAt3: answerable ? hitAtK(retrievedDocs, expected, 3) : null,
        hitAt5: hit5,
        recallAt5: answerable ? recallAtK(retrievedDocs, expected, 5) : null,
        mrr: answerable ? mrrAtK(retrievedDocs, expected, 5) : null,
        ndcgAt5: answerable ? ndcgAtK(retrievedDocs, expected, 5) : null,
        keywordHitRate: keywordRate,
        duplicateCount: countDuplicates(results),
        wrongTop1: answerable && expected.length && hit5 === 1 && hit1 === 0 ? 1 : 0,
        noResultCorrect:
          !answerable ? (results.length === 0 || top1Score < 0.08 ? 1 : 0) : null,
        metadataFilterOk:
          caseRow.filters && Object.keys(caseRow.filters).length
            ? results.every((r) => !caseRow.filters.category || r.category === caseRow.filters.category)
              ? 1
              : 0
            : null,
        latencyMs: Number(elapsed.toFixed(3)),
        retrievedChunkCount: results.length,
        retrievedDocumentSlugs: retrievedDocs,
        topScores: results.slice(0, topK).map((r) => ({
          documentId: r.documentId,
          section: r.sectionTitle || r.headingPath,
          score: r.score,
          rawScore: r.rawScore ?? r.score,
        })),
      },
      failures: caseFailures.map((f) => f.code),
    });
  }

  const answerableRows = perQuery.filter((row) => row.answerable);
  const unanswerableRows = perQuery.filter((row) => !row.answerable);
  const filterRows = perQuery.filter((row) => row.metrics.metadataFilterOk != null);

  const byCategory = {};
  for (const row of perQuery) {
    const cat = row.category || 'unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(row);
  }
  const categoryMetrics = {};
  for (const [cat, rows] of Object.entries(byCategory)) {
    const ans = rows.filter((r) => r.answerable);
    categoryMetrics[cat] = {
      count: rows.length,
      hitAt5: mean(ans.map((r) => r.metrics.hitAt5).filter((v) => v != null)),
      recallAt5: mean(ans.map((r) => r.metrics.recallAt5).filter((v) => v != null)),
      mrr: mean(ans.map((r) => r.metrics.mrr).filter((v) => v != null)),
      wrongTop1Count: ans.reduce((s, r) => s + (r.metrics.wrongTop1 || 0), 0),
    };
  }

  const metrics = {
    queryCount: perQuery.length,
    answerableCount: answerableRows.length,
    unanswerableCount: unanswerableRows.length,
    hitAt1: mean(answerableRows.map((r) => r.metrics.hitAt1).filter((v) => v != null)),
    hitAt3: mean(answerableRows.map((r) => r.metrics.hitAt3).filter((v) => v != null)),
    hitAt5: mean(answerableRows.map((r) => r.metrics.hitAt5).filter((v) => v != null)),
    recallAt5: mean(answerableRows.map((r) => r.metrics.recallAt5).filter((v) => v != null)),
    mrr: mean(answerableRows.map((r) => r.metrics.mrr).filter((v) => v != null)),
    ndcgAt5: mean(answerableRows.map((r) => r.metrics.ndcgAt5).filter((v) => v != null)),
    exactTermHitAt5: exactTermHit5.length ? mean(exactTermHit5) : null,
    semanticQueryRecallAt5: semanticRecall5.length ? mean(semanticRecall5) : null,
    metadataFilterAccuracy: filterRows.length ? mean(filterRows.map((r) => r.metrics.metadataFilterOk)) : null,
    duplicateIncidentOrDocumentCount: perQuery.reduce((s, r) => s + (r.metrics.duplicateCount || 0), 0),
    wrongTop1Count,
    noResultAccuracy: unanswerableRows.length
      ? mean(unanswerableRows.map((r) => r.metrics.noResultCorrect))
      : null,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    meanRetrievedChunks: mean(perQuery.map((r) => r.metrics.retrievedChunkCount)),
    lexicalVectorOverlap: overlaps.length ? mean(overlaps) : null,
    failureTaxonomy: taxonomyCounts,
  };

  const scoreDistributions = {
    answerable: {
      top1: summarizeScores(answerableScores.top1),
      top5Max: summarizeScores(answerableScores.top5Max),
    },
    unanswerable: {
      top1: summarizeScores(unanswerableScores.top1),
      top5Max: summarizeScores(unanswerableScores.top5Max),
    },
    // threshold not finalized — illustrative only
    notes: 'No-result threshold not finalized in Stage-3; distributions for calibration only.',
  };

  return {
    metrics,
    perQuery,
    failures,
    byCategory: categoryMetrics,
    scoreDistributions,
  };
}

function summarizeScores(values) {
  if (!values.length) return { count: 0 };
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: mean(values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function normalizeGrid(raw, fallback) {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((item, index) => ({
      id: item.id || `rrf-${index}`,
      rrfK: Number(item.rrfK ?? 60),
      lexicalWeight: Number(item.lexicalWeight ?? 1),
      vectorWeight: Number(item.vectorWeight ?? 1),
    }));
  }
  // yaml parser may produce object map for list-like structures
  if (raw && typeof raw === 'object') {
    return Object.values(raw).map((item, index) => ({
      id: item.id || `rrf-${index}`,
      rrfK: Number(item.rrfK ?? 60),
      lexicalWeight: Number(item.lexicalWeight ?? 1),
      vectorWeight: Number(item.vectorWeight ?? 1),
    }));
  }
  return fallback;
}

function uniqueById(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.id}:${row.candidate || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function round4(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(Number(value).toFixed(4));
}

function relativePosix(path) {
  return path.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/');
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonl(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

async function appendLeaderboard(candidates, runId, gitCommit) {
  const path = join(ROOT, 'rag-evaluation/leaderboard.csv');
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    existing = 'runId,timestamp,experimentName,retrievalMode,gitCommit,hitAt1,hitAt5,recallAt5,mrr,ndcgAt5,noResultAccuracy,p95LatencyMs,promoted\n';
  }
  const ts = new Date().toISOString();
  const lines = candidates.map((cand) =>
    [
      runId,
      ts,
      cand.id,
      cand.mode,
      gitCommit,
      round4(cand.metrics.hitAt1),
      round4(cand.metrics.hitAt5),
      round4(cand.metrics.recallAt5),
      round4(cand.metrics.mrr),
      round4(cand.metrics.ndcgAt5),
      round4(cand.metrics.noResultAccuracy),
      round4(cand.metrics.p95LatencyMs),
      false,
    ].join(','),
  );
  await writeFile(path, `${existing.trimEnd()}\n${lines.join('\n')}\n`, 'utf8');
}

function renderReport(ctx) {
  const {
    manifest,
    stage2Best,
    stage2Samples,
    baseline,
    candidateResults,
    bestRrf,
    rrfSweep,
    promotionResult,
    promotions,
    topImproved,
    topWorsened,
    scoreDistributions,
  } = ctx;
  const lines = [];
  lines.push('# Stage-3 Hybrid Search Experiment Report');
  lines.push('');
  lines.push(`- runId: \`${manifest.runId}\``);
  lines.push(`- Stage-2 anchor: **${stage2Best.experimentName}** (structure-aware vector-only)`);
  lines.push(`- Selected RRF: k=${bestRrf.rrfK}, lex=${bestRrf.lexicalWeight}, vec=${bestRrf.vectorWeight}`);
  lines.push(`- Promotion: **${promotionResult.promoted}** ${promotionResult.selected || ''}`);
  lines.push(`- Note: ${promotionResult.note}`);
  lines.push('');
  lines.push('## 1. Stage-2 baseline');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Hit@5 | ${round4(stage2Best.metrics.hitAt5)} |`);
  lines.push(`| Recall@5 | ${round4(stage2Best.metrics.recallAt5)} |`);
  lines.push(`| MRR | ${round4(stage2Best.metrics.mrr)} |`);
  lines.push(`| nDCG@5 | ${round4(stage2Best.metrics.ndcgAt5)} |`);
  lines.push(`| DUPLICATE_RESULT | ${stage2Best.metrics.failureTaxonomy?.DUPLICATE_RESULT} |`);
  lines.push(`| WRONG_TOP1 | ${stage2Best.metrics.failureTaxonomy?.WRONG_TOP1} |`);
  lines.push(`| KEYWORD_MISS | ${stage2Best.metrics.failureTaxonomy?.KEYWORD_MISS} |`);
  lines.push(`| SEMANTIC_MISS | ${stage2Best.metrics.failureTaxonomy?.SEMANTIC_MISS} |`);
  lines.push(`| EXPECTED_DOC_NOT_RETRIEVED | ${stage2Best.metrics.failureTaxonomy?.EXPECTED_DOC_NOT_RETRIEVED} |`);
  lines.push('');
  lines.push('### Stage-2 failure samples');
  for (const [code, sample] of Object.entries(stage2Samples || {})) {
    lines.push(`- **${code}** (n=${sample.count}): \`${sample.sampleId}\` — ${sample.sampleQuery || ''}`);
  }
  lines.push('');
  lines.push('## 2. Candidate overall metrics');
  lines.push('| Candidate | Hit@1 | Hit@5 | Recall@5 | MRR | nDCG@5 | Exact Hit@5 | Sem Recall@5 | Dup | WrongTop1 | NoRes | p95 | Overlap |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const cand of candidateResults) {
    const m = cand.metrics;
    lines.push(
      `| ${cand.id} | ${round4(m.hitAt1)} | ${round4(m.hitAt5)} | ${round4(m.recallAt5)} | ${round4(m.mrr)} | ${round4(m.ndcgAt5)} | ${round4(m.exactTermHitAt5)} | ${round4(m.semanticQueryRecallAt5)} | ${m.duplicateIncidentOrDocumentCount} | ${m.wrongTop1Count} | ${round4(m.noResultAccuracy)} | ${round4(m.p95LatencyMs)} | ${round4(m.lexicalVectorOverlap)} |`,
    );
  }
  lines.push('');
  lines.push('## 3. Per query-type (Hit@5 / Recall@5)');
  for (const cand of candidateResults) {
    lines.push(`### ${cand.id}`);
    for (const [cat, stats] of Object.entries(cand.byCategory || {})) {
      lines.push(`- ${cat}: Hit@5=${round4(stats.hitAt5)} Recall@5=${round4(stats.recallAt5)} MRR=${round4(stats.mrr)} WrongTop1=${stats.wrongTop1Count} (n=${stats.count})`);
    }
  }
  lines.push('');
  lines.push('## 4. Vector-only vs Hybrid deltas');
  const hybrid = candidateResults.find((c) => c.id === 'hybrid-rrf');
  if (hybrid && baseline) {
    lines.push(`- Hit@5 Δ: ${round4(hybrid.metrics.hitAt5 - baseline.metrics.hitAt5)}`);
    lines.push(`- Recall@5 Δ: ${round4(hybrid.metrics.recallAt5 - baseline.metrics.recallAt5)}`);
    lines.push(`- MRR Δ: ${round4(hybrid.metrics.mrr - baseline.metrics.mrr)}`);
    lines.push(`- Dup Δ: ${hybrid.metrics.duplicateIncidentOrDocumentCount - baseline.metrics.duplicateIncidentOrDocumentCount}`);
    lines.push(`- WrongTop1 Δ: ${hybrid.metrics.wrongTop1Count - baseline.metrics.wrongTop1Count}`);
  }
  lines.push('');
  lines.push('## 5. Document diversification effect');
  for (const id of ['hybrid-rrf', 'hybrid-diversify-max1', 'hybrid-diversify-max2']) {
    const cand = candidateResults.find((c) => c.id === id);
    if (cand) {
      lines.push(`- ${id}: Hit@5=${round4(cand.metrics.hitAt5)} Recall@5=${round4(cand.metrics.recallAt5)} Dup=${cand.metrics.duplicateIncidentOrDocumentCount} WrongTop1=${cand.metrics.wrongTop1Count}`);
    }
  }
  lines.push('');
  lines.push('## 6. Contextual prefix + hybrid');
  for (const id of ['hybrid-contextual', 'hybrid-contextual-diversify-max2']) {
    const cand = candidateResults.find((c) => c.id === id);
    if (cand) {
      lines.push(`- ${id}: Hit@5=${round4(cand.metrics.hitAt5)} ExactHit@5=${round4(cand.metrics.exactTermHitAt5)} Recall@5=${round4(cand.metrics.recallAt5)} MRR=${round4(cand.metrics.mrr)}`);
    }
  }
  lines.push('');
  lines.push('## 7. Most improved queries (sample)');
  for (const row of topImproved) {
    lines.push(`- ${row.id} [${row.candidate}]: ${row.from}→${row.to} — ${row.query}`);
  }
  lines.push('');
  lines.push('## 8. Worsened queries (sample)');
  for (const row of topWorsened) {
    lines.push(`- ${row.id} [${row.candidate}]: ${row.from}→${row.to} failures=${(row.failures || []).join(',')} — ${row.query}`);
  }
  lines.push('');
  lines.push('## 9–10. DUPLICATE / WRONG_TOP1');
  for (const cand of candidateResults) {
    lines.push(`- ${cand.id}: DUP=${cand.metrics.duplicateIncidentOrDocumentCount} WRONG_TOP1=${cand.metrics.wrongTop1Count} (taxonomy DUPLICATE=${cand.metrics.failureTaxonomy.DUPLICATE_RESULT})`);
  }
  lines.push('');
  lines.push('## 11. No-result score distributions (threshold NOT finalized)');
  lines.push('```json');
  lines.push(JSON.stringify(scoreDistributions, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 12. Selected RRF');
  lines.push(`- best by Recall/MRR in sweep: **${bestRrf.id}** k=${bestRrf.rrfK} lex=${bestRrf.lexicalWeight} vec=${bestRrf.vectorWeight}`);
  lines.push('### RRF sweep');
  for (const row of rrfSweep) {
    lines.push(`- ${row.id}: Hit@5=${round4(row.metrics.hitAt5)} Recall@5=${round4(row.metrics.recallAt5)} MRR=${round4(row.metrics.mrr)}`);
  }
  lines.push('');
  lines.push('## 13. Promotion decisions');
  for (const row of promotions) {
    lines.push(`- ${row.id}: promote=${row.promote} reasons=${(row.reasons || []).join('; ') || 'n/a'} regressions=${(row.regressions || []).join('; ') || 'none'}`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('- Reranker not added (Stage-3 scope).');
  lines.push('- No-result threshold deferred to calibration stage.');
  lines.push('- If nothing promoted, Stage-2 structure-aware vector-only remains operational best.');
  return `${lines.join('\n')}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
