import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  flattenParagraphLines,
  isDuplicateDocumentH1,
  parseMarkdownBlocks,
  parseParagraphLine,
} from '../src/lib/markdownParse.mjs';

describe('parseParagraphLine hard/soft breaks', () => {
  it('soft line has no hardBreak', () => {
    const line = parseParagraphLine('첫번째 줄');
    assert.equal(line.hardBreak, false);
    assert.equal(line.text, '첫번째 줄');
  });

  it('two trailing spaces mark hard break', () => {
    const line = parseParagraphLine('hard break here  ');
    assert.equal(line.hardBreak, true);
    assert.equal(line.text, 'hard break here');
  });

  it('trailing backslash marks hard break', () => {
    const line = parseParagraphLine('backslash break\\');
    assert.equal(line.hardBreak, true);
    assert.equal(line.text, 'backslash break');
  });
});

describe('parseMarkdownBlocks paragraphs', () => {
  it('joins soft breaks with space when flattened', () => {
    const blocks = parseMarkdownBlocks('줄1\n줄2\n\n다음문단');
    const p = blocks.filter((b) => b.kind === 'paragraph');
    assert.equal(p.length, 2);
    assert.equal(flattenParagraphLines(p[0].lines), '줄1 줄2');
    assert.equal(flattenParagraphLines(p[1].lines), '다음문단');
  });

  it('preserves hard break as newline when flattened', () => {
    const blocks = parseMarkdownBlocks('A  \nB\\\nC');
    const p = blocks.find((b) => b.kind === 'paragraph');
    assert.ok(p);
    assert.equal(flattenParagraphLines(p.lines), 'A\nB\nC');
    assert.equal(p.lines[0].hardBreak, true);
    assert.equal(p.lines[1].hardBreak, true);
  });

  it('keeps bold and inline code text on hard-broken lines', () => {
    const blocks = parseMarkdownBlocks('**강조** 줄  \n`code` 다음');
    const p = blocks.find((b) => b.kind === 'paragraph');
    assert.ok(p);
    assert.match(p.lines[0].text, /\*\*강조\*\*/);
    assert.match(p.lines[1].text, /`code`/);
    assert.equal(p.lines[0].hardBreak, true);
  });

  it('does not merge list into previous paragraph', () => {
    const blocks = parseMarkdownBlocks('문단\n\n- 항목1\n- 항목2');
    assert.equal(blocks[0].kind, 'paragraph');
    assert.equal(blocks[1].kind, 'list');
    assert.deepEqual(blocks[1].items, ['항목1', '항목2']);
  });

  it('keeps code fence newlines intact', () => {
    const blocks = parseMarkdownBlocks('```js\nconst a = 1;\nconst b = 2;\n```');
    assert.equal(blocks[0].kind, 'code');
    assert.equal(blocks[0].code, 'const a = 1;\nconst b = 2;');
  });

  it('supports multi-line blockquote', () => {
    const blocks = parseMarkdownBlocks('> **한 줄 결론**\n>\n> 판단 본문');
    assert.equal(blocks[0].kind, 'quote');
    assert.ok(blocks[0].lines.length >= 2);
  });
});

describe('duplicate H1 detection', () => {
  it('skips when body H1 matches formal title', () => {
    assert.equal(
      isDuplicateDocumentH1(
        '실시간성을 위해 오래된 RTSP 프레임을 버리기로 한 판단',
        '실시간성을 위해 오래된 RTSP 프레임을 버리기로 한 판단',
        '실시간 프레임 지연 제어',
      ),
      true,
    );
  });

  it('skips when body H1 matches display/nav title', () => {
    assert.equal(
      isDuplicateDocumentH1('실시간 프레임 지연 제어', '다른 정식 제목', '실시간 프레임 지연 제어'),
      true,
    );
  });

  it('keeps distinct H1', () => {
    assert.equal(
      isDuplicateDocumentH1('별도 섹션 제목 아님', '정식 문서 제목', '내비 제목'),
      false,
    );
  });
});
