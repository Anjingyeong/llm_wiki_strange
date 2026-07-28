import { embedText } from '../embedding.mjs';
import { elasticConfig, elasticRequest } from './client.mjs';

const SOURCE_FIELDS = [
  'id','documentId','slug','title','displayTitle','category','tags','entities',
  'codeSymbols','referencedFiles','relatedSlugs','headingPath','sectionTitle',
  'content','summary','sourcePath','updatedAt','implementationStatus','chunkOrder',
];

function filtersToQuery(filters = {}) {
  const clauses = [];
  for (const [field, raw] of Object.entries(filters)) {
    if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    clauses.push(values.length === 1
      ? { term: { [field]: values[0] } }
      : { terms: { [field]: values } });
  }
  return clauses;
}

function normalizeHit(hit, matchedBy) {
  const source = hit._source || {};
  return {
    ...source,
    text: source.content || '',
    section: source.sectionTitle || source.headingPath || '',
    score: Number(hit._score || 0),
    matchedBy: [matchedBy],
  };
}

export async function searchElasticBm25(query, { limit = 5, retrieveLimit = 40, filters = {}, env = process.env } = {}) {
  const { index } = elasticConfig(env);
  const filter = filtersToQuery(filters);
  const body = {
    size: retrieveLimit,
    _source: SOURCE_FIELDS,
    query: {
      bool: {
        filter,
        should: [
          { term: { codeSymbols: { value: query, boost: 8 } } },
          { term: { 'title.keyword': { value: query, boost: 6 } } },
          {
            multi_match: {
              query,
              type: 'best_fields',
              fields: [
                'codeSymbols^6',
                'title^5',
                'displayTitle^4',
                'tags^3',
                'entities^3',
                'headingPath^2.5',
                'sectionTitle^2.5',
                'summary^1.5',
                'content',
              ],
              operator: 'or',
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
  };
  const payload = await elasticRequest(`/${encodeURIComponent(index)}/_search`, { method: 'POST', body, env });
  return payload.hits.hits.map((hit) => normalizeHit(hit, 'elastic-bm25')).slice(0, limit);
}

export async function searchElasticKnn(query, { limit = 5, retrieveLimit = 40, filters = {}, env = process.env } = {}) {
  const { index } = elasticConfig(env);
  const filter = filtersToQuery(filters);
  const body = {
    size: retrieveLimit,
    _source: SOURCE_FIELDS,
    knn: {
      field: 'embedding',
      query_vector: embedText(query),
      k: retrieveLimit,
      num_candidates: Math.max(retrieveLimit * 4, 100),
      ...(filter.length ? { filter: { bool: { filter } } } : {}),
    },
  };
  const payload = await elasticRequest(`/${encodeURIComponent(index)}/_search`, { method: 'POST', body, env });
  return payload.hits.hits.map((hit) => normalizeHit(hit, 'elastic-knn')).slice(0, limit);
}

export function reciprocalRankFuse(resultSets, { limit = 5, rankConstant = 60 } = {}) {
  const fused = new Map();
  resultSets.forEach((results, channelIndex) => {
    results.forEach((result, rank) => {
      const key = result.id || `${result.documentId}:${result.sectionTitle}:${result.chunkOrder}`;
      const current = fused.get(key) || { ...result, score: 0, matchedBy: [] };
      current.score += 1 / (rankConstant + rank + 1);
      current.matchedBy = [...new Set([...(current.matchedBy || []), ...(result.matchedBy || []), 'elastic-rrf'])];
      current.channels = [...new Set([...(current.channels || []), channelIndex])];
      fused.set(key, current);
    });
  });
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function searchElasticHybrid(query, options = {}) {
  const retrieveLimit = options.retrieveLimit || 40;
  const [bm25, knn] = await Promise.all([
    searchElasticBm25(query, { ...options, limit: retrieveLimit, retrieveLimit }),
    searchElasticKnn(query, { ...options, limit: retrieveLimit, retrieveLimit }),
  ]);
  return reciprocalRankFuse([bm25, knn], {
    limit: options.limit || 5,
    rankConstant: options.rankConstant || 60,
  });
}

export async function searchElastic(query, { mode = 'hybrid', ...options } = {}) {
  if (mode === 'bm25') return searchElasticBm25(query, options);
  if (mode === 'knn' || mode === 'vector') return searchElasticKnn(query, options);
  if (mode === 'hybrid' || mode === 'rrf') return searchElasticHybrid(query, options);
  throw new Error(`Unsupported Elasticsearch retrieval mode: ${mode}`);
}
