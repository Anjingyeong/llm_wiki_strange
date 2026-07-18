import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = readFileSync(join(root, 'src/components/StatusHeader.tsx'), 'utf8');
const tableOfContents = readFileSync(join(root, 'src/components/TableOfContents.tsx'), 'utf8');
const documentArticle = readFileSync(join(root, 'src/components/DocumentArticle.tsx'), 'utf8');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const ragCss = readFileSync(join(root, 'src/rag.css'), 'utf8');
const overview = readFileSync(join(root, 'content/Overview.md'), 'utf8');
const outlineSource = `${tableOfContents}\n${documentArticle}\n${app}`;

function readRuleBlock(source, startIndex) {
  const openBraceIndex = source.indexOf('{', startIndex);
  assert.notEqual(openBraceIndex, -1, 'Expected a CSS rule block opening brace');
  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(startIndex, index + 1);
  }

  throw new Error('Expected a balanced CSS rule block');
}

test('runtime health starts in checking and distinguishes every truthful terminal state', () => {
  for (const state of ['checking', 'healthy', 'stale', 'error', 'unknown']) {
    assert.match(header, new RegExp(`['\"]${state}['\"]`, 'u'), `missing explicit ${state} health state`);
  }

  assert.match(
    header,
    /INITIAL_HEALTH_STATUS[\s\S]*?state:\s*['"]checking['"]/u,
    'the atomic runtime-health model must begin as checking, never as an optimistic healthy badge',
  );
  assert.match(header, /useReducer\(healthReducer,\s*INITIAL_HEALTH_STATUS\)/u, 'related health fields must update atomically');
  assert.match(
    header,
    /async function requestRuntimeHealth\(signal:\s*AbortSignal\):\s*Promise<RuntimeHealthResponse>/u,
    'the typed network boundary must live outside the component effect',
  );
  const healthEffect = header.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?\n\s*\},\s*\[\]\);/u)?.[0] ?? '';
  assert.doesNotMatch(healthEffect, /\bfetch\(/u, 'the effect must orchestrate the health request rather than own fetch');
  assert.match(healthEffect, /AbortController[\s\S]*?controller\.abort\(\)/u, 'unmount must cancel the in-flight health request');
  assert.match(
    header,
    /stale\s*===\s*false[\s\S]*?['"]healthy['"]/u,
    'healthy may be selected only after the endpoint explicitly validates stale=false',
  );
  assert.match(header, /<svg\b[^>]*aria-hidden=['"]true['"]/u, 'header icons must use the shared SVG language');
  assert.doesNotMatch(header, /[☰✅❌⚠️🟢🟡🔴]/u, 'header controls and states must not use emoji glyphs');
  assert.doesNotMatch(header, /<header\b[^>]*role=['"]banner['"]/u, 'native header semantics must not repeat a redundant banner role');
});

test('runtime status exposes visible reasons and separates build-time index facts', () => {
  assert.match(header, /aria-live=['"]polite['"]/u, 'health transitions need a polite live region');
  assert.match(header, /<time\b[\s\S]*?dateTime=/u, 'last checked time must be visible and machine-readable');
  assert.match(
    header,
    /staleReasons[\s\S]*?(?:\.map\(|\.join\()[\s\S]*?<\/(?:p|li|dd|span)>/u,
    'stale reasons must render in visible content rather than only a hover title',
  );
  assert.match(
    header,
    /(?:healthError|errorReason|statusReason)[\s\S]*?<\/(?:p|li|dd|span)>/u,
    'unknown and error states need a visible reason',
  );
  assert.match(header, /meta\.search\.source|search\.source/u, 'status must name the indexed source corpus');
  assert.match(header, /meta\.search\.generatedAt|search\.generatedAt/u, 'search index generation time must be visible');
  assert.match(header, /meta\.rag\.indexGeneratedAt|rag\.indexGeneratedAt/u, 'RAG index generation time must be visible');
  assert.match(
    header,
    /Build-time|빌드(?:\s*시점)?[\s\S]*Runtime|런타임/u,
    'build-time index facts must not be presented as runtime service health',
  );
});

test('the responsive article exposes a native inline outline with genuine hash links', () => {
  assert.match(outlineSource, /<details\b[^>]*className=['"][^'"]*inlineToc/u);
  assert.match(outlineSource, /<summary>\s*문서 목차\s*<\/summary>/u);
  assert.match(
    outlineSource,
    /className=['"][^'"]*inlineToc[\s\S]*?href=\{wikiLink\(documentSlug,\s*heading\.id\)\}/u,
    'inline outline entries must remain genuine document hash links',
  );
  assert.doesNotMatch(
    outlineSource.match(/<details\b[^>]*inlineToc[\s\S]*?<\/details>/u)?.[0] ?? '',
    /onClick=/u,
    'inline outline navigation must not replace native link behavior',
  );
});

test('the responsive outline precedes the article in the reading flow', () => {
  const inlineOutlineIndex = app.indexOf('<InlineTableOfContents');
  const articleIndex = app.indexOf('<DocumentArticle');

  assert.notEqual(inlineOutlineIndex, -1, 'App must render the responsive inline outline');
  assert.notEqual(articleIndex, -1, 'App must render the document article');
  assert.ok(
    inlineOutlineIndex < articleIndex,
    'the inline outline must appear before the article instead of after the full document',
  );
});

test('Korean prose keeps words intact while machine tokens retain safe overflow fallbacks', () => {
  assert.match(css, /\.markdown\s*\{[^}]*word-break:\s*keep-all\s*;/su);
  assert.match(css, /\.markdown\s*\{[^}]*overflow-wrap:\s*normal\s*;/su);
  assert.match(css, /\.documentAnswer\s+p\s*\{[^}]*word-break:\s*keep-all\s*;/su);
  assert.match(css, /\.docTitle\s*\{[^}]*word-break:\s*keep-all\s*;/su);
  assert.match(css, /\.documentFactDate\s*\{[^}]*white-space:\s*nowrap\s*;/su);
});

test('meaningful runtime metadata stays at the 12px design minimum', () => {
  assert.match(css, /\.runtimeHealth\s+time\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
  assert.match(css, /\.buildFacts\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
  assert.match(css, /\.statusReason\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
  assert.match(css, /\.staleReasons\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
  assert.match(ragCss, /\.ragAnswerBody\s+table\s+th\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
  assert.match(ragCss, /\.ragSourcesLabel\s*\{[^}]*font-size:\s*0\.75rem\s*;/su);
});

test('reader-facing Markdown does not expose a raw tag footer', () => {
  assert.doesNotMatch(overview, /\n---\s*\n(?:#[\w-]+\s*)+$/u);
});

test('desktop and inline outlines are mutually exclusive and narrow layouts resist overflow', () => {
  assert.match(css, /\.inlineToc\s*\{[^}]*display:\s*none\s*;/su, 'inline outline stays hidden on desktop');

  const breakpointIndex = css.lastIndexOf('@media (max-width: 1200px)');
  assert.notEqual(breakpointIndex, -1, 'missing the 1200px article layout breakpoint');
  const breakpoint = readRuleBlock(css, breakpointIndex);
  assert.match(breakpoint, /\.toc\s*\{[^}]*display:\s*none\s*;/su, 'desktop sticky outline must hide below 1200px');
  assert.match(breakpoint, /\.inlineToc\s*\{[^}]*display:\s*block\s*;/su, 'inline outline must replace it below 1200px');
  assert.match(css, /\.inlineToc\s*\{[^}]*min-width:\s*0\s*;/su, 'inline outline must be allowed to shrink');
  assert.match(css, /\.inlineToc\s+a\s*\{[^}]*overflow-wrap:\s*anywhere\s*;/su, 'long headings must not cause horizontal overflow');
});
