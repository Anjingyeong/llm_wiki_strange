import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  methodDispatcher,
  notFound,
  routeDispatcher,
} from '../src/lib/pagesApiDispatch.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const serverPath = join(__dirname, '..', 'server.mjs');
const portBase = 4300 + (process.pid % 1000);

async function startTestServer(port, env = {}) {
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: port.toString(),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    child.stdout.on('data', (data) => {
      if (data.toString().includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', (data) => console.error(`[server stderr] ${data}`));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return child;
}

async function assertJson(response, status, payload) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/);
  assert.deepEqual(await response.json(), payload);
}

test('Pages API dispatcher applies the documented method and path matrix', async () => {
  const known = () => new Response('known');
  const routes = {
    '/api/rag/health': { method: 'GET', onKnownMethod: known },
    '/api/rag/ask': { method: 'POST', onKnownMethod: known },
  };

  for (const [pathname, method, status] of [
    ['/api/rag/health', 'GET', 200],
    ['/api/rag/health', 'POST', 404],
    ['/api/rag/health', 'PUT', 404],
    ['/api/rag/health', 'OPTIONS', 404],
    ['/api/rag/ask', 'POST', 200],
    ['/api/rag/ask', 'GET', 404],
    ['/api/rag/ask', 'PUT', 404],
    ['/api/rag/ask', 'OPTIONS', 404],
    ['/api/auth/verify', 'POST', 404],
    ['/api/nope', 'GET', 404],
  ]) {
    const response = await routeDispatcher(new Request(`https://wiki.example${pathname}`, { method }), {
      pathname,
      routes,
    });
    assert.equal(response.status, status, `${method} ${pathname}`);
    if (status === 404) {
      assertJson(response, 404, { error: 'not_found' });
    }
  }

  const wrongMethod = await methodDispatcher(new Request('https://wiki.example', { method: 'PATCH' }), {
    method: 'POST',
    onKnownMethod: known,
  });
  assertJson(wrongMethod, 404, { error: 'not_found' });
  assertJson(notFound(), 404, { error: 'not_found' });
});

test('Node API remains keyless and never falls back to SPA HTML for API paths', async (t) => {
  const port = portBase;
  const child = await startTestServer(port, { WIKI_ACCESS_KEY: 'legacy-value' });
  const baseUrl = `http://localhost:${port}`;

  t.after(() => child.kill());

  for (const [method, pathname, status] of [
    ['GET', '/api/rag/health?check=1', 200],
    ['POST', '/api/rag/health', 404],
    ['PUT', '/api/rag/health', 404],
    ['OPTIONS', '/api/rag/health', 404],
    ['GET', '/api/rag/ask', 404],
    ['PUT', '/api/rag/ask', 404],
    ['OPTIONS', '/api/rag/ask', 404],
    ['POST', '/api/rag/reindex?now=1', 405],
    ['GET', '/api/rag/reindex', 404],
    ['GET', '/api/nope', 404],
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`, { method });
    assert.match(response.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/, `${method} ${pathname}`);
    assert.equal(response.status, status, `${method} ${pathname}`);
    if (status === 404) {
      assert.deepEqual(await response.json(), { error: 'not_found' });
    }
  }

  // verify requires key when WIKI_ACCESS_KEY set
  const v1 = await fetch(`${baseUrl}/api/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'wrong' }) });
  assert.equal(v1.status, 401);

  const v2 = await fetch(`${baseUrl}/api/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'legacy-value' }) });
  assert.equal(v2.status, 200);

  // ask requires x-wiki-key when set
  const askNoKey = await fetch(`${baseUrl}/api/rag/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'test' }),
  });
  assert.equal(askNoKey.status, 401);

  const askWithKey = await fetch(`${baseUrl}/api/rag/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wiki-key': 'legacy-value' },
    body: JSON.stringify({ question: 'test' }),
  });
  assert.notEqual(askWithKey.status, 401);
  assert.match(askWithKey.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/);

  const staticResponse = await fetch(`${baseUrl}/`);
  assert.match(staticResponse.headers.get('content-type') ?? '', /^text\/html/);
});
test('Node ask is keyless without a legacy environment value', async (t) => {
  const port = portBase + 1;
  const child = await startTestServer(port);
  t.after(() => child.kill());

  const response = await fetch(`http://localhost:${port}/api/rag/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'test' }),
  });
  assert.notEqual(response.status, 401);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/);
});
