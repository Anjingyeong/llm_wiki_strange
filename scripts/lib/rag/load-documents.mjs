import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isExcludedFromPublicIndex } from '../indexable-content.mjs';
import { extractWikiMachineMetadata, parseWikiSourceDocument } from '../wiki-source-document.mjs';
import { resolveDisplayTitle } from '../../../src/lib/wikiTitle.mjs';

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

export async function loadWikiDocuments(contentDir) {
  const documents = [];
  const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();
  for (const file of files) {
    const raw = await readFile(join(contentDir, file), 'utf8');
    const parsed = parseWikiSourceDocument(raw, file);
    if (isExcludedFromPublicIndex(parsed.data)) continue;
    const slug = file.replace(/\.md$/, '');
    documents.push({
      slug,
      title: parsed.data.title,
      navTitle: parsed.data.navTitle,
      shortTitle: parsed.data.shortTitle,
      displayTitle: resolveDisplayTitle({ ...parsed.data, slug }),
      category: parsed.data.category,
      updatedAt: parsed.data.updatedAt,
      summary: makeSummary(parsed.body, parsed.data.summary ?? parsed.data.description),
      order: parsed.data.order ? Number.parseInt(parsed.data.order, 10) : (categoryOrder.get(parsed.data.category) ?? 999),
      sourcePath: `content/${file}`,
      project: parsed.data.project,
      ...extractWikiMachineMetadata(parsed.data),
      tags: parsed.data.tags ?? [],
      relatedDocs: parsed.data.relatedDocs ?? [],
      relatedSlugs: parsed.data.relatedSlugs ?? [],
      entities: parsed.data.entities ?? [],
      portfolio_use: parsed.data.portfolio_use,
      evidence_type: parsed.data.evidence_type,
      body: parsed.body,
      raw,
    });
  }
  return documents;
}
