import { parseWikiDocument } from './frontmatter';
import type { WikiCategory, WikiDocument, WikiSidebarMocCategory } from './types';
import {
  extractWikiVisibility,
  parseWikiFrontmatterFields,
  splitWikiFrontmatter,
  stripWikiFrontmatterQuotes,
} from './wikiFrontmatterCore.mjs';

function isArchivedWikiDoc(raw: string): boolean {
  const split = splitWikiFrontmatter(raw);
  if (!split) return false;
  const fields = parseWikiFrontmatterFields(split.frontmatter);
  const status = stripWikiFrontmatterQuotes(fields.get('status') ?? '').toLowerCase();
  const visibility = stripWikiFrontmatterQuotes(extractWikiVisibility(fields) ?? '').toLowerCase();
  return status === 'archived' || visibility === 'internal';
}

const rawModules = import.meta.glob<string>('../../content/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

/** Left-nav MOC sections (slug → section via categoryMapping). Not the same as YAML `category:`. */
export const sidebarMocCategories = [
  '01. Project Overview (프로젝트 개요)',
  '02. AI & Data Pipeline (AI 및 데이터 처리)',
  '03. Streaming & Sync (스트리밍 및 동기화)',
  '04. Knowledge Base (위키 및 검색)',
  '05. Management & Retrospective (운영 및 회고)',
  '06. 설계 판단 (Engineering Decisions)',
] as const satisfies readonly WikiSidebarMocCategory[];

const categoryMapping: Record<string, string> = {
  'Overview': '01. Project Overview (프로젝트 개요)',
  'Architecture': '01. Project Overview (프로젝트 개요)',
  'Evidence-Smart-Safety-System': '01. Project Overview (프로젝트 개요)',
  'Glossary': '01. Project Overview (프로젝트 개요)',
  'Develop-Code-Baseline-2026-07-15': '01. Project Overview (프로젝트 개요)',
  'AI-Pipeline': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Model-Decision-YOLO26n': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'ADR-003-YOLO26n-Selection': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Feature-Vector-51D-vs-54D': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Evidence-MQTT-E2E-Alert-Latency': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Evidence-RTSP-2Cam-Queue-TensorRT': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Evidence-TensorRT-Adoption-Decision': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Tracking-Association-Stabilization': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'Tracking-Association-Offline-AB-2026-07-13': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'ADR-004-LSTM-Feature-Expansion': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'LSTM': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'LSTM-Sequence-Length-Comparison': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'LSTM-Experiment-Results': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  '2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  '2026-06-30-Overlay-Tracking-Evidence-Log': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'AI-Output-JSON': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'ED-Standing-Faint-Upright-Gate': '02. AI & Data Pipeline (AI 및 데이터 처리)',
  'mjpeg-display-rollback': '03. Streaming & Sync (스트리밍 및 동기화)',
  'MJPEG-Streaming-Rollback-Report': '03. Streaming & Sync (스트리밍 및 동기화)',
  'MJPEG-Display-Port-Normalization': '03. Streaming & Sync (스트리밍 및 동기화)',
  'WebRTC-vs-HLS': '03. Streaming & Sync (스트리밍 및 동기화)',
  'ADR-001-WebRTC': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Plan-WebRTC-DataChannel-Sync': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Frame-Sync-Debug-Report': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Frame-Matching-Report': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Multi-Camera-Frame-Latency-Report': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Bug-Duplicate-Stream-Binding': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Frame-Sync-Canonical': '03. Streaming & Sync (스트리밍 및 동기화)',
  'Evidence-LLM-Wiki-RAG': '04. Knowledge Base (위키 및 검색)',
  'Evidence-Portfolio-Resume-Usage': '04. Knowledge Base (위키 및 검색)',
  'Graphify-Semantic-Map': '04. Knowledge Base (위키 및 검색)',
  'Benchmark-Evidence-Hub': '04. Knowledge Base (위키 및 검색)',
  'Evidence-VLM-RAG-Event-Search-Decision': '04. Knowledge Base (위키 및 검색)',
  'VLM-RAG-DBless-Mock-MVP': '04. Knowledge Base (위키 및 검색)',
  'Realtime-Camera-Runtime-Stabilization': '05. Management & Retrospective (운영 및 회고)',
  'Bug-Notification-Scope': '05. Management & Retrospective (운영 및 회고)',
  'Bug-RTSP-Stream-404': '05. Management & Retrospective (운영 및 회고)',
  'Bug-Codeblock-Visibility': '05. Management & Retrospective (운영 및 회고)',
  'Bug-AI-Tracker-FrameRate-Mismatch': '05. Management & Retrospective (운영 및 회고)',
  'ADR-002-MQTT-Metadata-Separation': '05. Management & Retrospective (운영 및 회고)',
  'MQTT-Event-Schema': '05. Management & Retrospective (운영 및 회고)',
  'Interview-Resume-Notes': '05. Management & Retrospective (운영 및 회고)',
  'Benchmark-History': '05. Management & Retrospective (운영 및 회고)',
  'Model-Comparison': '05. Management & Retrospective (운영 및 회고)',
  // Engineering decision records (안진경 1인칭 기술 판단)
  'ED-Latest-Frame-Queue-Policy': '06. 설계 판단 (Engineering Decisions)',
  'ED-FrameId-Evidence-Overlay-Sync': '06. 설계 판단 (Engineering Decisions)',
  'ED-Fall-Faint-Lifecycle': '06. 설계 판단 (Engineering Decisions)',
  'ED-MQTT-Backend-Event-Path': '06. 설계 판단 (Engineering Decisions)',
  'ED-Snapshot-VLM-Side-Channel': '06. 설계 판단 (Engineering Decisions)',
  'Multi-Camera-Worker-Session-Reliability': '06. 설계 판단 (Engineering Decisions)'
};

const slugOrderWithinCategory: Record<string, readonly string[]> = {
  '01. Project Overview (프로젝트 개요)': [
    'Overview',
    'Architecture',
    'Evidence-Smart-Safety-System',
    'Glossary',
    'Develop-Code-Baseline-2026-07-15',
  ],
  '02. AI & Data Pipeline (AI 및 데이터 처리)': [
    'AI-Pipeline',
    'Model-Decision-YOLO26n',
    'ADR-003-YOLO26n-Selection',
    'Evidence-TensorRT-Adoption-Decision',
    'Evidence-RTSP-2Cam-Queue-TensorRT',
    'Evidence-MQTT-E2E-Alert-Latency',
    'Tracking-Association-Stabilization',
    'Tracking-Association-Offline-AB-2026-07-13',
    'Feature-Vector-51D-vs-54D',
    'ADR-004-LSTM-Feature-Expansion',
    'LSTM',
    'LSTM-Sequence-Length-Comparison',
    'LSTM-Experiment-Results',
    '2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log',
    '2026-06-30-Overlay-Tracking-Evidence-Log',
    'AI-Output-JSON',
    'ED-Standing-Faint-Upright-Gate',
  ],
  '03. Streaming & Sync (스트리밍 및 동기화)': [
    'mjpeg-display-rollback',
    'MJPEG-Streaming-Rollback-Report',
    'MJPEG-Display-Port-Normalization',
    'WebRTC-vs-HLS',
    'ADR-001-WebRTC',
    'Plan-WebRTC-DataChannel-Sync',
    'Frame-Sync-Debug-Report',
    'Frame-Matching-Report',
    'Multi-Camera-Frame-Latency-Report',
    'Bug-Duplicate-Stream-Binding',
    'Frame-Sync-Canonical',
  ],
  '04. Knowledge Base (위키 및 검색)': [
    'Evidence-LLM-Wiki-RAG',
    'Benchmark-Evidence-Hub',
    'Evidence-Portfolio-Resume-Usage',
    'Graphify-Semantic-Map',
    'Evidence-VLM-RAG-Event-Search-Decision',
    'VLM-RAG-DBless-Mock-MVP',
  ],
  '05. Management & Retrospective (운영 및 회고)': [
    'Realtime-Camera-Runtime-Stabilization',
    'Bug-Notification-Scope',
    'Bug-RTSP-Stream-404',
    'Bug-Codeblock-Visibility',
    'Bug-AI-Tracker-FrameRate-Mismatch',
    'ADR-002-MQTT-Metadata-Separation',
    'MQTT-Event-Schema',
    'Interview-Resume-Notes',
    'Benchmark-History',
    'Model-Comparison'
  ],
  '06. 설계 판단 (Engineering Decisions)': [
    'ED-Latest-Frame-Queue-Policy',
    'ED-FrameId-Evidence-Overlay-Sync',
    'ED-Fall-Faint-Lifecycle',
    'ED-MQTT-Backend-Event-Path',
    'ED-Snapshot-VLM-Side-Channel',
    'Multi-Camera-Worker-Session-Reliability'
  ]
};

export const documents = Object.entries(rawModules)
  .filter(([, raw]) => !isArchivedWikiDoc(raw))
  .map(([filePath, raw]) => {
    const text = typeof raw === 'string' ? raw : '';
    return parseWikiDocument(filePath, text);
  })
  .sort((left, right) => {
    const leftCat = categoryMapping[left.slug];
    const rightCat = categoryMapping[right.slug];
    if (!leftCat || !rightCat) throw new Error(`Unmapped public wiki slug: ${!leftCat ? left.slug : right.slug}`);
    
    const catDiff = sidebarMocCategories.indexOf(leftCat as WikiSidebarMocCategory) - sidebarMocCategories.indexOf(rightCat as WikiSidebarMocCategory);
    if (catDiff !== 0) {
      return catDiff;
    }
    
    const orderList = slugOrderWithinCategory[leftCat] ?? [];
    const leftIdx = orderList.indexOf(left.slug);
    const rightIdx = orderList.indexOf(right.slug);
    
    if (leftIdx !== -1 && rightIdx !== -1) {
      return leftIdx - rightIdx;
    }
    if (leftIdx !== -1) return -1;
    if (rightIdx !== -1) return 1;
    
    const orderDiff = (left.order ?? 999) - (right.order ?? 999);
    return orderDiff === 0 ? left.title.localeCompare(right.title) : orderDiff;
  });

export const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));

export const documentsByCategory = sidebarMocCategories.map((cat) => ({
  category: cat,
  documents: documents.filter((doc) => {
    const targetCat = categoryMapping[doc.slug];
    if (!targetCat) throw new Error(`Unmapped public wiki slug: ${doc.slug}`);
    return targetCat === cat;
  })
}));

export function getInitialDocument(): WikiDocument {
  return documentsBySlug.get('Overview') ?? documents[0] ?? {
    slug: 'missing',
    title: '문서 없음',
    category: 'Project' as WikiCategory,
    tags: [],
    relatedDocs: [],
    relatedFiles: [],
    updatedAt: '',
    body: '# 문서 없음',
    excerpt: '',
    headings: [],
  };
}
