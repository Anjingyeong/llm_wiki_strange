const MAX_CONTEXT_CHUNKS = 4;
const MAX_CONTEXT_CHARS = 3600;

export function buildContextChunks(chunks) {
  const perDocumentCount = new Map();
  const selected = [];
  for (const chunk of chunks) {
    const currentCount = perDocumentCount.get(chunk.documentId) ?? 0;
    if (currentCount >= 2) {
      continue;
    }
    perDocumentCount.set(chunk.documentId, currentCount + 1);
    selected.push(chunk);
    if (selected.length >= MAX_CONTEXT_CHUNKS) {
      break;
    }
  }
  return selected
    .sort((left, right) => {
      const orderDiff = (left.order ?? 999) - (right.order ?? 999);
      return orderDiff === 0 ? String(left.sectionTitle ?? left.section).localeCompare(String(right.sectionTitle ?? right.section)) : orderDiff;
    })
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
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
    }));
}

export function buildContext(chunks) {
  let used = 0;
  const context = [];
  for (const chunk of buildContextChunks(chunks)) {
    const next = [
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
