import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

test('code blocks use explicit pre background and text color tokens', () => {
  assert.match(css, /\.codeBlock pre\s*\{[^}]*background:\s*var\(--code-bg\)/s);
  assert.match(css, /\.codeBlock pre\s*\{[^}]*color:\s*var\(--code-text\)/s);
});

test('fenced code inner elements do not inherit inline-code padding on pre code', () => {
  assert.match(css, /\.codeBlock pre code[\s\S]*background:\s*transparent/);
  assert.match(css, /\.markdown \.codeBlock pre code[\s\S]*color:\s*inherit/);
});

test('design tokens define code contrast pair', () => {
  assert.match(css, /--code-bg:\s*#[0-9A-Fa-f]{6}/);
  assert.match(css, /--code-text:\s*#[0-9A-Fa-f]{6}/);
});

test('Bug-Codeblock-Visibility documents related stylesheet paths', () => {
  const doc = readFileSync(join(root, 'content/Bug-Codeblock-Visibility.md'), 'utf8');
  assert.match(doc, /src\/styles\.css/);
  assert.match(doc, /MarkdownRenderer/);
});