import index from '../../../data/ragVectorIndex.json';
import { detectStaleIndex, summarizeIndex } from '../../../scripts/lib/rag/index-meta.mjs';

const EXPECTED_ED = [
  'ED-Latest-Frame-Queue-Policy',
  'ED-FrameId-Evidence-Overlay-Sync',
  'ED-Fall-Faint-Lifecycle',
  'ED-MQTT-Backend-Event-Path',
  'ED-Snapshot-VLM-Side-Channel',
];

export async function onRequestGet() {
  const summary = summarizeIndex(index);
  const stale = detectStaleIndex(index, { expectedSlugs: EXPECTED_ED });
  return new Response(
    JSON.stringify({
      ok: true,
      index: summary,
      stale: stale.stale,
      staleReasons: stale.reasons,
      operationalSource: 'data/ragVectorIndex.json',
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
