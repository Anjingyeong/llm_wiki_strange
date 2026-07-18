import type {
  WikiDocument,
  WikiTaskNavigationGroup,
  WikiTaskNavigationId,
} from './types';

type WikiTaskDefinition = {
  readonly id: WikiTaskNavigationId;
  readonly label: string;
  readonly slugs: readonly string[];
};

export const WIKI_TASK_NAVIGATION = [
  {
    id: 'understand-system',
    label: 'Understand the system',
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
    label: 'Trace AI decisions',
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
    label: 'Debug runtime behaviour',
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
    label: 'Inspect evidence',
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
    label: 'Operate and reflect',
    slugs: [
      'Develop-Code-Baseline-2026-07-15',
      'mjpeg-display-rollback',
      'Plan-WebRTC-DataChannel-Sync',
    ],
  },
] as const satisfies readonly WikiTaskDefinition[];

const taskPositionBySlug = new Map(
  WIKI_TASK_NAVIGATION.flatMap((task, taskIndex) =>
    task.slugs.map((slug, documentIndex) => [slug, { taskIndex, documentIndex }] as const),
  ),
);

export function compareWikiDocumentsByTask(left: WikiDocument, right: WikiDocument): number {
  const leftPosition = taskPositionBySlug.get(left.slug);
  const rightPosition = taskPositionBySlug.get(right.slug);
  if (!leftPosition || !rightPosition) {
    throw new Error(`Unmapped public wiki slug: ${!leftPosition ? left.slug : right.slug}`);
  }
  return leftPosition.taskIndex - rightPosition.taskIndex
    || leftPosition.documentIndex - rightPosition.documentIndex;
}

export function groupWikiDocumentsByTask(
  documents: readonly WikiDocument[],
): readonly WikiTaskNavigationGroup[] {
  const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));
  for (const document of documents) {
    if (!taskPositionBySlug.has(document.slug)) {
      throw new Error(`Unmapped public wiki slug: ${document.slug}`);
    }
  }

  return WIKI_TASK_NAVIGATION.map((task) => ({
    id: task.id,
    label: task.label,
    documents: task.slugs.map((slug) => {
      const document = documentsBySlug.get(slug);
      if (!document) throw new Error(`Task navigation references non-public wiki slug: ${slug}`);
      return document;
    }),
  }));
}
