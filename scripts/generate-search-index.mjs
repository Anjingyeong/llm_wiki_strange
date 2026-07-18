import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCorpusHash } from './lib/corpus-hash.mjs';
import { extractHeadingsFromBody } from './lib/heading-utils.mjs';
import { isExcludedFromPublicIndex } from './lib/indexable-content.mjs';
import { extractWikiMachineMetadata, parseWikiSourceDocument } from './lib/wiki-source-document.mjs';
import { resolveDisplayTitle } from '../src/lib/wikiTitle.mjs';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const outputPath = join(wikiRoot, 'src', 'generated', 'searchIndex.ts');

const requiredKeys = ['title', 'category', 'updatedAt'];
const categoryOrder = new Map([
  ['Project', 100],
  ['Architecture', 200],
  ['AI Pipeline', 300],
  ['Frontend', 400],
  ['Infra', 400],
  ['Experiments', 600],
  ['Bugs', 700],
  ['Backend', 800],
  ['ADR', 850],
  ['면접·이력서 정리', 900],
  ['Glossary', 950],
]);
const slugOrder = new Map([
  // 1. 프로젝트 개요
  ['Overview', 100],
  ['Develop-Code-Baseline-2026-07-15', 95],
  ['Evidence-Smart-Safety-System', 110],

  // 2. 시스템 아키텍처
  ['Architecture', 200],
  ['Frame-Sync-Canonical', 198],
  ['ED-Standing-Faint-Upright-Gate', 305],
  ['ADR-001-WebRTC', 210],
  ['ADR-002-MQTT-Metadata-Separation', 220],

  // 3. AI 파이프라인
  ['AI-Pipeline', 300],
  ['AI-Output-JSON', 310],
  ['Model-Comparison', 320],
  ['Model-Decision-YOLO26n', 330],
  ['ADR-003-YOLO26n-Selection', 340],

  // 4. 실시간 스트리밍/RTSP/WebRTC/MQTT
  ['WebRTC-vs-HLS', 400],
  ['MQTT-Event-Schema', 410],
  ['MJPEG-Display-Port-Normalization', 420],
  ['MJPEG-Streaming-Rollback-Report', 430],
  ['Plan-WebRTC-DataChannel-Sync', 440],

  // 5. 프레임 동기화/Overlay Sync
  ['Frame-Matching-Report', 500],
  ['Frame-Sync-Debug-Report', 510],
  ['Multi-Camera-Frame-Latency-Report', 520],
  ['2026-06-30-Overlay-Tracking-Evidence-Log', 530],

  // 6. 모델 학습/평가/재학습
  ['LSTM', 600],
  ['LSTM-Experiment-Results', 610],
  ['LSTM-Sequence-Length-Comparison', 620],
  ['Feature-Vector-51D-vs-54D', 630],
  ['Benchmark-Evidence-Hub', 625],
  ['Evidence-TensorRT-Adoption-Decision', 626],
  ['Evidence-RTSP-2Cam-Queue-TensorRT', 627],
  ['Evidence-MQTT-E2E-Alert-Latency', 628],
  ['Tracking-Association-Stabilization', 629],
  ['Tracking-Association-Offline-AB-2026-07-13', 629],
  ['ADR-004-LSTM-Feature-Expansion', 640],

  // 7. 버그 해결 기록
  ['Bug-RTSP-Stream-404', 700],
  ['Bug-Notification-Scope', 710],
  ['Bug-Codeblock-Visibility', 720],
  ['Bug-AI-Tracker-FrameRate-Mismatch', 730],
  ['2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log', 740],

  // 8. 배포/운영/모니터링
  ['Realtime-Camera-Runtime-Stabilization', 800],
  ['Benchmark-History', 810],

  // 9. 회고/개선 방향
  ['Evidence-LLM-Wiki-RAG', 900],
  ['Evidence-Portfolio-Resume-Usage', 910],
  ['Interview-Resume-Notes', 920],
  ['Glossary', 930],
]);

function excerptFrom(body) {
  const EXCERPT_MAX = 220;
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= EXCERPT_MAX) {
    return plain;
  }

  // Cut at the last whitespace before EXCERPT_MAX to avoid mid-word truncation
  const cut = plain.lastIndexOf(' ', EXCERPT_MAX);
  const end = cut > 0 ? cut : EXCERPT_MAX;
  return plain.slice(0, end) + '…';
}

function inferOrder(slug, data) {
  if (data.order) {
    return Number.parseInt(data.order, 10);
  }
  return slugOrder.get(slug) ?? categoryOrder.get(data.category) ?? 999;
}

function searchableText(body) {
  return body
    .replace(/```(\w+)?\r?\n([\s\S]*?)```/g, ' $1 $2 ')
    .replace(/[#>*`|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const { corpusHash } = await computeCorpusHash(contentDir, wikiRoot);
const generatedAt = new Date().toISOString();

const entries = [];
const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();

for (const file of files) {
  const raw = await readFile(join(contentDir, file), 'utf8');
  const parsed = parseWikiSourceDocument(raw, file);
  for (const key of requiredKeys) {
    if (typeof parsed.data[key] !== 'string' || !parsed.data[key]) {
      throw new Error(`${file} is missing required frontmatter key: ${key}`);
    }
  }
  if (isExcludedFromPublicIndex(parsed.data)) {
    continue;
  }
  const slug = file.replace(/\.md$/, '');
  const headings = extractHeadingsFromBody(parsed.body);
  entries.push({
    slug,
    title: parsed.data.title,
    navTitle: parsed.data.navTitle,
    shortTitle: parsed.data.shortTitle,
    displayTitle: resolveDisplayTitle({ ...parsed.data, slug }),
    category: parsed.data.category,
    tags: parsed.data.tags ?? [],
    relatedDocs: parsed.data.relatedDocs ?? [],
    relatedFiles: parsed.data.relatedFiles ?? [],
    updatedAt: parsed.data.updatedAt,
    ...extractWikiMachineMetadata(parsed.data),
    summary: parsed.data.summary ?? parsed.data.description ?? excerptFrom(parsed.body),
    order: inferOrder(slug, parsed.data),
    sourcePath: `content/${file}`,
    excerpt: excerptFrom(parsed.body),
    headings,
    text: searchableText(
      [
        parsed.data.title,
        parsed.data.navTitle ?? '',
        parsed.data.shortTitle ?? '',
        slug,
        parsed.data.summary ?? parsed.data.description ?? '',
        Array.isArray(parsed.data.tags) ? parsed.data.tags.join(' ') : String(parsed.data.tags ?? ''),
        Array.isArray(parsed.data.entities) ? parsed.data.entities.join(' ') : String(parsed.data.entities ?? ''),
        parsed.body,
      ].join('\n'),
    ),
  });
}

entries.sort((left, right) => left.order - right.order || left.displayTitle.localeCompare(right.displayTitle));

const meta = {
  corpusHash,
  documentCount: entries.length,
  generatedAt,
  source: 'content/*.md',
};

const output = `import type { SearchDocument } from '../lib/types';\n\nexport const searchIndexMeta = ${JSON.stringify(meta)} as const;\n\nexport const searchIndex: readonly SearchDocument[] = ${JSON.stringify(entries)};\n`;

await writeFile(outputPath, output, 'utf8');
// Machine-readable copy for Node unit tests (avoids parsing TS `satisfies`).
const jsonPath = join(wikiRoot, 'src', 'generated', 'searchIndex.json');
await writeFile(
  jsonPath,
  `${JSON.stringify({ meta, documents: entries }, null, 0)}\n`,
  'utf8',
);
console.log(`Generated ${relative(wikiRoot, outputPath)} with ${entries.length} documents.`);
console.log(`Generated ${relative(wikiRoot, jsonPath)} corpusHash=${corpusHash.slice(0, 12)}…`);
