import { readBooleanEnv } from './env.mjs';
import { createRetrieverFromConfig } from './retrievers.mjs';

const DEFAULT_RRF_K = 60;
const DEFAULT_RETRIEVE_LIMIT = 40;
const DEFAULT_CONTEXT_LIMIT = 6;

function attachDebug(results, debug, options) {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  if (options.debug || readBooleanEnv(env, 'RAG_DEBUG', false)) {
    Object.defineProperty(results, 'debug', {
      enumerable: true,
      value: debug,
    });
  }
  return results;
}

/**
 * Search entry point.
 * modes:
 * - baseline | vector | vector-only → pure vector
 * - lexical | lexical-only → BM25/exact-term boosted lexical
 * - hybrid → production path (RRF + diversify max 2 + blended vector) unless stage3
 * - hybrid-raw → RRF without default diversify (Stage-3 candidates)
 */
export function searchRelevantChunks(index, question, options = {}) {
  const retrieveLimit = options.retrieveLimit ?? DEFAULT_RETRIEVE_LIMIT;
  const limit = options.limit ?? DEFAULT_CONTEXT_LIMIT;
  const mode = options.mode || 'hybrid';

  let diversifyConfig = options.diversifyConfig;
  if (options.maxChunksPerDocument != null) {
    diversifyConfig = {
      maxChunksPerDocument: options.maxChunksPerDocument,
      documentDeduplication: options.documentDeduplication !== false,
      headingDiversity: Boolean(options.headingDiversity),
    };
  }

  // Production default hybrid (non-stage3): match pre-stage3 diversify max 2 + blended vector.
  const isProductionHybrid =
    (mode === 'hybrid' || mode === 'hybrid-diversify')
    && options.stage3 !== true
    && mode !== 'hybrid-raw'
    && options.diversifyConfig === undefined
    && options.maxChunksPerDocument === undefined;

  if (isProductionHybrid) {
    const retriever = createRetrieverFromConfig({
      mode: 'hybrid',
      lexicalTopN: options.lexicalTopN ?? DEFAULT_RETRIEVE_LIMIT,
      vectorTopN: options.vectorTopN ?? DEFAULT_RETRIEVE_LIMIT,
      rrfK: options.rrfK ?? DEFAULT_RRF_K,
      lexicalWeight: options.lexicalWeight ?? 1.0,
      vectorWeight: options.vectorWeight ?? 1.0,
      pureVectorHybrid: false,
      diversify: { maxChunksPerDocument: 2, documentDeduplication: true, headingDiversity: false },
      minScore: options.minScore,
    });
    const { results, debug } = retriever.retrieve(index, question, {
      mode: 'hybrid',
      limit,
      retrieveLimit,
      filters: options.filters,
      pureVector: false,
    });
    return attachDebug(results, debug, options);
  }

  const resolvedMode =
    mode === 'hybrid-diversify' || mode === 'hybrid-raw' ? 'hybrid' : mode;

  const retriever = createRetrieverFromConfig({
    mode: resolvedMode,
    lexicalTopN: options.lexicalTopN ?? 30,
    vectorTopN: options.vectorTopN ?? 30,
    rrfK: options.rrfK ?? DEFAULT_RRF_K,
    lexicalWeight: options.lexicalWeight ?? 1.0,
    vectorWeight: options.vectorWeight ?? 1.0,
    pureVectorHybrid: options.pureVector ?? options.stage3 === true,
    diversify: diversifyConfig ?? null,
    minScore: options.minScore,
  });

  const { results, debug } = retriever.retrieve(index, question, {
    mode: resolvedMode,
    limit,
    retrieveLimit,
    filters: options.filters,
    pureVector: options.pureVector ?? options.stage3 === true,
  });
  return attachDebug(results, debug, options);
}
