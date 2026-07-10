/** Minimal YAML loader for evaluation harness configs. */
export function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, container: root, type: 'map' }];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      continue;
    }
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const frame = stack[stack.length - 1];

    if (line.startsWith('- ')) {
      const value = coerce(line.slice(2).trim());
      if (frame.type === 'list') {
        frame.container.push(value);
      } else if (frame.type === 'map' && frame.pendingListKey) {
        if (!Array.isArray(frame.container[frame.pendingListKey])) {
          frame.container[frame.pendingListKey] = [];
        }
        frame.container[frame.pendingListKey].push(value);
        stack.push({
          indent,
          container: frame.container[frame.pendingListKey],
          type: 'list',
        });
      }
      continue;
    }

    const idx = line.indexOf(':');
    if (idx < 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const valueRaw = line.slice(idx + 1).trim();

    if (frame.type !== 'map') {
      // pop list frame if we see a map key at same indent as list parent
      while (stack.length > 1 && stack[stack.length - 1].type === 'list') {
        stack.pop();
      }
    }
    const mapFrame = stack[stack.length - 1];
    if (mapFrame.type !== 'map') {
      continue;
    }

    if (valueRaw === '') {
      // Could be nested map or list; defer until next line.
      mapFrame.pendingListKey = key;
      mapFrame.container[key] = [];
      continue;
    }

    mapFrame.pendingListKey = null;
    if (valueRaw.startsWith('[') && valueRaw.endsWith(']')) {
      mapFrame.container[key] = valueRaw
        .slice(1, -1)
        .split(',')
        .map((item) => coerce(item.trim()))
        .filter((item) => item !== '');
      continue;
    }
    mapFrame.container[key] = coerce(valueRaw);
  }

  // Convert empty arrays that received no list items into empty objects if needed — keep arrays.
  return root;
}

function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
