export const ANSWER_MODE_LABELS: Record<string, string> = {
  flow_mode: '⚙️ 동작 흐름',
  evidence_template: '✅ 검증 근거',
  portfolio_mode: '💼 포트폴리오',
  troubleshooting_mode: '🔧 문제 해결',
  general: '📄 일반',
};

export const QUICK_QUESTIONS = [
  { label: '⚙️ 동작 흐름', query: '스마트 안전 관제 시스템 동작 흐름' },
  { label: '🔬 기술 선택 근거', query: 'YOLO26n-pose를 선택한 근거는?' },
  { label: '✅ 검증 결과', query: 'py_compile 검증 결과는?' },
  { label: '💼 포트폴리오', query: '이 프로젝트를 포트폴리오용으로 요약해줘' },
  { label: '🎤 면접 답변', query: 'RAG 기능의 포트폴리오 근거를 알려줘' },
] as const;
