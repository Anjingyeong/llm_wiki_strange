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
