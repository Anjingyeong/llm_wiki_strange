import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDirectory = join(root, 'src/components');
const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8');

function readMatchingComponents(pattern) {
  return readdirSync(componentsDirectory)
    .filter((file) => pattern.test(file) && file.endsWith('.tsx'))
    .map((file) => ({
      file,
      source: readFileSync(join(componentsDirectory, file), 'utf8'),
    }));
}

function sourceFor(files) {
  return files.map(({ file, source }) => `/* ${file} */\n${source}`).join('\n');
}

const toolModules = readMatchingComponents(
  /(?:WikiTools|WikiCommand|WikiSearch|WikiAsk|WikiSystem|SearchPanel|RagPanel)/u,
);
const toolSource = sourceFor(toolModules);
const searchSource = sourceFor(readMatchingComponents(/(?:WikiSearch|SearchPanel)/u));
const askSource = sourceFor(readMatchingComponents(/(?:WikiAsk|RagPanel)/u));

test('document route shows a compact command bar before the article, not an expanded tool', () => {
  assert.match(toolSource, /WikiCommandBar|wikiCommandBar/u, 'missing the compact command bar');
  assert.match(appSource, /contentView === 'doc'[\s\S]*?<WikiCommandBar/u);
  assert.match(appSource, /contentView === 'search'/u, 'search needs a dedicated route workspace');
  assert.match(appSource, /contentView === 'rag'/u, 'Ask needs a dedicated route workspace');

  const commandModule = toolModules.find(({ file, source }) =>
    /WikiCommandBar/u.test(file) || /function WikiCommandBar/u.test(source),
  );
  assert.ok(commandModule, 'WikiCommandBar must be a distinct compact module');
  assert.doesNotMatch(
    commandModule.source,
    /<(?:input|textarea)\b|searchResults|ragAnswer/u,
    'the document command bar must not eagerly render tool forms or results',
  );
  for (const label of ['Search', 'Ask', 'System status']) {
    assert.match(commandModule.source, new RegExp(label, 'iu'));
  }
});

test('dedicated search workspace uses native links and exposes why each result matched', () => {
  assert.match(searchSource, /<label\b[^>]*htmlFor=/u, 'search input needs a visible label');
  assert.match(searchSource, /<input\b[\s\S]*?type="search"/u);
  assert.match(searchSource, /<ul\b/u, 'search results must be an ordinary list');
  assert.match(searchSource, /<li\b/u);
  assert.match(searchSource, /<a\b[\s\S]*?href=/u, 'search results must expose genuine links');
  assert.match(searchSource, /aria-live="polite"/u, 'result count needs a polite live region');
  assert.match(searchSource, /emptyState/u, 'search needs an explicit empty state');
  assert.match(searchSource, /matchedSectionId/u, 'result must expose the matched section');
  assert.match(searchSource, /matchReasons/u, 'result must explain why it matched');
  assert.match(searchSource, /evidenceLevel/u, 'result must expose evidence state');
  assert.match(searchSource, /status/u, 'result must expose document state');
  assert.doesNotMatch(searchSource, /ExpandableText/u, 'a result link cannot contain an interactive expander');
});

test('dedicated Ask workspace announces progress and preserves truthful response provenance', () => {
  assert.match(askSource, /aria-busy=\{(?:loading|ragLoading)\}/u);
  assert.match(askSource, /aria-live="polite"/u, 'Ask status needs a polite live region');
  for (const field of ['answerMode', 'fallback', 'fallbackReason', 'debugInfo']) {
    assert.match(askSource, new RegExp(`\\b${field}\\b`, 'u'), `Ask drops ${field}`);
  }
  assert.match(askSource, /insufficient_context/u);
  assert.match(askSource, /status:\s*'error'|status === 'error'/u);
  assert.match(askSource, /<details\b[\s\S]*?JSON\.stringify/u, 'raw diagnostics belong in details');
  assert.match(askSource, /답변 완료|근거 부족|요청 실패/u, 'machine response states need reader-facing labels');
  assert.doesNotMatch(askSource, /<p[^>]*ragFallbackReason/u, 'fallback diagnostics must not precede the answer');
  assert.match(askSource, /<a\b[\s\S]*?href=/u, 'sources must remain genuine links');
  assert.match(askSource, /displayTitle[\s\S]*?section|section[\s\S]*?displayTitle/u);
  assert.doesNotMatch(askSource, /<small>\s*relevance/u, 'raw retrieval scores belong in diagnostics, not source cards');
});

test('tool workspaces can return to the active document and avoid incomplete composite widgets', () => {
  assert.match(toolSource, /onSelectDocument|onReturnToDocument/u);
  assert.match(toolSource, /돌아가기|Return to|Back to/u, 'workspace needs a visible return action');
  assert.doesNotMatch(toolSource, /role="(?:tablist|tab|listbox|option)"/u);
});

test('tool workspace modules stay within the 250-line component boundary', () => {
  assert.ok(toolModules.length > 0, 'no tool workspace modules found');
  for (const { file, source } of toolModules) {
    const lineCount = source.split(/\r?\n/u).length;
    assert.ok(lineCount <= 250, `${basename(file)} is ${lineCount} lines; split it below 250`);
  }

  assert.equal(
    existsSync(join(root, 'src/components/WikiToolsPanel.tsx')),
    toolModules.some(({ file }) => file === 'WikiToolsPanel.tsx'),
  );
});
