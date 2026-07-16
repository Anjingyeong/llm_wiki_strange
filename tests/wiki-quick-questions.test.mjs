import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = readFileSync(join(root, 'src/components/ragPanelData.ts'), 'utf8');

assert.match(data, /QUICK_QUESTIONS/, 'ragPanelData must export QUICK_QUESTIONS');
assert.match(data, /YOLO26n-pose/, 'quick questions must include YOLO26n-pose');
assert.match(data, /TensorRT/, 'quick questions must include TensorRT');

console.log('wiki-quick-questions OK');
