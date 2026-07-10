import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const categoryOrder = new Map([
  ['Project', 100],
  ['Architecture', 200],
  ['AI Pipeline', 300],
  ['Frontend', 400],
  ['Infra', 400],
  ['Experiments', 600],
  ['Bugs', 700],
  ['Backend', 800],
  ['ADR', 850],
  ['면접·이력서 정리', 900],
  ['Glossary', 950],
]);

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const trimmed = String(value).trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return trimmed ? [trimmed.replace(/^["']|["']$/g, '')] : [];
}

function stripOuterQuotes(value) {
  let normalized = String(value).trim();
  while (
    normalized.length >= 2
    && ((normalized.startsWith('"') && normalized.endsWith('"'))
      || (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function displayTitle(data, slug) {
  return data.navTitle || data.shortTitle || data.title || slug;
}

function stripMarkdownText(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[#>*`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(body, explicitSummary) {
  if (explicitSummary) return explicitSummary;
  const plain = stripMarkdownText(body);
  return plain.length <= 180 ? plain : `${plain.slice(0, 180).trim()}...`;
}

function parseFrontmatter(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`${fileName} is missing frontmatter`);
  }
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = stripOuterQuotes(value);
  }
  return { data, body: match[2] };
}

export async function loadWikiDocuments(contentDir) {
  const documents = [];
  const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();
  for (const file of files) {
    const raw = await readFile(join(contentDir, file), 'utf8');
    const parsed = parseFrontmatter(raw, file);
    const slug = file.replace(/\.md$/, '');
    documents.push({
      slug,
      title: parsed.data.title,
      navTitle: parsed.data.navTitle,
      shortTitle: parsed.data.shortTitle,
      displayTitle: displayTitle(parsed.data, slug),
      category: parsed.data.category,
      updatedAt: parsed.data.updatedAt,
      summary: makeSummary(parsed.body, parsed.data.summary ?? parsed.data.description),
      order: parsed.data.order ? Number.parseInt(parsed.data.order, 10) : (categoryOrder.get(parsed.data.category) ?? 999),
      sourcePath: `content/${file}`,
      project: parsed.data.project,
      type: parsed.data.type,
      tags: parseList(parsed.data.tags),
      relatedDocs: parseList(parsed.data.relatedDocs),
      relatedSlugs: parseList(parsed.data.relatedSlugs),
      entities: parseList(parsed.data.entities),
      portfolio_use: parsed.data.portfolio_use,
      evidence_type: parsed.data.evidence_type,
      body: parsed.body,
      raw,
    });
  }
  return documents;
}
