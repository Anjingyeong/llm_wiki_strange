import graphRelations from '../generated/graphRelations.json';

export type GraphRelationKind = 'EXTRACTED' | 'INFERRED';

export type GraphRelationHit = {
  readonly kind: GraphRelationKind;
  readonly label: string;
  readonly relation: string;
  readonly peerLabel: string;
  readonly sourceFile?: string;
};

type RawHit = {
  readonly kind: string;
  readonly relation: string;
  readonly peerLabel: string;
  readonly sourceFile?: string;
};

const byBasename = (
  graphRelations as {
    readonly byBasename: Readonly<Record<string, readonly RawHit[]>>;
  }
).byBasename;

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return (parts[parts.length - 1] ?? path).toLowerCase();
}

export function graphRelationKindLabel(kind: GraphRelationKind): string {
  return kind === 'EXTRACTED' ? '원문 확인 관계' : 'AI 추론 관계';
}

/** Map related file paths to a few graph edges touching the same basename. */
export function findGraphRelationsForFiles(
  files: readonly string[] | undefined,
  limit = 3,
): readonly GraphRelationHit[] {
  if (!files?.length) return [];

  const hits: GraphRelationHit[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const key = basename(String(file));
    if (!key) continue;
    const rows = byBasename[key];
    if (!rows) continue;
    for (const row of rows) {
      const kind = row.kind === 'EXTRACTED' || row.kind === 'INFERRED' ? row.kind : null;
      if (!kind) continue;
      const dedupe = `${kind}|${row.relation}|${row.peerLabel}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      hits.push({
        kind,
        label: graphRelationKindLabel(kind),
        relation: row.relation,
        peerLabel: row.peerLabel,
        ...(row.sourceFile ? { sourceFile: row.sourceFile } : {}),
      });
      if (hits.length >= limit) return hits;
    }
  }

  return hits;
}
