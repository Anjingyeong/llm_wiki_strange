/** @typedef {'planned'|'implemented'|'verified'|'deprecated'|'unknown'} ImplementationStatus */

export const IMPLEMENTATION_STATUS_VALUES = /** @type {const} */ ([
  'planned',
  'implemented',
  'verified',
  'deprecated',
  'unknown',
]);

/** UI / answer labels (Korean). */
export const IMPLEMENTATION_STATUS_LABELS = {
  planned: '계획',
  implemented: '구현됨',
  verified: '검증됨',
  deprecated: '폐기됨',
  unknown: '상태 미확인',
};

/**
 * @param {unknown} value
 * @returns {ImplementationStatus | null}
 */
export function normalizeImplementationStatus(value) {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  if (!raw) return null;
  if (raw === 'plan' || raw === 'planning' || raw === 'planned') return 'planned';
  if (raw === 'implement' || raw === 'implemented' || raw === 'partial' || raw === 'partially_implemented') {
    return 'implemented';
  }
  if (raw === 'verify' || raw === 'verified' || raw === 'validated' || raw === 'ops_verified') {
    return 'verified';
  }
  if (raw === 'deprecated' || raw === 'obsolete' || raw === 'retired' || raw === 'superseded') {
    return 'deprecated';
  }
  if (raw === 'unknown' || raw === 'unconfirmed' || raw === 'tbd') return 'unknown';

  // Free-text Korean / mixed values seen in existing docs.
  if (/폐기|obsolete|deprecated|superseded|원복\s*전|더\s*이상\s*사용/.test(raw)) return 'deprecated';
  if (/검증됨|verified|운영\s*검증|pass.*검증|재실행\s*가능/.test(raw) && !/미검증/.test(raw)) {
    return 'verified';
  }
  if (/부분\s*구현|implemented|mock\s*검증|코드상\s*검증|구현됨/.test(raw)) return 'implemented';
  if (/계획|planned|plan\b|미착수|설계\s*안/.test(raw)) return 'planned';
  return null;
}

/**
 * Soft inference only when explicit field is absent. Never invents scores.
 * @param {{
 *   slug?: string,
 *   title?: string,
 *   type?: string,
 *   evidence_type?: string,
 *   status?: string,
 *   status_split?: string,
 *   implementation_status?: string,
 *   tags?: string[] | string,
 * }} doc
 * @returns {ImplementationStatus}
 */
export function resolveImplementationStatus(doc = {}) {
  const explicit = normalizeImplementationStatus(doc.implementation_status);
  if (explicit) return explicit;

  const fromStatus = normalizeImplementationStatus(doc.status);
  if (fromStatus) return fromStatus;

  const slug = String(doc.slug ?? '');
  const type = String(doc.type ?? '').toLowerCase();
  const evidenceType = String(doc.evidence_type ?? '').toLowerCase();
  const statusSplit = String(doc.status_split ?? '');
  const title = String(doc.title ?? '');
  const tags = Array.isArray(doc.tags)
    ? doc.tags.map((t) => String(t).toLowerCase())
    : String(doc.tags ?? '')
        .toLowerCase()
        .split(/[,\s]+/)
        .filter(Boolean);

  if (
    /^plan[-_]/i.test(slug)
    || type.includes('plan')
    || evidenceType === 'plan'
    || tags.includes('plan')
    || /^plan\b/i.test(title)
  ) {
    return 'planned';
  }

  if (/폐기|deprecated|obsolete/.test(statusSplit)) return 'deprecated';

  // Mock / offline verified code paths are implemented, not full ops verified.
  if (
    evidenceType.includes('mock')
    || type.includes('mock')
    || /mock\s*검증|코드상\s*검증|오프라인/.test(statusSplit)
  ) {
    return 'implemented';
  }

  if (/운영\s*검증|verified|검증\s*완료/.test(statusSplit) && !/미검증/.test(statusSplit)) {
    return 'verified';
  }

  if (
    type === 'bug-report'
    || type === 'evidence-log'
    || type === 'pipeline'
    || type === 'architecture'
    || type === 'engineering-decision'
    || type === 'model-decision'
    || type === 'evidence'
    || type === 'architecture-case'
  ) {
    return 'implemented';
  }

  return 'unknown';
}

/**
 * @param {ImplementationStatus | string | null | undefined} status
 */
export function implementationStatusLabel(status) {
  const key = normalizeImplementationStatus(status) ?? 'unknown';
  return IMPLEMENTATION_STATUS_LABELS[key] ?? IMPLEMENTATION_STATUS_LABELS.unknown;
}

/**
 * Prefer verified/implemented evidence for "current state" questions.
 * @param {ImplementationStatus | string | null | undefined} status
 */
export function isCurrentStatePreferred(status) {
  const key = normalizeImplementationStatus(status) ?? 'unknown';
  return key === 'verified' || key === 'implemented';
}

/**
 * @param {ImplementationStatus | string | null | undefined} status
 */
export function isHistoricalOrPlan(status) {
  const key = normalizeImplementationStatus(status) ?? 'unknown';
  return key === 'planned' || key === 'deprecated';
}
