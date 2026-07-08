import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { answerQuestionFromIndex } from './scripts/lib/rag-core.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(root, 'dist');
const indexPath = join(root, 'data', 'ragVectorIndex.json');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const wikiAccessKey = process.env.WIKI_ACCESS_KEY ?? 'smart-safety-2026';

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

async function handleVerify(request, response) {
  try {
    const body = await readJsonBody(request);
    const key = typeof body.key === 'string' ? body.key : '';
    if (key === wikiAccessKey) {
      sendJson(response, 200, { ok: true });
    } else {
      sendJson(response, 400, { ok: false, message: '잘못된 접근 키입니다.' });
    }
  } catch (error) {
    sendJson(response, 500, { ok: false, message: '서버 내부 오류가 발생했습니다.' });
  }
}

async function handleAsk(request, response) {
  try {
    const keyHeader = request.headers['x-wiki-key'];
    if (keyHeader !== wikiAccessKey) {
      sendJson(response, 401, {
        status: 'error',
        answer: '유효하지 않은 접근 키입니다. 로그인 후 다시 시도해 주세요.',
        sources: [],
      });
      return;
    }
    const body = await readJsonBody(request);
    const question = typeof body.question === 'string' ? body.question : '';
    const debug = body.debug === true || process.env.RAG_DEBUG === 'true';
    const result = await answerQuestionFromIndex(index, question, { debug, env: process.env });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      status: 'error',
      answer: 'RAG API 처리 중 오류가 발생했습니다.',
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
    const stream = createReadStream(filePath);
    response.writeHead(200, { 'content-type': contentType });
    stream.pipe(response);
  } catch (error) {
    try {
      const indexHtmlPath = join(distDir, 'index.html');
      const stream = createReadStream(indexHtmlPath);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      stream.pipe(response);
    } catch (e) {
      sendJson(response, 404, { error: 'not_found' });
    }
  }
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/api/rag/health') {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === 'POST' && request.url === '/api/auth/verify') {
    void handleVerify(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/rag/ask') {
    void handleAsk(request, response);
    return;
  }
  if (request.method === 'POST' && request.url === '/api/rag/reindex') {
    sendJson(response, 405, {
      error: 'run npm run rag:index on the server to refresh embeddings after document edits',
    });
    return;
  }
  void serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`LLM Wiki server listening on http://localhost:${port}`);
});
