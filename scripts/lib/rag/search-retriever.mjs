/**
 * Search Retriever Abstraction
 * 
 * Provides unified search interface with three modes:
 * - elastic: Elasticsearch BM25+KNN hybrid only
 * - static: In-process vector/BM25 index only (existing RAG pipeline)
 * - auto (default): Elasticsearch first, fallback to static on failure
 * 
 * Env: RAG_RETRIEVER=auto|elastic|static
 */

import { searchElasticHybrid } from './elasticsearch/search.mjs';
import { elasticHealth, elasticConfig } from './elasticsearch/client.mjs';
import { searchRelevantChunks as searchStatic } from './search.mjs';

/** Allowed filter fields to prevent arbitrary field injection */
const FILTER_WHITELIST = new Set(['category', 'tags', 'implementationStatus', 'documentId', 'slug']);

/**
 * Sanitize filters: only allow whitelisted fields.
 */
export function sanitizeFilters(filters) {
  if (!filters || typeof filters !== 'object') return {};
  const safe = {};
  for (const [key, value] of Object.entries(filters)) {
    if (FILTER_WHITELIST.has(key) && value != null && value !== '') {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Resolve retriever mode from environment.
 */
export function resolveRetrieverMode(env = process.env) {
  const mode = (env.RAG_RETRIEVER || 'auto').toLowerCase().trim();
  if (['elastic', 'static', 'auto'].includes(mode)) return mode;
  return 'auto';
}

/**
 * Check if Elasticsearch is configured (URL is set and non-default or explicitly chosen).
 */
export function isElasticsearchConfigured(env = process.env) {
  return !!(env.ELASTIC_URL || env.ELASTICSEARCH_URL);
}

/**
 * Search with Elasticsearch hybrid (BM25 + KNN + RRF).
 * Returns { results, retrievalMode, latencyMs }.
 */
export async function searchWithElasticsearch(question, options = {}) {
  const env = options.env || process.env;
  const filters = sanitizeFilters(options.filters);
  const limit = options.limit || 8;

  // Map ELASTIC_* env vars to ELASTICSEARCH_* for the existing client
  const esEnv = buildElasticEnv(env);

  const start = performance.now();
  const results = await searchElasticHybrid(question, {
    limit,
    filters,
    env: esEnv,
    retrieveLimit: options.retrieveLimit || 40,
    rankConstant: options.rankConstant || 60,
  });
  const latencyMs = Math.round(performance.now() - start);

  return {
    results: results.map(normalizeElasticResult),
    retrievalMode: 'elastic',
    latencyMs,
  };
}

/**
 * Search with the existing static in-process index.
 * Returns { results, retrievalMode, latencyMs }.
 */
export function searchWithStaticIndex(index, question, options = {}) {
  const limit = options.limit || 8;
  const start = performance.now();
  const results = searchStatic(index, question, {
    ...options,
    limit,
  });
  const latencyMs = Math.round(performance.now() - start);

  return {
    results: Array.isArray(results) ? results : [],
    retrievalMode: 'static',
    latencyMs,
  };
}

/**
 * Main entry point: searchRagChunks
 * Resolves retriever mode, dispatches to Elasticsearch or static, handles fallback.
 * 
 * @param {object} index - The loaded RAG vector index (for static search)
 * @param {string} question - User question
 * @param {object} options - { env, filters, limit, retrieveLimit, debug, mode }
 * @returns {Promise<{ results, retrievalMode, fallbackUsed, retrievalLatencyMs, sources }>}
 */
export async function searchRagChunks(index, question, options = {}) {
  const env = options.env || process.env;
  const retrieverMode = resolveRetrieverMode(env);
  const limit = options.limit || 8;

  if (retrieverMode === 'static') {
    const { results, latencyMs } = searchWithStaticIndex(index, question, options);
    return {
      results,
      retrievalMode: 'static',
      fallbackUsed: false,
      retrievalLatencyMs: latencyMs,
      sources: results.map(toSourceMeta),
    };
  }

  if (retrieverMode === 'elastic') {
    // Elasticsearch only — no fallback
    const { results, latencyMs } = await searchWithElasticsearch(question, { ...options, env, limit });
    return {
      results,
      retrievalMode: 'elastic',
      fallbackUsed: false,
      retrievalLatencyMs: latencyMs,
      sources: results.map(toSourceMeta),
    };
  }

  // auto mode: try Elasticsearch, fallback to static
  if (isElasticsearchConfigured(env)) {
    try {
      const { results, latencyMs } = await searchWithElasticsearch(question, { ...options, env, limit });
      return {
        results,
        retrievalMode: 'elastic',
        fallbackUsed: false,
        retrievalLatencyMs: latencyMs,
        sources: results.map(toSourceMeta),
      };
    } catch (error) {
      // Elasticsearch failed — fall through to static
      if (options.debug) {
        console.warn('[searchRagChunks] Elasticsearch failed, falling back to static:', error.message);
      }
    }
  }

  // Fallback to static
  const { results, latencyMs } = searchWithStaticIndex(index, question, options);
  return {
    results,
    retrievalMode: 'static',
    fallbackUsed: true,
    retrievalLatencyMs: latencyMs,
    sources: results.map(toSourceMeta),
  };
}

/**
 * Normalize Elasticsearch hit to match the static chunk format expected by answer.mjs.
 */
function normalizeElasticResult(hit) {
  return {
    id: hit.id,
    documentId: hit.documentId,
    slug: hit.slug || hit.documentId,
    title: hit.title || '',
    displayTitle: hit.displayTitle || hit.title || '',
    category: hit.category || '',
    tags: hit.tags || [],
    entities: hit.entities || [],
    codeSymbols: hit.codeSymbols || [],
    referencedFiles: hit.referencedFiles || [],
    relatedSlugs: hit.relatedSlugs || [],
    headingPath: hit.headingPath || '',
    sectionTitle: hit.sectionTitle || hit.section || '',
    text: hit.text || hit.content || '',
    content: hit.text || hit.content || '',
    summary: hit.summary || '',
    sourcePath: hit.sourcePath || '',
    updatedAt: hit.updatedAt || null,
    implementationStatus: hit.implementationStatus || hit.implementation_status || 'unknown',
    implementation_status: hit.implementationStatus || hit.implementation_status || 'unknown',
    chunkOrder: hit.chunkOrder || 0,
    score: hit.score || 0,
    matchedBy: hit.matchedBy || [],
    section: hit.sectionTitle || hit.section || '',
  };
}

/**
 * Map source metadata for API response (safe for browser exposure).
 */
function toSourceMeta(chunk) {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    slug: chunk.slug || chunk.documentId,
    title: chunk.title || '',
    section: chunk.sectionTitle || chunk.section || '',
    text: (chunk.text || chunk.content || '').slice(0, 300),
    category: chunk.category || '',
    codeSymbols: Array.isArray(chunk.codeSymbols) ? chunk.codeSymbols.slice(0, 6) : [],
    sourcePath: chunk.sourcePath || '',
    implementationStatus: chunk.implementationStatus || chunk.implementation_status || 'unknown',
    score: chunk.score || 0,
    matchedBy: chunk.matchedBy || [],
  };
}

/**
 * Build ELASTICSEARCH_* env from ELASTIC_* env (bridge between spec and existing client).
 */
function buildElasticEnv(env) {
  return {
    ...env,
    ELASTICSEARCH_URL: env.ELASTIC_URL || env.ELASTICSEARCH_URL || 'http://localhost:9200',
    ELASTICSEARCH_INDEX: env.ELASTIC_INDEX || env.ELASTICSEARCH_INDEX || 'smart-safety-wiki',
    ELASTICSEARCH_USERNAME: env.ELASTIC_USERNAME || env.ELASTICSEARCH_USERNAME || '',
    ELASTICSEARCH_PASSWORD: env.ELASTIC_PASSWORD || env.ELASTICSEARCH_PASSWORD || '',
    ELASTICSEARCH_API_KEY: env.ELASTIC_API_KEY || env.ELASTICSEARCH_API_KEY || '',
  };
}

/**
 * Get Elasticsearch status (for /api/rag/status).
 * Returns status info without exposing sensitive credentials.
 */
export async function getElasticsearchStatus(env = process.env) {
  const configured = isElasticsearchConfigured(env);
  const esEnv = buildElasticEnv(env);
  const indexName = esEnv.ELASTICSEARCH_INDEX || 'smart-safety-wiki';

  if (!configured) {
    return {
      configured: false,
      available: false,
      status: 'not_configured',
      index: indexName,
      documentCount: 0,
    };
  }

  try {
    const health = await elasticHealth(esEnv);
    // Try to get doc count
    let documentCount = 0;
    try {
      const { elasticRequest } = await import('./elasticsearch/client.mjs');
      const countResult = await elasticRequest(
        `/${encodeURIComponent(indexName)}/_count`,
        { env: esEnv }
      );
      documentCount = countResult?.count || 0;
    } catch {
      // Index may not exist yet
    }

    return {
      configured: true,
      available: true,
      status: health.status || 'unknown',
      index: indexName,
      documentCount,
    };
  } catch (error) {
    return {
      configured: true,
      available: false,
      status: 'unavailable',
      index: indexName,
      documentCount: 0,
    };
  }
}
