const initializedBindings = new WeakSet();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rag_document_metadata (
  document_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  display_title TEXT,
  nav_title TEXT,
  short_title TEXT,
  category TEXT,
  doc_type TEXT,
  source_path TEXT,
  summary TEXT,
  implementation_status TEXT,
  updated_at TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  related_docs_json TEXT NOT NULL DEFAULT '[]',
  related_files_json TEXT NOT NULL DEFAULT '[]',
  entities_json TEXT NOT NULL DEFAULT '[]',
  code_symbols_json TEXT NOT NULL DEFAULT '[]',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  corpus_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_document_metadata_slug
  ON rag_document_metadata(slug);
CREATE INDEX IF NOT EXISTS idx_rag_document_metadata_corpus
  ON rag_document_metadata(corpus_hash);
CREATE TABLE IF NOT EXISTS rag_index_state (
  id TEXT PRIMARY KEY,
  corpus_hash TEXT NOT NULL,
  document_count INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);
`;

const UPSERT_SQL = `
INSERT INTO rag_document_metadata (
  document_id, slug, title, display_title, nav_title, short_title,
  category, doc_type, source_path, summary, implementation_status,
  updated_at, tags_json, related_docs_json, related_files_json,
  entities_json, code_symbols_json, chunk_count, corpus_hash, indexed_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(document_id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  display_title = excluded.display_title,
  nav_title = excluded.nav_title,
  short_title = excluded.short_title,
  category = excluded.category,
  doc_type = excluded.doc_type,
  source_path = excluded.source_path,
  summary = excluded.summary,
  implementation_status = excluded.implementation_status,
  updated_at = excluded.updated_at,
  tags_json = excluded.tags_json,
  related_docs_json = excluded.related_docs_json,
  related_files_json = excluded.related_files_json,
  entities_json = excluded.entities_json,
  code_symbols_json = excluded.code_symbols_json,
  chunk_count = excluded.chunk_count,
  corpus_hash = excluded.corpus_hash,
  indexed_at = excluded.indexed_at
`;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function encodeJson(value) {
  return JSON.stringify(asArray(value));
}

function decodeJson(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return asArray(parsed);
  } catch {
    return [];
  }
}

function documentKey(value) {
  return value?.documentId || value?.document_id || value?.slug || value?.documentSlug || '';
}

function corpusHashOf(index) {
  return index?.corpusHash || index?.manifest?.corpusHash || 'unknown-corpus';
}

export function getRagMetadataBinding(env = {}) {
  const binding = env?.RAG_DB || env?.DB;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

export function buildDocumentMetadataRows(index) {
  const counts = new Map();
  for (const chunk of asArray(index?.chunks)) {
    const key = documentKey(chunk);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const corpusHash = corpusHashOf(index);
  const indexedAt = new Date().toISOString();
  return asArray(index?.documents).map((document) => {
    const id = documentKey(document);
    const slug = document.slug || id;
    const relatedFiles = document.relatedFiles || document.referencedFiles;
    return {
      documentId: id || slug,
      slug,
      title: document.title || slug,
      displayTitle: document.displayTitle || document.navTitle || document.title || slug,
      navTitle: document.navTitle || '',
      shortTitle: document.shortTitle || '',
      category: document.category || document.navCategory || '',
      type: document.type || document.evidence_type || '',
      sourcePath: document.sourcePath || '',
      summary: document.summary || document.excerpt || '',
      implementationStatus: document.implementation_status || document.status || '',
      updatedAt: document.updatedAt || '',
      tagsJson: encodeJson(document.tags),
      relatedDocsJson: encodeJson(document.relatedDocs),
      relatedFilesJson: encodeJson(relatedFiles),
      entitiesJson: encodeJson(document.entities),
      codeSymbolsJson: encodeJson(document.codeSymbols),
      chunkCount: counts.get(id) || counts.get(slug) || 0,
      corpusHash,
      indexedAt,
    };
  });
}

async function ensureSchema(db) {
  if (initializedBindings.has(db)) return;
  await db.exec(SCHEMA_SQL);
  initializedBindings.add(db);
}

function metadataStore(provider, status, index, extra = {}) {
  return {
    provider,
    status,
    corpusHash: corpusHashOf(index),
    documentCount: asArray(index?.documents).length,
    chunkCount: asArray(index?.chunks).length,
    ...extra,
  };
}

export async function syncRagMetadata(env, index) {
  const db = getRagMetadataBinding(env);
  if (!db) return metadataStore('file', 'd1_unbound', index);

  await ensureSchema(db);
  const corpusHash = corpusHashOf(index);
  const state = await db
    .prepare('SELECT corpus_hash FROM rag_index_state WHERE id = ?')
    .bind('active')
    .first();

  if (state?.corpus_hash === corpusHash) {
    return metadataStore('d1', 'current', index);
  }

  const rows = buildDocumentMetadataRows(index);
  const statements = rows.map((row) =>
    db.prepare(UPSERT_SQL).bind(
      row.documentId,
      row.slug,
      row.title,
      row.displayTitle,
      row.navTitle,
      row.shortTitle,
      row.category,
      row.type,
      row.sourcePath,
      row.summary,
      row.implementationStatus,
      row.updatedAt,
      row.tagsJson,
      row.relatedDocsJson,
      row.relatedFilesJson,
      row.entitiesJson,
      row.codeSymbolsJson,
      row.chunkCount,
      row.corpusHash,
      row.indexedAt,
    ),
  );

  if (statements.length > 0) await db.batch(statements);
  await db
    .prepare('DELETE FROM rag_document_metadata WHERE corpus_hash <> ?')
    .bind(corpusHash)
    .run();
  await db
    .prepare(`
      INSERT INTO rag_index_state (id, corpus_hash, document_count, chunk_count, synced_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        corpus_hash = excluded.corpus_hash,
        document_count = excluded.document_count,
        chunk_count = excluded.chunk_count,
        synced_at = excluded.synced_at
    `)
    .bind('active', corpusHash, rows.length, asArray(index?.chunks).length, new Date().toISOString())
    .run();

  return metadataStore('d1', 'synced', index);
}

function rowToMetadata(row) {
  return {
    documentId: row.document_id,
    slug: row.slug,
    title: row.title,
    displayTitle: row.display_title,
    navTitle: row.nav_title,
    shortTitle: row.short_title,
    category: row.category,
    type: row.doc_type,
    sourcePath: row.source_path,
    summary: row.summary,
    implementation_status: row.implementation_status,
    updatedAt: row.updated_at,
    tags: decodeJson(row.tags_json),
    relatedDocs: decodeJson(row.related_docs_json),
    relatedFiles: decodeJson(row.related_files_json),
    entities: decodeJson(row.entities_json),
    codeSymbols: decodeJson(row.code_symbols_json),
    chunkCount: row.chunk_count,
  };
}

async function loadMetadataBySlugs(db, slugs) {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  if (uniqueSlugs.length === 0) return new Map();
  const placeholders = uniqueSlugs.map(() => '?').join(', ');
  const response = await db
    .prepare(`SELECT * FROM rag_document_metadata WHERE slug IN (${placeholders})`)
    .bind(...uniqueSlugs)
    .all();
  return new Map(asArray(response?.results).map((row) => [row.slug, rowToMetadata(row)]));
}

function mergeMetadata(item, metadata) {
  if (!metadata) return item;
  return {
    ...item,
    documentId: metadata.documentId || item.documentId,
    slug: metadata.slug || item.slug,
    title: metadata.title || item.title,
    displayTitle: metadata.displayTitle || item.displayTitle,
    navTitle: metadata.navTitle || item.navTitle,
    shortTitle: metadata.shortTitle || item.shortTitle,
    category: metadata.category || item.category,
    type: metadata.type || item.type,
    sourcePath: metadata.sourcePath || item.sourcePath,
    summary: metadata.summary || item.summary,
    implementation_status: metadata.implementation_status || item.implementation_status,
    updatedAt: metadata.updatedAt || item.updatedAt,
    tags: metadata.tags.length ? metadata.tags : item.tags,
    relatedDocs: metadata.relatedDocs.length ? metadata.relatedDocs : item.relatedDocs,
    relatedFiles: metadata.relatedFiles.length ? metadata.relatedFiles : item.relatedFiles,
    referencedFiles: metadata.relatedFiles.length ? metadata.relatedFiles : item.referencedFiles,
    entities: metadata.entities.length ? metadata.entities : item.entities,
    codeSymbols: metadata.codeSymbols.length ? metadata.codeSymbols : item.codeSymbols,
    metadataChunkCount: metadata.chunkCount,
  };
}

async function enrichItems(env, index, items) {
  const store = await syncRagMetadata(env, index);
  const db = getRagMetadataBinding(env);
  if (!db || store.provider !== 'd1') return { items, store };
  const bySlug = await loadMetadataBySlugs(db, items.map((item) => item?.slug));
  return {
    items: items.map((item) => mergeMetadata(item, bySlug.get(item?.slug))),
    store,
  };
}

export async function enrichSearchPayloadWithMetadata(env, index, payload) {
  try {
    const { items, store } = await enrichItems(env, index, asArray(payload?.results));
    return { ...payload, results: items, metadataStore: store };
  } catch {
    return {
      ...payload,
      metadataStore: metadataStore('file', 'd1_fallback', index),
    };
  }
}

export async function enrichAnswerResultWithMetadata(env, index, result) {
  try {
    const { items, store } = await enrichItems(env, index, asArray(result?.sources));
    return { ...result, sources: items, metadataStore: store };
  } catch {
    return {
      ...result,
      metadataStore: metadataStore('file', 'd1_fallback', index),
    };
  }
}
