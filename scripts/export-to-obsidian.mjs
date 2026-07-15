#!/usr/bin/env node
/**
 * Export LLM Wiki content/*.md into Obsidian.
 *
 *   npm run export:obsidian
 *   npm run export:obsidian -- --out "C:\옵시디안" --layout flat-knowledge
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const SOURCE_REPO = 'https://github.com/Anjingyeong/llm_wiki_strange';

const DEFAULT_VAULT_WIN = 'C:\\옵시디안';

const categoryFolderLegacy = {
  Project: '01-project',
  Architecture: '02-architecture',
  ADR: '03-adr',
  Experiments: '04-experiments-evidence',
  Evidence: '04-experiments-evidence',
  Bug: '05-bugs',
  'Engineering Decisions': '06-engineering-decisions',
};

const categoryToMoc = {
  Project: '[[프로젝트 개요 MOC]]',
  Architecture: '[[아키텍처와 시스템 MOC]]',
  ADR: '[[의사결정 기록 MOC]]',
  Experiments: '[[실험과 벤치마크 MOC]]',
  Evidence: '[[실험과 벤치마크 MOC]]',
  Bug: '[[버그와 장애 MOC]]',
  'Engineering Decisions': '[[의사결정 기록 MOC]]',
};

const categoryObsidian = {
  Project: 'Project',
  Architecture: 'Architecture',
  ADR: 'ADR',
  Experiments: 'Experiments',
  Evidence: 'Evidence',
  Bug: 'Bugs',
  'Engineering Decisions': 'AI Pipeline',
};

function parseArgs(argv) {
  let out = process.platform === 'win32' ? DEFAULT_VAULT_WIN : join(wikiRoot, 'obsidian-vault');
  let linkMode = 'wikilink';
  let includeSources = true;
  let layout = 'flat-knowledge';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) out = argv[++i];
    else if (argv[i] === '--link-mode' && argv[i + 1]) linkMode = argv[++i];
    else if (argv[i] === '--no-sources') includeSources = false;
    else if (argv[i] === '--layout' && argv[i + 1]) layout = argv[++i];
  }
  return { out, linkMode, includeSources, layout };
}

function parseFrontmatter(raw) {
  const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const block = match[1];
  const body = match[2];
  const data = {};
  const lines = block.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const m = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (!val) {
      const items = [];
      while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
        index += 1;
        items.push(stripQuotes(lines[index].replace(/^\s+-\s+/, '').trim()));
      }
      data[key] = items;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      data[key] = stripQuotes(val);
    }
  }
  return { data, body };
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function slugFromFile(file) {
  return file.replace(/\.md$/i, '');
}

function rewriteWikiLinks(body, linkMode) {
  if (linkMode !== 'wikilink') return body;
  return body.replace(/\[([^\]]+)\]\(([A-Za-z0-9][\w-]*)\.md\)/g, '[[$2]]');
}

function buildLegacyObsidianFm(data, slug) {
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  const aliases = [data.navTitle, data.shortTitle, data.title].filter((v, i, a) => v && a.indexOf(v) === i);
  const lines = ['---'];
  if (tags.length) {
    lines.push('tags:');
    for (const t of tags) lines.push(`  - ${t}`);
  }
  if (aliases.length) {
    lines.push('aliases:');
    for (const a of aliases) lines.push(`  - ${JSON.stringify(a).slice(1, -1)}`);
  }
  lines.push(`wiki-slug: ${slug}`);
  if (data.updatedAt) lines.push(`updated: ${data.updatedAt}`);
  lines.push('---', '');
  return lines.join('\n');
}

function buildKoreanVaultFm(data, slug) {
  const title = data.title || slug;
  const aliases = [data.navTitle, data.shortTitle].filter(
    (v, i, a) => v && v !== title && a.indexOf(v) === i,
  );
  const cat = categoryObsidian[data.category] || data.category || 'Project';
  const moc = categoryToMoc[data.category] || '[[전체 지식 문서 MOC]]';
  const tags = ['llm-wiki', 'smart-safety-ai'];
  if (data.portfolio_use === true || data.portfolio_use === 'true') tags.push('portfolio');
  const type =
    data.type ||
    (slug.startsWith('ED-') ? 'engineering-decision' : slug.startsWith('ADR-') ? 'reference' : 'reference');

  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    'aliases:',
    ...aliases.map((a) => `  - ${JSON.stringify(a)}`),
    ...(aliases.length ? [] : ['  []']),
    `category: ${cat}`,
    `type: ${type}`,
    `project: ${data.project || 'smart-safety-ai'}`,
    'status: reference',
    `source_repo: ${JSON.stringify(SOURCE_REPO)}`,
    `source_path: ${JSON.stringify(`content/${slug}.md`)}`,
    `updatedAt: ${data.updatedAt || '2026-07-15'}`,
    `updated: ${data.updatedAt || '2026-07-15'}`,
    'tags:',
    ...tags.map((t) => `  - ${t}`),
    'vault_mocs:',
    `  - "${moc}"`,
    `  - "[[전체 지식 문서 MOC]]"`,
    '---',
    '',
  ];
  if (aliases.length === 0) {
    const idx = lines.indexOf('aliases:');
    lines.splice(idx, 2, 'aliases: []');
  }
  return lines.join('\n');
}

function networkFooter(data, slug) {
  const related = Array.isArray(data.relatedDocs) ? data.relatedDocs : [];
  const moc = categoryToMoc[data.category] || '[[전체 지식 문서 MOC]]';
  const relLinks = related.map((r) => `[[${r}]]`).join(' · ');
  return [
    '',
    '## 지식 네트워크',
    '',
    `상위 지도: ${moc} · [[전체 지식 문서 MOC]] · [[LLM Wiki 프로젝트]] · [[홈]]`,
    '',
    relLinks ? `원본 관련 문서: ${relLinks}` : '',
    '',
    `> Wiki 동기화: \`npm run export:obsidian\` (${new Date().toISOString().slice(0, 10)})`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function writeNote(destPath, frontmatterBlock, body) {
  await ensureDir(dirname(destPath));
  await writeFile(destPath, frontmatterBlock + body, 'utf8');
}

const { out, linkMode, includeSources, layout } = parseArgs(process.argv);
const vaultRoot = out;
const knowledgeDir =
  layout === 'flat-knowledge' ? join(vaultRoot, '03_Knowledge', 'LLM_Wiki') : vaultRoot;

await ensureDir(knowledgeDir);

const files = (await readdir(contentDir)).filter((f) => f.endsWith('.md')).sort();
let exported = 0;
const exportedSlugs = [];

for (const file of files) {
  const slug = slugFromFile(file);
  const raw = await readFile(join(contentDir, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);

  let dest;
  if (layout === 'flat-knowledge') {
    dest = join(knowledgeDir, `${slug}.md`);
  } else {
    const folder = categoryFolderLegacy[data.category] || '99-uncategorized';
    dest = join(vaultRoot, folder, `${slug}.md`);
  }

  const fm =
    layout === 'flat-knowledge' ? buildKoreanVaultFm(data, slug) : buildLegacyObsidianFm(data, slug);
  let newBody = rewriteWikiLinks(body, linkMode);
  if (layout === 'flat-knowledge' && !newBody.includes('## 지식 네트워크')) {
    newBody += networkFooter(data, slug);
  }

  await writeNote(dest, fm, newBody);
  exported++;
  exportedSlugs.push(slug);
}

if (layout === 'legacy') {
  const mocLines = [
    '---',
    'tags:',
    '  - moc',
    '---',
    '',
    '# Wiki MOC (export)',
    '',
    ...exportedSlugs.sort().map((s) => `- [[${s}]]`),
  ];
  await writeNote(join(vaultRoot, '00-home', 'Wiki-MOC.md'), '', mocLines.join('\n'));
}

if (includeSources) {
  const srcDir =
    layout === 'flat-knowledge' ? join(vaultRoot, '06_Sources') : join(vaultRoot, '_sources');
  await ensureDir(srcDir);
  try {
    await copyFile(
      join(wikiRoot, 'ai-pipeline-stabilization-source.md'),
      join(srcDir, 'ai-pipeline-stabilization-source.md'),
    );
  } catch {
    /* optional */
  }
  try {
    const readme = await readFile(join(wikiRoot, 'README.md'), 'utf8');
    await writeFile(join(srcDir, 'README-LLM-Wiki.md'), readme, 'utf8');
  } catch {
    /* optional */
  }
}

const syncNote = `---
title: "Wiki 동기화 (llm_wiki_strange)"
type: meta
status: active
updated: "${new Date().toISOString().slice(0, 10)}"
tags: [meta, llm-wiki, sync]
---

# Wiki → Obsidian 동기화

로컬 Wiki 저장소 \`C:\\llm_wiki_strange\`의 \`content/*.md\`를 이 볼트 \`03_Knowledge/LLM_Wiki/\`에 덮어씁니다.

\`\`\`powershell
cd C:\\llm_wiki_strange
npm run generate:index
npm run export:obsidian
\`\`\`

- 기본 출력: \`C:\\옵시디안\`
- 실험 원문: [[ai-pipeline-stabilization-source]] (\`06_Sources/\`)
- 볼트 홈: [[홈]] · [[LLM Wiki 프로젝트]] · [[전체 지식 문서 MOC]]

마지막 동기화: **${exported}**개 노트, ${new Date().toLocaleString('ko-KR')}.
`;

if (layout === 'flat-knowledge') {
  await writeNote(join(vaultRoot, '99_Meta', 'Wiki 동기화.md'), '', syncNote);
}

console.log(
  JSON.stringify(
    {
      vaultRoot,
      layout,
      knowledgeDir,
      exported,
      slugs: exportedSlugs.length,
      next: 'Obsidian: 03_Knowledge/LLM_Wiki · 06_Sources · 02_Maps/전체 지식 문서 MOC (Develop 행은 export 후 MOC 수동/볼트 패치)',
    },
    null,
    2,
  ),
);