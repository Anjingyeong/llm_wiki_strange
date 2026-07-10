#!/usr/bin/env node
/**
 * Stage-2 experiment: compare legacy vs structure-aware vs structure-aware+contextual
 * on the same golden query dataset without mutating hybrid search code paths.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIndexManifest, writeIndexManifest } from './lib/rag/index-manifest.mjs';
import { evaluatePromotion } from './lib/rag-eval/promotion.mjs';
import { parseSimpleYaml } from './lib/rag-eval/yaml.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EXPERIMENTS = [
  {
    name: 'baseline-legacy-chunking',
    schemaVersion: 'legacy-v1',
    indexPath: 'data/rag/indexes/legacy-v1.json',
  },
  {
    name: 'structure-aware-only',
    schemaVersion: 'structure-aware-v1',
    indexPath: 'data/rag/indexes/structure-aware-v1.json',
  },
  {
    name: 'structure-aware-contextual',
    schemaVersion: 'structure-aware-contextual-v1',
    indexPath: 'data/rag/indexes/structure-aware-contextual-v1.json',
  },
];

async function main() {
  const policy = parseSimpleYaml(
    await readFile(join(ROOT, 'rag-evaluation/config/promotion-policy.yaml'), 'utf8'),
  );
  const results = [];

  for (const experiment of EXPERIMENTS) {
    console.log(`\n=== Build index: ${experiment.schemaVersion} ===`);
    const build = spawnSync(
      process.execPath,
      ['scripts/generate-rag-index.mjs'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          RAG_CHUNK_SCHEMA_VERSION: experiment.schemaVersion,
          RAG_WRITE_OPERATIONAL: 'false',
        },
      },
    );
    if (build.status !== 0) {
      console.error(build.stdout, build.stderr);
      throw new Error(`index build failed for ${experiment.schemaVersion}`);
    }
    console.log(build.stdout.trim());

    console.log(`=== Eval: ${experiment.name} ===`);
    const evalRun = spawnSync(process.execPath, ['scripts/rag-eval.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        RAG_EXPERIMENT: experiment.name,
        RAG_INDEX_PATH: experiment.indexPath,
        RAG_RETRIEVAL_MODE: 'baseline',
        // Freeze best.json during multi-candidate comparison; promote once at end.
        RAG_EVAL_UPDATE_BEST: 'false',
      },
    });
    if (evalRun.status !== 0) {
      console.error(evalRun.stdout, evalRun.stderr);
      throw new Error(`eval failed for ${experiment.name}`);
    }
    console.log(evalRun.stdout.trim());
    const summaryLine = (evalRun.stdout || '').split(/\r?\n/).find((line) => line.startsWith('EVAL_SUMMARY_JSON:'));
    if (!summaryLine) {
      throw new Error(`missing EVAL_SUMMARY_JSON for ${experiment.name}\n${evalRun.stdout}\n${evalRun.stderr}`);
    }
    const summary = JSON.parse(summaryLine.slice('EVAL_SUMMARY_JSON:'.length));
    const metricsPath = join(ROOT, summary.runDir, 'metrics.json');
    const metrics = JSON.parse(await readFile(metricsPath, 'utf8'));
    const index = JSON.parse(await readFile(join(ROOT, experiment.indexPath), 'utf8'));
    const manifest = buildIndexManifest(index, {
      chunkSchemaVersion: experiment.schemaVersion,
      indexPath: experiment.indexPath,
    });

    results.push({
      experiment: experiment.name,
      schemaVersion: experiment.schemaVersion,
      indexPath: experiment.indexPath,
      runId: summary.runId,
      runDir: summary.runDir,
      metrics,
      chunkCount: manifest.chunkCount,
      meanChunkChars: manifest.meanChunkChars,
      duplicateDocRatio: manifest.duplicateDocRatio,
    });
  }

  const baseline = results.find((row) => row.experiment === 'baseline-legacy-chunking');
  const candidates = results.filter((row) => row.experiment !== 'baseline-legacy-chunking');

  let best = null;
  try {
    best = JSON.parse(await readFile(join(ROOT, 'rag-evaluation/best.json'), 'utf8'));
  } catch {
    best = null;
  }

  const comparisons = [];
  for (const candidate of candidates) {
    const promotion = evaluatePromotion(candidate.metrics, baseline.metrics, policy);
    const vsBest = evaluatePromotion(candidate.metrics, best?.metrics || baseline.metrics, policy);
    comparisons.push({
      experiment: candidate.experiment,
      schemaVersion: candidate.schemaVersion,
      vsLegacy: {
        hitAt5Delta: delta(candidate.metrics.hitAt5, baseline.metrics.hitAt5),
        recallAt5Delta: delta(candidate.metrics.recallAt5, baseline.metrics.recallAt5),
        mrrDelta: delta(candidate.metrics.mrr, baseline.metrics.mrr),
        ndcgAt5Delta: delta(candidate.metrics.ndcgAt5, baseline.metrics.ndcgAt5),
        p95LatencyDeltaRatio: ratioDelta(candidate.metrics.p95LatencyMs, baseline.metrics.p95LatencyMs),
        chunkCountDelta: candidate.chunkCount - baseline.chunkCount,
        meanChunkCharsDelta: candidate.meanChunkChars - baseline.meanChunkChars,
        promoteAgainstLegacy: promotion.promote,
        reasons: promotion.reasons,
        regressions: promotion.regressions,
      },
      vsBest,
      metrics: pick(candidate.metrics),
      chunkCount: candidate.chunkCount,
      meanChunkChars: candidate.meanChunkChars,
      runDir: candidate.runDir,
      indexPath: candidate.indexPath,
    });
  }

  // Select best candidate by recall then mrr if any promotes vs best
  const promotable = comparisons
    .filter((row) => row.vsBest.promote)
    .sort((a, b) => (b.metrics.recallAt5 - a.metrics.recallAt5) || (b.metrics.mrr - a.metrics.mrr));

  let promotionResult = {
    promoted: false,
    selected: null,
    note: 'No candidate met promotion policy vs best/baseline.',
  };

  if (promotable.length > 0) {
    const selected = promotable[0];
    const full = results.find((row) => row.experiment === selected.experiment);
    await writeFile(
      join(ROOT, 'rag-evaluation/best.json'),
      `${JSON.stringify({
        runId: full.runId,
        experimentName: selected.experiment,
        retrievalMode: 'baseline',
        promotedAt: new Date().toISOString(),
        metrics: full.metrics,
        runDir: full.runDir,
        chunkSchemaVersion: selected.schemaVersion,
        note: 'Promoted by structure-aware chunk experiment (search metrics only).',
      }, null, 2)}\n`,
      'utf8',
    );
    const pointer = {
      chunkSchemaVersion: selected.schemaVersion,
      indexPath: selected.indexPath,
      updatedAt: new Date().toISOString(),
      runDir: selected.runDir,
      note: 'Promoted by structure-aware chunk experiment. Hybrid search code unchanged; pointer records active chunk schema.',
    };
    await writeFile(join(ROOT, 'data/rag/current-index.json'), `${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
    await copyFile(join(ROOT, selected.indexPath), join(ROOT, 'data/ragVectorIndex.json'));
    const index = JSON.parse(await readFile(join(ROOT, selected.indexPath), 'utf8'));
    await writeIndexManifest(
      join(ROOT, 'data/rag/index-manifest.json'),
      buildIndexManifest(index, {
        chunkSchemaVersion: selected.schemaVersion,
        indexPath: selected.indexPath,
      }),
    );
    promotionResult = {
      promoted: true,
      selected: selected.schemaVersion,
      experiment: selected.experiment,
      note: 'best.json/pointer/operational index updated.',
    };
  }

  const report = renderExperimentReport({ baseline, comparisons, promotionResult, results });
  const outDir = join(ROOT, 'rag-evaluation/experiments');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(outDir, `chunking-stage2-${stamp}.md`);
  await writeFile(reportPath, report, 'utf8');
  await writeFile(join(outDir, 'chunking-stage2-latest.md'), report, 'utf8');
  await writeFile(
    join(outDir, 'chunking-stage2-latest.json'),
    `${JSON.stringify({ baseline, comparisons, promotionResult, results: results.map((r) => ({ experiment: r.experiment, runId: r.runId, metrics: pick(r.metrics), chunkCount: r.chunkCount, meanChunkChars: r.meanChunkChars })) }, null, 2)}\n`,
    'utf8',
  );

  console.log(`\n=== Stage-2 experiment complete ===`);
  console.log(JSON.stringify({ reportPath: relativePosix(reportPath), promotionResult, comparisons: comparisons.map((c) => ({ experiment: c.experiment, vsLegacy: c.vsLegacy, vsBestPromote: c.vsBest.promote })) }, null, 2));
}

function delta(a, b) {
  if (a == null || b == null) return null;
  return Number((a - b).toFixed(4));
}

function ratioDelta(a, b) {
  if (a == null || b == null || !b) return null;
  return Number(((a - b) / b).toFixed(4));
}

function pick(metrics) {
  return {
    hitAt1: metrics.hitAt1,
    hitAt5: metrics.hitAt5,
    recallAt5: metrics.recallAt5,
    mrr: metrics.mrr,
    ndcgAt5: metrics.ndcgAt5,
    noResultAccuracy: metrics.noResultAccuracy,
    p95LatencyMs: metrics.p95LatencyMs,
    duplicateIncidentOrDocumentCount: metrics.duplicateIncidentOrDocumentCount,
    meanRetrievedChunks: metrics.meanRetrievedChunks,
    failureTaxonomy: metrics.failureTaxonomy,
  };
}

function relativePosix(path) {
  return path.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/');
}

function renderExperimentReport({ baseline, comparisons, promotionResult, results }) {
  const lines = [];
  lines.push('# Stage-2 Chunking Experiment Report');
  lines.push('');
  lines.push('Retrieval mode for all runs: **baseline pure vector** (hybrid path not modified).');
  lines.push('Dataset: `golden_queries.v1`.');
  lines.push('');
  lines.push('## Index stats');
  lines.push('| Experiment | Schema | Chunks | Mean chars | Dup doc ratio |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const row of results) {
    lines.push(`| ${row.experiment} | ${row.schemaVersion} | ${row.chunkCount} | ${row.meanChunkChars} | ${row.duplicateDocRatio} |`);
  }
  lines.push('');
  lines.push('## Quality metrics');
  lines.push('| Experiment | Hit@5 | Recall@5 | MRR | nDCG@5 | No-result | p95 ms |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of results) {
    const m = row.metrics;
    lines.push(`| ${row.experiment} | ${fmt(m.hitAt5)} | ${fmt(m.recallAt5)} | ${fmt(m.mrr)} | ${fmt(m.ndcgAt5)} | ${fmt(m.noResultAccuracy)} | ${fmt(m.p95LatencyMs)} |`);
  }
  lines.push('');
  lines.push('## Deltas vs legacy baseline');
  for (const row of comparisons) {
    lines.push(`### ${row.experiment}`);
    lines.push(`- Hit@5 Δ: ${row.vsLegacy.hitAt5Delta}`);
    lines.push(`- Recall@5 Δ: ${row.vsLegacy.recallAt5Delta}`);
    lines.push(`- MRR Δ: ${row.vsLegacy.mrrDelta}`);
    lines.push(`- nDCG@5 Δ: ${row.vsLegacy.ndcgAt5Delta}`);
    lines.push(`- p95 latency ratio Δ: ${row.vsLegacy.p95LatencyDeltaRatio}`);
    lines.push(`- chunk count Δ: ${row.vsLegacy.chunkCountDelta}`);
    lines.push(`- mean chunk chars Δ: ${row.vsLegacy.meanChunkCharsDelta}`);
    lines.push(`- promote vs legacy policy: ${row.vsLegacy.promoteAgainstLegacy}`);
    lines.push(`- promote vs best: ${row.vsBest.promote}`);
    if (row.vsBest.regressions?.length) {
      lines.push(`- regressions: ${row.vsBest.regressions.join('; ')}`);
    }
    lines.push('');
  }
  lines.push('## Failure taxonomy changes (top codes)');
  for (const row of results) {
    const tax = row.metrics.failureTaxonomy || {};
    const top = Object.entries(tax).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `${k}:${v}`).join(', ');
    lines.push(`- ${row.experiment}: ${top}`);
  }
  lines.push('');
  lines.push('## Promotion');
  lines.push(`- promoted: **${promotionResult.promoted}**`);
  lines.push(`- selected: ${promotionResult.selected || 'none'}`);
  lines.push(`- note: ${promotionResult.note}`);
  lines.push('');
  lines.push('## Interpretation notes');
  lines.push('- Improved types: look at positive Recall/MRR deltas and reduced EXPECTED_DOC_NOT_RETRIEVED / SEMANTIC_MISS.');
  lines.push('- Worsened types: regressions list and increased KEYWORD_MISS / WRONG_TOP1.');
  lines.push('- Cost/latency: chunk count and p95 latency deltas; local hash embed is cheap so latency is secondary to quality.');
  lines.push('- Operational hybrid search implementation was not rewritten; only index pointer/operational file updates on promotion.');
  return `${lines.join('\n')}\n`;
}

function fmt(value) {
  if (value == null || Number.isNaN(value)) return '';
  return Number(value).toFixed(4);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
