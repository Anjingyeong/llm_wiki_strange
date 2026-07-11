import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wikiRoot = resolve(__dirname, '..');

// Helper to trace imports recursively
async function traceDependencies(startFilePath) {
  const visited = new Set();
  const queue = [startFilePath];
  const allImports = {};

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    let content;
    try {
      content = await readFile(current, 'utf8');
    } catch (err) {
      // JSON or unresolvable files
      continue;
    }

    // Find imports
    const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    const fileImports = [];
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      fileImports.push(importPath);

      if (importPath.startsWith('.')) {
        const resolvedPath = resolve(dirname(current), importPath);
        // handle mjs, js, json resolution
        const extensions = ['', '.js', '.mjs', '.json'];
        let found = false;
        for (const ext of extensions) {
          try {
            const testPath = resolvedPath + ext;
            const contentCheck = await readFile(testPath, 'utf8');
            queue.push(testPath);
            found = true;
            break;
          } catch {}
        }
      }
    }
    allImports[current] = fileImports;
  }
  return allImports;
}

describe('Cloudflare Pages Functions dependency checks', () => {
  it('ask.js should not import rag-core.mjs', async () => {
    const askPath = join(wikiRoot, 'functions/api/rag/ask.js');
    const content = await readFile(askPath, 'utf8');
    assert.doesNotMatch(content, /rag-core\.mjs/);
  });

  it('ask.js dependencies must not include node:crypto, node:fs, or node:path', async () => {
    const askPath = join(wikiRoot, 'functions/api/rag/ask.js');
    const deps = await traceDependencies(askPath);

    const nodeBuiltins = ['node:crypto', 'node:fs', 'node:fs/promises', 'node:path', 'crypto', 'fs', 'path'];

    for (const [file, imports] of Object.entries(deps)) {
      for (const imp of imports) {
        assert.ok(
          !nodeBuiltins.includes(imp),
          `File ${file} imports forbidden Node module: ${imp}`
        );
      }
    }
  });

  it('health.js dependencies must not include node:crypto, node:fs, or node:path', async () => {
    const healthPath = join(wikiRoot, 'functions/api/rag/health.js');
    const deps = await traceDependencies(healthPath);

    const nodeBuiltins = ['node:crypto', 'node:fs', 'node:fs/promises', 'node:path', 'crypto', 'fs', 'path'];

    for (const [file, imports] of Object.entries(deps)) {
      for (const imp of imports) {
        assert.ok(
          !nodeBuiltins.includes(imp),
          `File ${file} imports forbidden Node module: ${imp}`
        );
      }
    }
  });
});
