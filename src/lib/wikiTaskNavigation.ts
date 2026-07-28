import type {
  WikiCategory,
  WikiDocument,
  WikiTaskNavigationGroup,
  WikiTaskNavigationId,
} from './types';

type WikiTaskDefinition = {
  readonly id: WikiTaskNavigationId;
  readonly label: string;
  readonly slugs: readonly string[];
};

type WikiTaskPosition = {
  readonly taskIndex: number;
  readonly documentIndex: number;
};

export const WIKI_TASK_NAVIGATION = [
  {
    id: 'understand-system',
    label: '시스템 이해',
    slugs: [
      'Overview',
      'Architecture',
      'Evidence-Smart-Safety-System',
      'AI-Pipeline',
      'AI-Output-JSON',
      'MQTT-Event-Schema',
      'VLM-RAG-DBless-Mock-MVP',
      'Glossary',
    ],
  },
  {
    id: 'trace-ai-decisions',
    label: 'AI 판단과 결정',
    slugs: [
      'Model-Comparison',
      'ADR-003-YOLO26n-Selection',
      'Evidence-TensorRT-Adoption-Decision',
      'ADR-004-LSTM-Feature-Expansion',
      'Feature-Vector-51D-vs-54D',
      'ED-Standing-Faint-Upright-Gate',
      'ADR-001-WebRTC',
      'WebRTC-vs-HLS',
      'ADR-002-MQTT-Metadata-Separation',
      'Evidence-VLM-RAG-Event-Search-Decision',
      'ED-Latest-Frame-Queue-Policy',
      'ED-FrameId-Evidence-Overlay-Sync',
      'ED-Fall-Faint-Lifecycle',
      'ED-Snapshot-VLM-Side-Channel',
      'ED-MQTT-Backend-Event-Path',
    ],
  },
  {
    id: 'debug-runtime',
    label: '런타임 문제 해결',
    slugs: [
      'Realtime-Camera-Runtime-Stabilization',
      'Multi-Camera-Worker-Session-Reliability',
      'Tracking-Association-Stabilization',
      'Frame-Sync-Canonical',
      'Frame-Sync-Debug-Report',
      'Frame-Matching-Report',
      'Multi-Camera-Frame-Latency-Report',
      'Bug-Duplicate-Stream-Binding',
      'Bug-RTSP-Stream-404',
      'Bug-Notification-Scope',
      'Bug-Codeblock-Visibility',
      'Bug-AI-Tracker-FrameRate-Mismatch',
      'MJPEG-Display-Port-Normalization',
    ],
  },
  {
    id: 'inspect-evidence',
    label: '검증과 근거',
    slugs: [
      'Benchmark-Evidence-Hub',
      'Benchmark-History',
      'Tracking-Association-Offline-AB-2026-07-13',
      'LSTM',
      'LSTM-Experiment-Results',
      'LSTM-Sequence-Length-Comparison',
      'Evidence-RTSP-2Cam-Queue-TensorRT',
      'Evidence-MQTT-E2E-Alert-Latency',
      'Evidence-LLM-Wiki-RAG',
    ],
  },
  {
    id: 'operate-and-reflect',
    label: '운영과 회고',
    slugs: [
      'Develop-Code-Baseline-2026-07-15',
      'mjpeg-display-rollback',
      'Plan-WebRTC-DataChannel-Sync',
    ],
  },
] as const satisfies readonly WikiTaskDefinition[];

const taskPositionBySlug = new Map<string, WikiTaskPosition>(
  WIKI_TASK_NAVIGATION.flatMap((task, taskIndex) =>
    task.slugs.map((slug, documentIndex) => [slug, { taskIndex, documentIndex }] as const),
  ),
);

const fallbackTaskIndexByCategory: Readonly<Record<WikiCategory, number>> = {
  Project: 0,
  Architecture: 0,
  Glossary: 0,
  'AI Pipeline': 1,
  ADR: 1,
  Backend: 2,
  Frontend: 2,
  Infra: 2,
  Bugs: 2,
  Experiments: 3,
  Evidence: 3,
  '면접·이력서 정리': 4,
};

function resolveTaskPosition(document: WikiDocument): WikiTaskPosition {
  return taskPositionBySlug.get(document.slug) ?? {
    taskIndex: fallbackTaskIndexByCategory[document.category] ?? 0,
    documentIndex: Number.MAX_SAFE_INTEGER,
  };
}

export function compareWikiDocumentsByTask(left: WikiDocument, right: WikiDocument): number {
  const leftPosition = resolveTaskPosition(left);
  const rightPosition = resolveTaskPosition(right);
  return leftPosition.taskIndex - rightPosition.taskIndex
    || leftPosition.documentIndex - rightPosition.documentIndex
    || left.title.localeCompare(right.title, 'ko')
    || left.slug.localeCompare(right.slug, 'en');
}

export function groupWikiDocumentsByTask(
  documents: readonly WikiDocument[],
): readonly WikiTaskNavigationGroup[] {
  const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));
  const groups = WIKI_TASK_NAVIGATION.map((task) => ({
    id: task.id,
    label: task.label,
    documents: task.slugs.flatMap((slug) => {
      const document = documentsBySlug.get(slug);
      return document ? [document] : [];
    }),
  }));

  for (const document of documents) {
    if (taskPositionBySlug.has(document.slug)) continue;
    const fallbackGroup = groups[fallbackTaskIndexByCategory[document.category] ?? 0];
    if (fallbackGroup) fallbackGroup.documents.push(document);
  }

  return groups.map((group) => ({
    ...group,
    documents: [...group.documents].sort(compareWikiDocumentsByTask),
  }));
}
