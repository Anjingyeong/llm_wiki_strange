import { readFile } from 'node:fs/promises';
const raw = await readFile('./src/generated/searchIndex.ts', 'utf8');
const match = raw.match(/export const searchIndex = (\[[\s\S]*\]) satisfies/);
const idx = JSON.parse(match[1]);

let allOk = true;
for (const doc of idx) {
  const ex = doc.excerpt;
  const lastChar = ex.slice(-1);
  const isTruncated = lastChar === '\u2026';
  const isShort = ex.length < 200;
  const ok = isTruncated || isShort;
  if (!ok) allOk = false;
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${doc.slug}] len=${ex.length} ends="${ex.slice(-30)}"`);
}
console.log(allOk ? '\nAll excerpts end correctly.' : '\nSome excerpts may end mid-word!');
