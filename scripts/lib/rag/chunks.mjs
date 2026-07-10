import { buildRagIndexLegacy } from './chunks-legacy.mjs';
import {
  STRUCTURE_CONTEXTUAL_SCHEMA_VERSION,
  STRUCTURE_SCHEMA_VERSION,
  buildRagIndexStructured,
  documentContentHash,
  mergeIncrementalIndex,
} from './chunks-structured.mjs';

export { buildRagIndexLegacy } from './chunks-legacy.mjs';
export {
  STRUCTURE_CONTEXTUAL_SCHEMA_VERSION,
  STRUCTURE_SCHEMA_VERSION,
  buildRagIndexStructured,
  documentContentHash,
  mergeIncrementalIndex,
} from './chunks-structured.mjs';

/**
 * Unified entry. Default remains legacy for operational stability.
 * options.schemaVersion: 'legacy-v1' | 'structure-aware-v1' | 'structure-aware-contextual-v1'
 */
export function buildRagIndex(documents, options = {}) {
  const schemaVersion =
    options.schemaVersion
    || process.env.RAG_CHUNK_SCHEMA_VERSION
    || 'legacy-v1';

  if (schemaVersion === STRUCTURE_CONTEXTUAL_SCHEMA_VERSION || schemaVersion === 'structure-aware-contextual') {
    return buildRagIndexStructured(documents, { ...options, contextualPrefix: true });
  }
  if (schemaVersion === STRUCTURE_SCHEMA_VERSION || schemaVersion === 'structure-aware') {
    return buildRagIndexStructured(documents, { ...options, contextualPrefix: false });
  }
  return buildRagIndexLegacy(documents, options);
}
