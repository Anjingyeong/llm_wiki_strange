import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

function readRuleBlock(source, startIndex) {
  const openBraceIndex = source.indexOf('{', startIndex);
  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(startIndex, index + 1);
  }

  throw new Error('Expected a balanced CSS rule block');
}

test('mobile sidebar stays fixed and out of flow after the base sticky sidebar rule', () => {
  // Given: the final narrow-screen override, which wins the CSS cascade.
  const mobileRule = '@media (max-width: 720px)';
  const finalMobileRuleIndex = css.lastIndexOf(mobileRule);
  const baseStickyRuleIndex = css.indexOf('.sidebar {\n  position: sticky;');
  const finalMobileBlock = readRuleBlock(css, finalMobileRuleIndex);

  // When: the final mobile rule is evaluated after the base sidebar rule.
  assert.ok(
    finalMobileRuleIndex > baseStickyRuleIndex,
    'The final 720px media query must follow the base sticky sidebar rule',
  );

  // Then: it restores drawer positioning and viewport-relative height.
  assert.match(
    finalMobileBlock,
    /\.sidebar\s*\{[^}]*position:\s*fixed\s*;[^}]*height:\s*calc\(100dvh\s*-\s*var\(--header-h\)\)\s*;/s,
    'The final 720px media query must redeclare .sidebar as fixed with viewport-relative height so the closed drawer cannot consume the first screen',
  );
});
