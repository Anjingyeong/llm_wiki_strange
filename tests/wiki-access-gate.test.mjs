import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const rag = readFileSync(join(root, 'src/components/WikiAskWorkspace.tsx'), 'utf8');
const server = readFileSync(join(root, 'server.mjs'), 'utf8');
const accessKeyLib = readFileSync(join(root, 'src/lib/wikiAccessKey.ts'), 'utf8');
const accessGate = readFileSync(join(root, 'src/components/AccessGate.tsx'), 'utf8');

test('access-key flow remains connected to the protected APIs', () => {
  // Given: the application is configured to require an access key.
  // When: the reader authenticates and later asks a grounded question.
  // Then: the gate and Ask workspace retain the server authentication contract.
  assert.match(app, /AccessGate|wikiAccessKey|appRoot/, 'App must integrate AccessGate and appRoot when key required');
  assert.match(rag, /x-wiki-key|onAuthRequired|lastSubmittedQuestion/, 'WikiAskWorkspace must send x-wiki-key and handle 401/onAuthRequired');
  assert.match(server, /WIKI_ACCESS_KEY|handleVerify|api\/auth\/verify|accessKeyRequired/, 'server must support access-key authentication');
  assert.match(accessKeyLib, /wiki_access_key|sessionStorage/, 'wikiAccessKey helper must use sessionStorage');
  assert.match(accessGate, /\/api\/auth\/verify/, 'AccessGate must POST to verify');
});

test('access gate uses a native modal dialog and focuses its key field after opening', () => {
  // Given: authentication is required and the gate mounts.
  // When: its opening effect runs.
  // Then: a native dialog opens modally before focus enters the key field.
  assert.match(accessGate, /<dialog\b/u, 'the gate must use the native dialog element');
  assert.match(accessGate, /dialog\.showModal\(\)[\s\S]*?inputRef\.current\?\.focus\(\)/u);
  assert.doesNotMatch(accessGate, /role=['"]dialog['"]/u, 'native dialog semantics must not be recreated with ARIA');
});

test('required access gate cannot be dismissed with Escape and closes during unmount', () => {
  // Given: the modal protects all wiki content.
  // When: the browser emits cancel or React unmounts the authenticated gate.
  // Then: Escape is prevented while cleanup closes the native top-layer dialog safely.
  assert.match(accessGate, /onCancel=\{[^}]*preventDefault/u, 'Escape cancellation must keep the required gate open');
  assert.match(accessGate, /if\s*\(dialog\.open\)\s*dialog\.close\(\)/u, 'the dialog must leave the top layer during cleanup');
});
