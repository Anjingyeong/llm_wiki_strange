import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const rag = readFileSync(join(root, 'src/components/WikiToolsPanel.tsx'), 'utf8');
const server = readFileSync(join(root, 'server.mjs'), 'utf8');
const accessKeyLib = readFileSync(join(root, 'src/lib/wikiAccessKey.ts'), 'utf8');
const accessGate = readFileSync(join(root, 'src/components/AccessGate.tsx'), 'utf8');

assert.match(app, /AccessGate|wikiAccessKey|appRoot/, 'App must integrate AccessGate and appRoot when key required');
assert.match(rag, /x-wiki-key|onAuthRequired|lastSubmittedQuestion/, 'WikiToolsPanel must send x-wiki-key and handle 401/onAuthRequired');
assert.match(server, /WIKI_ACCESS_KEY|handleVerify|api\/auth\/verify|accessKeyRequired/, 'server must support access-key authentication');
assert.match(accessKeyLib, /wiki_access_key|sessionStorage/, 'wikiAccessKey helper must use sessionStorage');
assert.match(accessGate, /\/api\/auth\/verify/, 'AccessGate must POST to verify');

console.log('wiki access gate (restore) OK');