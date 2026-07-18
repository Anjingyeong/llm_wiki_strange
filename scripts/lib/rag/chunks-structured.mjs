import { createHash } from 'node:crypto';
import { embedText, stableHash, VECTOR_SIZE } from './embedding.mjs';
import { allocateHeadingIds } from '../../../src/lib/wikiHeadings.mjs';
import { extractWikiMachineMetadata } from '../wiki-source-document.mjs';

export const STRUCTURE_SCHEMA_VERSION = 'structure-aware-v1';
export const STRUCTURE_CONTEXTUAL_SCHEMA_VERSION = 'structure-aware-contextual-v1';

const MIN_SECTION_CHARS = 80;
const MAX_CHUNK_CHARS = 1400;

function asStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [trimmed];
}

function sha1(value) {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, 16);
}

function stripInlineMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyChunkType(headingPath, body, unitKind) {
  if (unitKind === 'code') return 'code';
  if (unitKind === 'table') return 'table';
  const hay = `${headingPath}\n${body}`.toLowerCase();
  if (/(decision|판단|결정|\badr\b)/i.test(hay)) return 'decision';
  if (/(metric|지표|latency|hit@|recall|mrr|ndcg|benchmark)/i.test(hay)) return 'metric';
  if (/(bug|장애|오류|fix|rollback)/i.test(hay)) return 'bug';
  if (/(architecture|아키텍처|pipeline|흐름|data-flow)/i.test(hay)) return 'architecture';
  return 'prose';
}

function extractCodeSymbols(code) {
  const symbols = new Set();
  for (const match of code.matchAll(/\b([A-Za-z_][\w.-]{2,})\b/g)) {
    const token = match[1];
    if (token.length > 3 && !/^(const|function|return|import|export|class|true|false)$/i.test(token)) {
      symbols.add(token);
    }
  }
  return [...symbols].slice(0, 24);
}

function extractReferencedFiles(text) {
  const files = new Set();
  for (const match of text.matchAll(/(?:[\w./-]+\.(?:py|ts|tsx|js|mjs|java|yml|yaml|md|json|sh|bat))\b/g)) {
    files.add(match[0]);
  }
  return [...files].slice(0, 20);
}

function extractTechTerms(text, tags = []) {
  const terms = new Set(tags.map(String));
  const patterns = [
    /\bYOLO[\w.-]*/gi,
    /\bLSTM\b/gi,
    /\bByteTrack\b/gi,
    /\bRTSP\b/gi,
    /\bWebRTC\b/gi,
    /\bMQTT\b/gi,
    /\bMediaMTX\b/gi,
    /\bTensorRT\b/gi,
    /\bpgvector\b/gi,
    /\bVLM\b/gi,
    /\bcameraLoginId\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      terms.add(match[0]);
    }
  }
  return [...terms].slice(0, 20);
}

/**
 * Tokenize markdown body into structure units without splitting tables mid-row or code fences.
 */
export function parseMarkdownUnits(body) {
  const lines = body.split(/\r?\n/);
  const units = [];
  const allocatedSectionIds = allocateHeadingIds(
    lines
      .map((line) => /^(#{2,3})\s+(.+)$/.exec(line))
      .filter(Boolean)
      .map((match) => ({ text: stripInlineMarkdown(match[2]), level: match[1].length })),
  );
  let allocatedSectionIndex = 0;
  let currentSectionId = null;
  let headingStack = [];
  let buffer = [];
  let mode = 'prose'; // prose | table | code
  let codeLang = '';

  const flushProse = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (!text) return;
    units.push({
      kind: 'prose',
      headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
      sectionId: currentSectionId,
      text,
    });
  };

  for (const line of lines) {
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      if (mode === 'code') {
        const code = buffer.join('\n');
        buffer = [];
        mode = 'prose';
        units.push({
          kind: 'code',
          headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
          sectionId: currentSectionId,
          text: code,
          lang: codeLang,
        });
        codeLang = '';
      } else {
        if (mode === 'table') {
          units.push({
            kind: 'table',
            headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
            sectionId: currentSectionId,
            text: buffer.join('\n'),
          });
          buffer = [];
        } else {
          flushProse();
        }
        mode = 'code';
        codeLang = fence[1] || '';
        buffer = [];
      }
      continue;
    }

    if (mode === 'code') {
      buffer.push(line);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      if (mode === 'table') {
        units.push({
          kind: 'table',
          headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
          sectionId: currentSectionId,
          text: buffer.join('\n'),
        });
        buffer = [];
        mode = 'prose';
      } else {
        flushProse();
      }
      const level = heading[1].length;
      const text = stripInlineMarkdown(heading[2]);
      headingStack = headingStack.filter((item) => item.level < level);
      headingStack.push({ level, text });
      if (level === 1) currentSectionId = null;
      if (level === 2 || level === 3) {
        currentSectionId = allocatedSectionIds[allocatedSectionIndex++]?.id ?? null;
      }
      continue;
    }

    const isTable = line.trim().includes('|') && (line.trim().startsWith('|') || /\|.+\|/.test(line));
    if (isTable) {
      if (mode !== 'table') {
        flushProse();
        mode = 'table';
        buffer = [line];
      } else {
        buffer.push(line);
      }
      continue;
    }

    if (mode === 'table') {
      units.push({
        kind: 'table',
        headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
        sectionId: currentSectionId,
        text: buffer.join('\n'),
      });
      buffer = [];
      mode = 'prose';
    }
    buffer.push(line);
  }

  if (mode === 'code') {
    units.push({
      kind: 'code',
      headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
      sectionId: currentSectionId,
      text: buffer.join('\n'),
      lang: codeLang,
    });
  } else if (mode === 'table') {
    units.push({
      kind: 'table',
      headingPath: headingStack.map((item) => item.text).join(' > ') || '문서 개요',
      sectionId: currentSectionId,
      text: buffer.join('\n'),
    });
  } else {
    flushProse();
  }

  return units;
}

function mergeShortUnits(units) {
  const merged = [];
  for (const unit of units) {
    if (
      merged.length > 0
      && unit.kind === 'prose'
      && unit.text.length < MIN_SECTION_CHARS
      && merged[merged.length - 1].kind === 'prose'
      && merged[merged.length - 1].headingPath === unit.headingPath
      && merged[merged.length - 1].sectionId === unit.sectionId
    ) {
      merged[merged.length - 1] = {
        ...merged[merged.length - 1],
        text: `${merged[merged.length - 1].text}\n\n${unit.text}`.trim(),
      };
      continue;
    }
    if (
      unit.kind === 'prose'
      && unit.text.length < MIN_SECTION_CHARS
      && merged.length > 0
      && merged[merged.length - 1].kind === 'prose'
      && merged[merged.length - 1].sectionId === unit.sectionId
    ) {
      // attach tiny orphan section to previous prose with path note
      const prev = merged[merged.length - 1];
      merged[merged.length - 1] = {
        ...prev,
        text: `${prev.text}\n\n(${unit.headingPath})\n${unit.text}`.trim(),
      };
      continue;
    }
    merged.push(unit);
  }
  return merged;
}

function splitLongProse(text, maxChars) {
  if (text.length <= maxChars) {
    return [text];
  }
  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + maxChars);
    if (end < text.length) {
      const window = text.slice(cursor, end);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf(' '));
      if (cut > maxChars * 0.4) {
        end = cursor + cut + 1;
      }
    }
    const slice = text.slice(cursor, end).trim();
    if (slice) parts.push(slice);
    cursor = end;
  }
  return parts;
}

function buildContextualPrefix(document, unit, techTerms, referencedFiles) {
  const lines = [
    `문서: ${document.displayTitle || document.title || document.slug}`,
    `분류: ${document.category || 'Unknown'}`,
    `섹션: ${unit.headingPath || '문서 개요'}`,
  ];
  if (techTerms.length) {
    lines.push(`관련 기술: ${techTerms.slice(0, 8).join(', ')}`);
  }
  if (referencedFiles.length) {
    lines.push(`관련 파일: ${referencedFiles.slice(0, 6).join(', ')}`);
  }
  if (document.relatedDocs?.length || document.relatedSlugs?.length) {
    const related = asStringList(document.relatedDocs ?? document.relatedSlugs).slice(0, 6);
    if (related.length) lines.push(`관련 문서: ${related.join(', ')}`);
  }
  return lines.join('\n');
}

function makeStructuredChunk(document, unit, content, chunkOrder, options) {
  const tags = asStringList(document.tags);
  const entities = asStringList(document.entities);
  const relatedDocs = asStringList(document.relatedDocs ?? document.relatedSlugs);
  const codeSymbols = unit.kind === 'code' ? extractCodeSymbols(content) : extractCodeSymbols(content).slice(0, 8);
  const referencedFiles = extractReferencedFiles(`${content}\n${document.summary || ''}`);
  const techTerms = extractTechTerms(`${content}\n${entities.join(' ')}`, tags);
  const chunkType = classifyChunkType(unit.headingPath, content, unit.kind);
  const contextualPrefix = options.contextualPrefix
    ? buildContextualPrefix(document, unit, techTerms, referencedFiles)
    : '';
  const searchableText = contextualPrefix ? `${contextualPrefix}\n\n${content}` : content;
  const contentHash = sha1(content);
  const machineMetadata = extractWikiMachineMetadata(document);
  const chunkHash = sha1(
    [
      document.slug,
      unit.headingPath,
      chunkType,
      contentHash,
      options.contextualPrefix ? 'ctx1' : 'ctx0',
      STRUCTURE_SCHEMA_VERSION,
      JSON.stringify(machineMetadata),
    ].join('|'),
  );
  const displayTitle = document.displayTitle ?? document.navTitle ?? document.shortTitle ?? document.title;
  const schemaVersion = options.contextualPrefix
    ? STRUCTURE_CONTEXTUAL_SCHEMA_VERSION
    : STRUCTURE_SCHEMA_VERSION;
  return {
    id: `${document.slug}#${chunkHash}`,
    documentId: document.slug,
    documentSlug: document.slug,
    slug: document.slug,
    title: document.title,
    navTitle: document.navTitle,
    shortTitle: document.shortTitle,
    displayTitle,
    category: document.category,
    tags,
    entities,
    updatedAt: document.updatedAt,
    headingPath: unit.headingPath,
    section: unit.headingPath,
    sectionId: unit.sectionId ?? null,
    sectionTitle: unit.headingPath,
    relatedDocs,
    relatedSlugs: relatedDocs,
    chunkType,
    sourceFile: document.sourcePath ?? `content/${document.slug}.md`,
    sourcePath: document.sourcePath ?? `content/${document.slug}.md`,
    codeSymbols,
    referencedFiles,
    content,
    contextualPrefix,
    text: searchableText,
    contentHash,
    chunkHash,
    chunkSchemaVersion: schemaVersion,
    summary: document.summary ?? '',
    order: document.order ?? 999,
    chunkOrder,
    project: document.project,
    type: document.type,
    portfolio_use: document.portfolio_use,
    evidence_type: document.evidence_type,
    ...machineMetadata,
    metadata: {
      category: document.category,
      tags,
      entities,
      updatedAt: document.updatedAt,
      slug: document.slug,
      title: document.title,
      displayTitle,
      sectionTitle: unit.headingPath,
      sectionId: unit.sectionId ?? null,
      chunkType,
      chunkSchemaVersion: schemaVersion,
      relatedSlugs: relatedDocs,
      ...machineMetadata,
    },
    embedding: embedText(
      `${displayTitle} ${document.title} ${document.slug} ${unit.headingPath} ${tags.join(' ')} ${entities.join(' ')} ${document.summary || ''} ${codeSymbols.join(' ')} ${searchableText}`,
    ),
  };
}

/**
 * Structure-aware (+ optional contextual prefix) index builder.
 */
export function buildRagIndexStructured(documents, options = {}) {
  const contextualPrefix = Boolean(options.contextualPrefix);
  const maxChars = options.chunkSize ?? MAX_CHUNK_CHARS;
  const chunks = [];
  const orderedDocuments = [...documents].sort((left, right) => {
    const orderDiff = (left.order ?? 999) - (right.order ?? 999);
    const leftTitle = left.displayTitle ?? left.title;
    const rightTitle = right.displayTitle ?? right.title;
    return orderDiff === 0 ? String(leftTitle).localeCompare(String(rightTitle)) : orderDiff;
  });

  for (const document of orderedDocuments) {
    let chunkOrder = 0;
    const units = mergeShortUnits(parseMarkdownUnits(document.body || ''));
    for (const unit of units) {
      if (unit.kind === 'table' || unit.kind === 'code') {
        chunks.push(makeStructuredChunk(document, unit, unit.text.trim(), chunkOrder++, { contextualPrefix }));
        continue;
      }
      for (const part of splitLongProse(stripInlineMarkdown(unit.text), maxChars)) {
        chunks.push(makeStructuredChunk(document, unit, part, chunkOrder++, { contextualPrefix }));
      }
    }
  }

  return {
    version: 2,
    chunkSchemaVersion: contextualPrefix ? STRUCTURE_CONTEXTUAL_SCHEMA_VERSION : STRUCTURE_SCHEMA_VERSION,
    embedding: {
      provider: 'local-hash-tfidf',
      dimensions: VECTOR_SIZE,
      embeddingVersion: 'local-hash-tfidf-v1',
    },
    generatedAt: new Date().toISOString(),
    chunks,
  };
}

export function documentContentHash(document) {
  return sha1(
    JSON.stringify({
      slug: document.slug,
      title: document.title,
      category: document.category,
      tags: document.tags,
      updatedAt: document.updatedAt,
      relatedDocs: document.relatedDocs,
      ...extractWikiMachineMetadata(document),
      body: document.body,
    }),
  );
}

/**
 * Incremental merge: reuse embeddings/chunks when chunkHash unchanged.
 */
export function mergeIncrementalIndex(previousIndex, nextIndex) {
  const prevByHash = new Map((previousIndex?.chunks || []).map((chunk) => [chunk.chunkHash || chunk.id, chunk]));
  let reused = 0;
  let rebuilt = 0;
  const chunks = nextIndex.chunks.map((chunk) => {
    const prev = prevByHash.get(chunk.chunkHash);
    if (prev && prev.embedding && Array.isArray(prev.embedding) && prev.text === chunk.text) {
      reused += 1;
      return { ...chunk, embedding: prev.embedding, reused: true };
    }
    rebuilt += 1;
    return { ...chunk, reused: false };
  });
  return {
    index: {
      ...nextIndex,
      chunks,
      incremental: { reused, rebuilt, previousChunkCount: previousIndex?.chunks?.length ?? 0 },
    },
    reused,
    rebuilt,
  };
}
