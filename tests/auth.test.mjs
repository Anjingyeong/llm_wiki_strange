import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const serverPath = join(__dirname, '..', 'server.mjs');

async function startTestServer(port, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: port.toString(),
        WIKI_ACCESS_KEY: 'test-key-1234',
        ...env,
      },
    });

    let stdoutData = '';
    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
      if (stdoutData.includes('listening on')) {
        resolve(child);
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[Server Stderr] ${data}`);
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Timeout safety after 5s
    setTimeout(() => reject(new Error('Server start timeout')), 5000);
  });
}

test('Wiki Server Auth API Tests', async (t) => {
  const port = 14173;
  const baseUrl = `http://localhost:${port}`;
  let serverProcess;

  t.before(async () => {
    serverProcess = await startTestServer(port);
  });

  t.after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  await t.test('POST /api/auth/verify with correct key returns 200 and ok: true', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'test-key-1234' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
  });

  await t.test('POST /api/auth/verify with wrong key returns 400 and ok: false', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'wrong-key' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
    assert.match(data.message, /잘못된/);
  });

  await t.test('POST /api/rag/ask without x-wiki-key header returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/rag/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'test' }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert.match(data.answer, /접근 키/);
  });

  await t.test('POST /api/rag/ask with correct x-wiki-key header does not return 401', async () => {
    const res = await fetch(`${baseUrl}/api/rag/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wiki-key': 'test-key-1234',
      },
      body: JSON.stringify({ question: '테스트 질문' }),
    });
    // Even if it fails due to no index config (500), it shouldn't return 401
    assert.notStrictEqual(res.status, 401);
  });
});
