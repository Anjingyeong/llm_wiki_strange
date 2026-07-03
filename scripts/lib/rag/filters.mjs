import { tokenize } from './embedding.mjs';

const queryHints = [
  {
    tokens: ['rtsp', 'webrtc', 'hls', 'stream', 'streaming', 'camera', 'publisher', '카메라', '송출'],
    categories: ['Frontend', 'Infra', 'Bugs', 'Architecture'],
    tags: ['streaming', 'rtsp', 'webrtc', 'hls', 'camera'],
  },
  {
    tokens: ['overlay', 'frameid', 'frame', 'sync', 'captures', 'capturedatms', 'latency', 'buffer', '프레임', '동기화', '밀림', '구조'],
    categories: ['Bugs', 'Architecture', 'AI Pipeline', 'Frontend', 'Project'],
    tags: ['overlay', 'frame-sync', 'latency', 'tracking'],
  },
  {
    tokens: ['mqtt', 'payload', 'event', 'topic', 'schema', '이벤트', '페이로드'],
    categories: ['Backend', 'AI Pipeline', 'Architecture', 'Bugs'],
    tags: ['mqtt', 'payload', 'event'],
  },
  {
    tokens: ['yolo', 'yolo26n', 'lstm', 'model', 'training', 'retraining', 'bbox54', '선택', '이유', '모델'],
    categories: ['AI Pipeline', 'Experiments', 'ADR', 'Project'],
    tags: ['model', 'training', 'yolo26n', 'lstm', 'bbox54'],
  },
  {
    tokens: ['bug', 'error', 'failure', 'mismatch', '404', 'drift'],
    categories: ['Bugs', 'Infra', 'Frontend', 'Backend'],
    tags: ['bug', 'troubleshooting'],
  },
  {
    tokens: ['cameraloginid', 'run', 'registered', 'cameras', 'py'],
    categories: ['Architecture', 'Infra', 'Bugs', 'Backend'],
    tags: ['camera', 'runtime', 'streaming'],
  },
];

export function normalizeList(values) {
  if (!values) {
    return [];
  }
  return Array.isArray(values) ? values.map(String) : [String(values)];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function inferMetadataFilters(query, explicitFilters = {}) {
  const queryTokens = new Set(tokenize(query));
  const categories = normalizeList(explicitFilters.category ?? explicitFilters.categories);
  const tags = normalizeList(explicitFilters.tag ?? explicitFilters.tags);
  const slugs = normalizeList(explicitFilters.slug ?? explicitFilters.slugs);
  const sourcePaths = normalizeList(explicitFilters.sourcePath ?? explicitFilters.sourcePaths);

  for (const hint of queryHints) {
    if (hint.tokens.some((token) => queryTokens.has(token))) {
      categories.push(...hint.categories);
      tags.push(...hint.tags);
    }
  }

  return {
    categories: unique(categories),
    tags: unique(tags),
    slugs: unique(slugs),
    sourcePaths: unique(sourcePaths),
    explicit: Object.keys(explicitFilters).length > 0,
  };
}

function matchesFilters(chunk, filters) {
  const chunkTags = normalizeList(chunk.tags).map((item) => item.toLowerCase());
  const categoryMatch = filters.categories.length === 0 || filters.categories.includes(chunk.category);
  const tagMatch =
    filters.tags.length === 0 || filters.tags.some((tag) => chunkTags.includes(tag.toLowerCase()));
  const slugMatch = filters.slugs.length === 0 || filters.slugs.includes(chunk.slug);
  const sourceMatch = filters.sourcePaths.length === 0 || filters.sourcePaths.includes(chunk.sourcePath);
  return categoryMatch && tagMatch && slugMatch && sourceMatch;
}

function matchesInferredFilters(chunk, filters) {
  const chunkTags = normalizeList(chunk.tags).map((item) => item.toLowerCase());
  const hasCategory = filters.categories.length > 0 && filters.categories.includes(chunk.category);
  const hasTag = filters.tags.some((tag) => chunkTags.includes(tag.toLowerCase()));
  const hasSlug = filters.slugs.length > 0 && filters.slugs.includes(chunk.slug);
  const hasSource = filters.sourcePaths.length > 0 && filters.sourcePaths.includes(chunk.sourcePath);
  return hasCategory || hasTag || hasSlug || hasSource;
}

export function filterCandidateChunks(chunks, filters) {
  if (filters.explicit) {
    return chunks.filter((chunk) => matchesFilters(chunk, filters));
  }
  const hasInferred =
    filters.categories.length > 0 || filters.tags.length > 0 || filters.slugs.length > 0 || filters.sourcePaths.length > 0;
  const filtered = hasInferred ? chunks.filter((chunk) => matchesInferredFilters(chunk, filters)) : chunks;
  return filtered.length > 0 ? filtered : chunks;
}

export function metadataBoost(chunk, filters) {
  let boost = 1;
  const chunkTags = normalizeList(chunk.tags).map((item) => item.toLowerCase());
  if (filters.categories.includes(chunk.category)) {
    boost += 0.18;
  }
  if (filters.tags.some((tag) => chunkTags.includes(tag.toLowerCase()))) {
    boost += 0.16;
  }
  if (chunk.summary) {
    boost += 0.04;
  }
  if (chunk.updatedAt) {
    boost += 0.02;
  }
  return boost;
}
