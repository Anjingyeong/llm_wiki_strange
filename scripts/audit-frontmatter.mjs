import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWikiContent } from './lib/wiki-frontmatter-audit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');

const result = await auditWikiContent(contentDir);
if (result.violations.length) {
  console.error(`Frontmatter audit FAIL: ${result.violations.length}`);
  for (const violation of result.violations) {
    console.error(violation.message);
  }
  process.exit(1);
}
console.log(
  `Frontmatter audit OK: ${result.fileCount} files / ${result.publicDocumentCount} public documents`,
);
