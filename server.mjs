import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { answerQuestionFromIndex } from './scripts/lib/rag/answer.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(root, 'dist');
const indexPath = join(root, 'data', 'ragVectorIndex.json');
const searchIndexPath = join(root, 'src', 'generated', 'searchIndex.json');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const WIKI_ACCESS_KEY = process.env.WIKI_ACCESS_KEY || '';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function loadRagIndex() {
  const raw = await readFile(indexPath, 'utf8');
  return JSON.parse(raw);
}

async function buildHealthPayloadForRequest() {
  const { buildHealthPayload } = await import('./scripts/lib/rag/index-meta.mjs');
  const index = await loadRagIndex();
  let searchCorpusHash = null;
  try {
    const sraw = await readFile(searchIndexPath, 'utf8');
    const sidx = JSON.parse(sraw);
    searchCorpusHash = sidx?.meta?.corpusHash || null;
  } catch {}
  return buildHealthPayload(index, { expectedCorpusHash: searchCorpusHash, env: process.env });
}


async function handleAsk(request, response) {
  if (WIKI_ACCESS_KEY) {
    const header = (request.headers['x-wiki-key'] || request.headers['X-Wiki-Key'] || '').toString();
    if (header !== WIKI_ACCESS_KEY) {
      sendJson(response, 401, { error: 'unauthorized' });
      return;
    }
  }
  try {
    const body = await readJsonBody(request);
    const question = typeof body.question === 'string' ? body.question : '';
    const debug = body.debug === true || process.env.RAG_DEBUG === 'true';
    const index = await loadRagIndex();
    const result = await answerQuestionFromIndex(index, question, { debug, env: process.env });
    sendJson(response, 200, result);
  } catch (error) {
    console.error('RAG handleAsk error:', error);
    sendJson(response, 500, {
      status: 'error',
      answer: `RAG API 처리 중 오류가 발생했습니다: ${error.message || error}`,
      sources: [],
    });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(distDir, safePath);
  const contentType = contentTypes.get(extname(filePath)) ?? 'application/octet-stream';

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error('Not a file');
    }
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentType });
    response.end(content);
  } catch {
    await serveIndexHtml(response);
  }
}

async function serveIndexHtml(response) {
  // Try dist/index.html first, then fall back to root index.html (for dev/test environments)
  const candidates = [join(distDir, 'index.html'), join(root, 'index.html')];
  for (const htmlPath of candidates) {
    try {
      const content = await readFile(htmlPath);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(content);
      return;
    } catch {
      // try next candidate
    }
  }
  // No index.html found anywhere
  sendJson(response, 404, { error: 'not_found' });
}

const server = createServer((request, response) => {
  const { pathname } = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? 'localhost'}`,
  );

  if (request.method === 'GET' && pathname === '/api/rag/health') {
    void buildHealthPayloadForRequest()
      .then((payload) => sendJson(response, 200, payload))
      .catch((error) => {
        sendJson(response, 500, { ok: false, error: String(error?.message || error) });
      });
    return;
  }
  if (request.method === 'POST' && pathname === '/api/rag/ask') {
    void handleAsk(request, response);
    return;
  }
  if (request.method === 'POST' && pathname === '/api/rag/reindex') {
    sendJson(response, 405, {
      error: 'run npm run rag:index on the server to refresh embeddings after document edits',
    });
    return;
  }
  if (request.method === "POST" && pathname === "/api/auth/verify") {
    void handleVerify(request, response);
    return;
  }
  if (request.method === "GET" && pathname === "/api/rag/config") {
    handleConfig(request, response);
    return;
  }
  if (pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  void serveStatic(request, response);
});


async function handleVerify(request, response) {
  try {
    const body = await readJsonBody(request);
    const provided = typeof body.key === "string" ? body.key : "";
    if (!WIKI_ACCESS_KEY) {
      return sendJson(response, 200, { ok: true, accessKeyRequired: false });
    }
    if (provided && provided === WIKI_ACCESS_KEY) {
      return sendJson(response, 200, { ok: true });
    }
    return sendJson(response, 401, { error: "unauthorized" });
  } catch {
    return sendJson(response, 400, { error: "bad_request" });
  }
}

function handleConfig(request, response) {
  sendJson(response, 200, { accessKeyRequired: !!WIKI_ACCESS_KEY });
}

server.listen(port, () => {
  console.log(`LLM Wiki server listening on http://localhost:${port}`);
});
