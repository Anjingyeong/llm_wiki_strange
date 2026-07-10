import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const scratch = process.argv[2] || 'C:/Users/user/AppData/Local/Temp/grok-goal-85250e9fc28f/implementer';
mkdirSync(scratch, { recursive: true });
const runDir = 'rag-evaluation/runs/20260710-141323201_b5f11c2_structure-aware-only';
const failures = readFileSync(`${runDir}/failures.jsonl`, 'utf8').trim().split(/\n/).map((line) => JSON.parse(line));
const metrics = JSON.parse(readFileSync(`${runDir}/metrics.json`, 'utf8'));
const codes = ['DUPLICATE_RESULT', 'WRONG_TOP1', 'KEYWORD_MISS', 'SEMANTIC_MISS', 'EXPECTED_DOC_NOT_RETRIEVED'];
const samples = {};
for (const code of codes) {
  const hits = failures.filter((failure) => failure.code === code);
  const hit = hits[0];
  samples[code] = {
    count: hits.length,
    sampleId: hit?.id || null,
    sampleQuery: hit?.query || null,
    detail: hit?.detail || null,
  };
}
const snap = {
  stage2RunId: '20260710-141323201_b5f11c2_structure-aware-only',
  chunkSchema: 'structure-aware-v1',
  metrics: {
    hitAt1: metrics.hitAt1,
    hitAt5: metrics.hitAt5,
    recallAt5: metrics.recallAt5,
    mrr: metrics.mrr,
    ndcgAt5: metrics.ndcgAt5,
    duplicateIncidentOrDocumentCount: metrics.duplicateIncidentOrDocumentCount,
    wrongTop1Count: metrics.failureTaxonomy.WRONG_TOP1,
    failureTaxonomy: metrics.failureTaxonomy,
  },
  samples,
};
writeFileSync(join(scratch, 'stage2-baseline-snapshot.txt'), `${JSON.stringify(snap, null, 2)}\n`);
console.log(JSON.stringify(samples, null, 2));
