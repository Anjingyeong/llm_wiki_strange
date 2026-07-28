import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { elasticConfig, elasticRequest } from './client.mjs';

export const VECTOR_DIMS = 256;

export function indexDefinition() {
  return {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      refresh_interval: '1s',
      analysis: {
        analyzer: {
          wiki_text: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
        },
      },
    },
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        documentId: { type: 'keyword' },
        slug: { type: 'keyword' },
        title: { type: 'text', analyzer: 'wiki_text', fields: { keyword: { type: 'keyword' } } },
        displayTitle: { type: 'text', analyzer: 'wiki_text', fields: { keyword: { type: 'keyword' } } },
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        entities: { type: 'keyword' },
        codeSymbols: { type: 'keyword' },
        referencedFiles: { type: 'keyword' },
        relatedSlugs: { type: 'keyword' },
        headingPath: { type: 'text', analyzer: 'wiki_text' },
        sectionTitle: { type: 'text', analyzer: 'wiki_text' },
        content: { type: 'text', analyzer: 'wiki_text' },
        summary: { type: 'text', analyzer: 'wiki_text' },
        sourcePath: { type: 'keyword' },
        updatedAt: { type: 'date', ignore_malformed: true },
        implementationStatus: { type: 'keyword' },
        chunkOrder: { type: 'integer' },
        embedding: {
          type: 'dense_vector',
          dims: VECTOR_DIMS,
          index: true,
          similarity: 'cosine',
          index_options: { type: 'int8_hnsw' },
        },
      },
    },
  };
}

export function toElasticDocument(chunk) {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    slug: chunk.documentSlug || chunk.slug || chunk.documentId,
    title: chunk.title || '',
    displayTitle: chunk.displayTitle || chunk.navTitle || chunk.title || '',
    category: chunk.category || '',
    tags: chunk.tags || [],
    entities: chunk.entities || [],
    codeSymbols: chunk.codeSymbols || [],
    referencedFiles: chunk.referencedFiles || [],
    relatedSlugs: chunk.relatedSlugs || [],
    headingPath: chunk.headingPath || '',
    sectionTitle: chunk.sectionTitle || chunk.section || '',
    content: chunk.text || chunk.content || '',
    summary: chunk.summary || '',
    sourcePath: chunk.sourcePath || chunk.sourceFile || '',
    updatedAt: chunk.updatedAt || null,
    implementationStatus: chunk.implementation_status || chunk.metadata?.implementation_status || 'unknown',
    chunkOrder: Number(chunk.chunkOrder || 0),
    embedding: chunk.embedding,
  };
}

export async function recreateAndBulkIndex({
  indexPath = 'data/ragVectorIndex.json',
  env = process.env,
  batchSize = 200,
} = {}) {
  const { index } = elasticConfig(env);
  const source = JSON.parse(await readFile(resolve(indexPath), 'utf8'));
  const chunks = source.chunks || [];

  try {
    await elasticRequest(`/${encodeURIComponent(index)}`, { method: 'DELETE', env });
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  await elasticRequest(`/${encodeURIComponent(index)}`, {
    method: 'PUT',
    body: indexDefinition(),
    env,
  });

  let indexed = 0;
  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    const batch = chunks.slice(offset, offset + batchSize);
    const lines = [];
    for (const chunk of batch) {
      lines.push(JSON.stringify({ index: { _index: index, _id: chunk.id } }));
      lines.push(JSON.stringify(toElasticDocument(chunk)));
    }
    const config = elasticConfig(env);
    const headers = { 'content-type': 'application/x-ndjson', accept: 'application/json' };
    if (config.username) {
      headers.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    }
    const response = await fetch(`${config.url}/_bulk`, {
      method: 'POST',
      headers,
      body: `${lines.join('\n')}\n`,
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) {
      const failures = (payload.items || []).filter((item) => item.index?.error).slice(0, 5);
      throw new Error(`Elasticsearch bulk indexing failed: ${JSON.stringify(failures)}`);
    }
    indexed += batch.length;
  }
  await elasticRequest(`/${encodeURIComponent(index)}/_refresh`, { method: 'POST', env });
  const count = await elasticRequest(`/${encodeURIComponent(index)}/_count`, { env });
  return {
    index,
    sourceDocumentCount: new Set(chunks.map((chunk) => chunk.documentId)).size,
    sourceChunkCount: chunks.length,
    indexedChunkCount: count.count,
    indexed,
  };
}
