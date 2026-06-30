import { embedText, stableHash, VECTOR_SIZE } from './embedding.mjs';

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkSection(section, maxChars) {
  const plain = stripMarkdown(section.body);
  if (!plain) {
    return [];
  }

  const chunks = [];
  let cursor = 0;
  while (cursor < plain.length) {
    const next = plain.slice(cursor, cursor + maxChars);
    const cut = next.length === maxChars ? next.lastIndexOf(' ') : next.length;
    const end = cut > 300 ? cursor + cut : cursor + next.length;
    chunks.push({ section: section.section, text: plain.slice(cursor, end).trim() });
    cursor = end;
  }
  return chunks.filter((chunk) => chunk.text.length > 0);
}

function splitSections(body) {
  const sections = [];
  let current = { section: '문서 개요', body: '' };
  for (const line of body.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      if (current.body.trim()) {
        sections.push(current);
      }
      current = { section: heading[2] ?? '문서 개요', body: '' };
    } else {
      current = { ...current, body: `${current.body}\n${line}` };
    }
  }
  if (current.body.trim()) {
    sections.push(current);
  }
  return sections;
}

function makeChunk(document, section, text) {
  return {
    id: `${document.slug}#${stableHash(`${section}:${text}`).toString(16)}`,
    documentId: document.slug,
    slug: document.slug,
    title: document.title,
    category: document.category,
    section,
    text,
    updatedAt: document.updatedAt,
    embedding: embedText(`${document.title} ${section} ${text}`),
  };
}

export function buildRagIndex(documents, options = {}) {
  const chunkSize = options.chunkSize ?? 1100;
  const chunks = [];
  for (const document of documents) {
    for (const section of splitSections(document.body)) {
      for (const chunk of chunkSection(section, chunkSize)) {
        chunks.push(makeChunk(document, chunk.section, chunk.text));
      }
    }
  }

  return {
    version: 1,
    embedding: {
      provider: 'local-hash-tfidf',
      dimensions: VECTOR_SIZE,
    },
    generatedAt: new Date().toISOString(),
    chunks,
  };
}
