import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';

function gitShort() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function buildIndexManifest(index, options = {}) {
  const chunkSchemaVersion = index.chunkSchemaVersion || options.chunkSchemaVersion || 'legacy-v1';
  const embeddingVersion = index.embedding?.embeddingVersion || index.embedding?.provider || 'unknown';
  const documentCount = new Set((index.chunks || []).map((chunk) => chunk.documentId || chunk.documentSlug)).size;
  const chunkCount = (index.chunks || []).length;
  const payload = {
    indexVersion: options.indexVersion || `${chunkSchemaVersion}-${index.version || 1}`,
    chunkSchemaVersion,
    embeddingVersion,
    embeddingDimensions: index.embedding?.dimensions || null,
    documentCount,
    chunkCount,
    generatedAt: index.generatedAt || new Date().toISOString(),
    sourceCommit: options.sourceCommit || gitShort(),
    indexPath: options.indexPath || null,
    meanChunkChars: chunkCount
      ? Math.round(
          (index.chunks || []).reduce((sum, chunk) => sum + String(chunk.text || chunk.content || '').length, 0)
            / chunkCount,
        )
      : 0,
    duplicateDocRatio: computeDuplicateDocRatio(index.chunks || []),
  };
  payload.manifestHash = createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return payload;
}

function computeDuplicateDocRatio(chunks) {
  if (!chunks.length) return 0;
  const byDoc = new Map();
  for (const chunk of chunks) {
    const id = chunk.documentId || chunk.documentSlug;
    byDoc.set(id, (byDoc.get(id) || 0) + 1);
  }
  const multi = [...byDoc.values()].filter((count) => count > 1).length;
  return Number((multi / byDoc.size).toFixed(4));
}

export async function writeIndexManifest(path, manifest) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}
