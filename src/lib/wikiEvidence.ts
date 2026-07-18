import type {
  WikiDocument,
  WikiDocumentStatus,
  WikiDocumentType,
  WikiEvidenceLevel,
  WikiRelationKind,
} from './types';

export const WIKI_DOCUMENT_TYPE_LABELS = {
  architecture: '아키텍처',
  baseline: '기준선',
  contract: '계약',
  'daily-log': '일일 기록',
  decision: '결정',
  evidence: '근거',
  experiment: '실험',
  incident: '장애 기록',
  meta: '메타',
  overview: '개요',
  plan: '계획',
  reference: '참고',
  runbook: '운영 절차',
} as const satisfies Record<WikiDocumentType, string>;

export const WIKI_DOCUMENT_STATUS_LABELS = {
  archived: '보관됨',
  partial: '부분 검증',
  planned: '계획됨',
  superseded: '대체됨',
  verified: '검증됨',
} as const satisfies Record<WikiDocumentStatus, string>;

export const WIKI_EVIDENCE_LEVEL_LABELS = {
  'code-only': '코드 확인',
  'unit-test': '단위 테스트',
  'offline-benchmark': '오프라인 벤치마크',
  'live-canary': '라이브 카나리',
  production: '운영 환경',
} as const satisfies Record<WikiEvidenceLevel, string>;

export const WIKI_OUTGOING_RELATION_LABELS = {
  related: '관련됨',
  supports: '근거를 보탬',
  'depends-on': '선행 지식으로 참조',
  implements: '구현함',
  supersedes: '대체함',
  contrasts: '대조함',
} as const satisfies Record<WikiRelationKind, string>;

export const WIKI_BACKLINK_RELATION_LABELS = {
  related: '이 문서와 관련됨',
  supports: '이 문서를 뒷받침함',
  'depends-on': '이 문서에 의존함',
  implements: '이 문서를 구현함',
  supersedes: '이 문서를 대체함',
  contrasts: '이 문서와 대조함',
} as const satisfies Record<WikiRelationKind, string>;

export function getDocumentAnswer(document: WikiDocument): string {
  return document.summary ?? document.excerpt;
}

export function getVerificationLabel(verifiedAt: string | undefined): string {
  return verifiedAt ? `${verifiedAt} 검증` : '검증일 미기재';
}
