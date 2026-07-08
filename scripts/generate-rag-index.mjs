import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRagIndex } from './lib/rag-core.mjs';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const outputPath = join(wikiRoot, 'data', 'ragVectorIndex.json');

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
  ['Evidence-Smart-Safety-System', 110],

  // 2. 시스템 아키텍처
  ['Architecture', 200],
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

function parseList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  const trimmed = String(value).trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => stripOuterQuotes(item))
      .filter(Boolean);
  }
  return trimmed ? [stripOuterQuotes(trimmed)] : [];
}

function stripOuterQuotes(value) {
  let normalized = String(value).trim();
  while (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function displayTitle(data, slug) {
  return data.navTitle || data.shortTitle || data.title || slug;
}

function stripMarkdownText(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[#>*`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(body, explicitSummary) {
  if (explicitSummary) {
    return explicitSummary;
  }
  const plain = stripMarkdownText(body);
  return plain.length <= 180 ? plain : `${plain.slice(0, 180).trim()}...`;
}

function inferOrder(slug, data) {
  if (data.order) {
    return Number.parseInt(data.order, 10);
  }
  return slugOrder.get(slug) ?? categoryOrder.get(data.category) ?? 999;
}

function parseFrontmatter(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`${fileName} is missing frontmatter`);
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = stripOuterQuotes(value);
  }

  return { data, body: match[2] };
}

const documents = [];
const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();
for (const file of files) {
  const raw = await readFile(join(contentDir, file), 'utf8');
  const parsed = parseFrontmatter(raw, file);
  const slug = file.replace(/\.md$/, '');
  documents.push({
    slug,
    title: parsed.data.title,
    navTitle: parsed.data.navTitle,
    shortTitle: parsed.data.shortTitle,
    displayTitle: displayTitle(parsed.data, slug),
    category: parsed.data.category,
    updatedAt: parsed.data.updatedAt,
    summary: makeSummary(parsed.body, parsed.data.summary ?? parsed.data.description),
    order: inferOrder(slug, parsed.data),
    sourcePath: `content/${file}`,
    project: parsed.data.project,
    type: parsed.data.type,
    tags: parseList(parsed.data.tags),
    relatedDocs: parseList(parsed.data.relatedDocs),
    relatedSlugs: parseList(parsed.data.relatedSlugs),
    entities: parseList(parsed.data.entities),
    portfolio_use: parsed.data.portfolio_use,
    evidence_type: parsed.data.evidence_type,
    body: parsed.body,
  });
}

const index = buildRagIndex(documents);
await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Generated ${relative(wikiRoot, outputPath)} with ${index.chunks.length} chunks.`);
