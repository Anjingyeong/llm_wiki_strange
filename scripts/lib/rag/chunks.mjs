import { embedText, stableHash, VECTOR_SIZE } from './embedding.mjs';

function summarizeCodeFence(code, lang) {
  const trimmed = code.trim();
  if (lang === 'json') {
    try {
      const parsed = JSON.parse(trimmed);
      const keys = Object.keys(parsed);
      return `[JSON Payload Keys: ${keys.join(', ')}]`;
    } catch (e) {
      const keys = [...trimmed.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]);
      const uniqueKeys = [...new Set(keys)].slice(0, 15);
      return `[JSON Payload Keys: ${uniqueKeys.join(', ')}]`;
    }
  } else if (lang === 'bash' || lang === 'sh' || lang === 'cmd' || lang === 'text') {
    const commands = [...trimmed.matchAll(/(npm run \S+|npm test|npm install|tsc --noEmit|vite build|serve_ai_overlay\.py\s+\S+)/g)].map(m => m[1]);
    if (commands.length > 0) {
      return `[Commands: ${[...new Set(commands)].join(', ')}]`;
    }
  }
  const words = [...trimmed.matchAll(/([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const uniqueWords = [...new Set(words)].filter(w => w.length > 3).slice(0, 15);
  return `[Code Keywords: ${uniqueWords.join(', ')}]`;
}

function replaceCodeFences(body) {
  return body.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const summary = summarizeCodeFence(code, lang);
    return `\n${summary}\n`;
  });
}

function stripMarkdownText(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoBlocks(body) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const isTableLine = trimmed.includes('|');

    if (isTableLine) {
      if (currentBlock && currentBlock.type === 'table') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'table', lines: [line] };
      }
    } else {
      if (currentBlock && currentBlock.type === 'text') {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'text', lines: [line] };
      }
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks.map(block => {
    if (block.type === 'table') {
      return {
        type: 'table',
        text: block.lines.join('\n')
      };
    } else {
      const rawText = block.lines.join(' ');
      return {
        type: 'text',
        text: stripMarkdownText(rawText)
      };
    }
  }).filter(block => block.text.trim().length > 0);
}

function chunkSection(section, maxChars) {
  const bodyWithSummaries = replaceCodeFences(section.body);
  const blocks = splitIntoBlocks(bodyWithSummaries);
  const chunks = [];
  let currentChunkText = '';

  for (const block of blocks) {
    if (block.type === 'table') {
      if (currentChunkText.trim()) {
        chunks.push({ section: section.section, text: currentChunkText.trim() });
        currentChunkText = '';
      }
      chunks.push({ section: section.section, text: block.text });
    } else {
      let textToProcess = block.text;
      if (currentChunkText.length + textToProcess.length + 2 <= maxChars) {
        currentChunkText = currentChunkText ? `${currentChunkText} ${textToProcess}` : textToProcess;
      } else {
        if (currentChunkText.trim()) {
          chunks.push({ section: section.section, text: currentChunkText.trim() });
          currentChunkText = '';
        }
        let cursor = 0;
        while (cursor < textToProcess.length) {
          const next = textToProcess.slice(cursor, cursor + maxChars);
          const cut = next.length === maxChars ? next.lastIndexOf(' ') : next.length;
          const end = cut > 300 ? cursor + cut : cursor + next.length;
          chunks.push({ section: section.section, text: textToProcess.slice(cursor, end).trim() });
          cursor = end;
        }
      }
    }
  }

  if (currentChunkText.trim()) {
    chunks.push({ section: section.section, text: currentChunkText.trim() });
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
    project: document.project,
    type: document.type,
    tags: document.tags,
    portfolio_use: document.portfolio_use,
    evidence_type: document.evidence_type,
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
