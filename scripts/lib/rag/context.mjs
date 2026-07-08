const MAX_CONTEXT_CHARS = 4800;
const DEFAULT_CONTEXT_CHUNKS = 6;

export function buildContextChunks(chunks, limit = DEFAULT_CONTEXT_CHUNKS) {
  const perDocumentCount = new Map();
  const selected = [];
  for (const chunk of chunks) {
    const currentCount = perDocumentCount.get(chunk.documentId) ?? 0;
    if (currentCount >= 2) {
      continue;
    }
    perDocumentCount.set(chunk.documentId, currentCount + 1);
    selected.push(chunk);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected
    .sort((left, right) => {
      const orderDiff = (left.order ?? 999) - (right.order ?? 999);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      if (left.documentId === right.documentId) {
        return (left.chunkOrder ?? 0) - (right.chunkOrder ?? 0);
      }
      return String(left.sectionTitle ?? left.section).localeCompare(String(right.sectionTitle ?? right.section));
    })
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      displayTitle: chunk.displayTitle ?? chunk.title,
      title: chunk.title,
      category: chunk.category,
      sectionTitle: chunk.sectionTitle ?? chunk.section,
      updatedAt: chunk.updatedAt,
      sourcePath: chunk.sourcePath ?? `content/${chunk.slug}.md`,
      slug: chunk.slug,
      text: chunk.text,
      score: chunk.score,
      matchedBy: chunk.matchedBy ?? [],
      reason: chunk.reason ?? '',
      chunkOrder: chunk.chunkOrder ?? 0,
    }));
}

export function buildContext(chunks, limit = DEFAULT_CONTEXT_CHUNKS) {
  let used = 0;
  const context = [];
  for (const chunk of buildContextChunks(chunks, limit)) {
    const next = [
      `DisplayTitle: ${chunk.displayTitle}`,
      `Title: ${chunk.title}`,
      `Category: ${chunk.category}`,
      `Section: ${chunk.sectionTitle}`,
      `UpdatedAt: ${chunk.updatedAt}`,
      `Source: ${chunk.sourcePath}`,
      '',
      chunk.text,
    ].join('\n');
    if (used + next.length > MAX_CONTEXT_CHARS) {
      break;
    }
    context.push(next);
    used += next.length;
  }
  return context.join('\n\n---\n\n');
}
