import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDocumentMetadataRows,
  enrichSearchPayloadWithMetadata,
  getRagMetadataBinding,
} from '../functions/lib/rag-metadata.js';

const index = {
  corpusHash: 'corpus-test',
  documents: [
    {
      documentId: 'doc-1',
      slug: 'Doc-One',
      title: 'Document One',
      displayTitle: 'Doc One',
      category: 'Test',
      tags: ['rag', 'd1'],
      relatedDocs: ['Doc-Two'],
      referencedFiles: ['src/example.ts'],
      entities: ['Cloudflare D1'],
      codeSymbols: ['syncRagMetadata'],
      implementation_status: 'implemented',
    },
  ],
  chunks: [
    { documentId: 'doc-1', slug: 'Doc-One' },
    { documentId: 'doc-1', slug: 'Doc-One' },
  ],
};

test('D1 metadata helpers', async (t) => {
  await t.test('RAG_DB is preferred and DB remains a compatibility fallback', () => {
    const primary = { prepare() {} };
    const fallback = { prepare() {} };
    assert.strictEqual(getRagMetadataBinding({ RAG_DB: primary, DB: fallback }), primary);
    assert.strictEqual(getRagMetadataBinding({ DB: fallback }), fallback);
    assert.strictEqual(getRagMetadataBinding({}), null);
  });

  await t.test('document rows preserve metadata and aggregate chunk counts', () => {
    const [row] = buildDocumentMetadataRows(index);
    assert.strictEqual(row.documentId, 'doc-1');
    assert.strictEqual(row.slug, 'Doc-One');
    assert.strictEqual(row.chunkCount, 2);
    assert.strictEqual(row.corpusHash, 'corpus-test');
    assert.deepStrictEqual(JSON.parse(row.tagsJson), ['rag', 'd1']);
    assert.deepStrictEqual(JSON.parse(row.relatedFilesJson), ['src/example.ts']);
  });

  await t.test('missing D1 binding keeps static file metadata as a safe fallback', async () => {
    const payload = { status: 'ok', results: [{ slug: 'Doc-One', title: 'Document One' }] };
    const enriched = await enrichSearchPayloadWithMetadata({}, index, payload);
    assert.deepStrictEqual(enriched.results, payload.results);
    assert.strictEqual(enriched.metadataStore.provider, 'file');
    assert.strictEqual(enriched.metadataStore.status, 'd1_unbound');
  });
});
