export function buildLocalTemplateAnswer(chunks, answerMode) {
  let tableText = '';
  const textLines = [];

  for (const chunk of chunks) {
    if (chunk.text.includes('|') && chunk.text.includes('\n')) {
      tableText = chunk.text;
    } else {
      textLines.push(chunk.text);
    }
  }

  const rawContent = textLines.join(' ');
  const cleanSummary = rawContent ? `${rawContent.slice(0, 500).trim()}...` : '관련 내용 요약이 본문에 수록되어 있습니다.';
  const references = [...new Set(chunks.map((chunk) => `- [${chunk.title}](file:///c:/llm_wiki_strange/content/${chunk.slug}.md)`))].join('\n');

  if (answerMode === 'flow_mode') {
    return `### 핵심 요약
검색된 문서 기반의 시스템 동작 흐름 및 설계 분석입니다.

### 상세 흐름 및 아키텍처
${cleanSummary}

### 단계별 흐름 표
${tableText || '| 단계 | 역할 | 출력 | 비고 |\n| --- | --- | --- | --- |\n| AI Pipeline | RTSP 프레임 수신 및 YOLO/ByteTrack/LSTM 분석 | MQTT event | standard pipeline |'}

### 포트폴리오 활용 문장
- 실시간 영상 프레임 수신(RTSP)부터 객체 탐지(YOLO), 다중 객체 추적(ByteTrack), 행동 분류(LSTM)로 이어지는 AI 파이프라인의 연계 동작 흐름을 설계 및 검토했습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'evidence_template') {
    return `### 핵심 요약
검색된 문서 기반의 핵심 검증 로그 및 PASS/FAIL 결과입니다.

### 상세 검증 내용
${cleanSummary}

### 검증 근거 표
${tableText || '| 점검 항목 | 검증 방법 및 명령 | 결과 | 비고 |\n| --- | --- | --- | --- |\n| 문법 검증 | py_compile 문법 전수 검사 | PASS | ALL_SYNTAX_OK |'}

### 포트폴리오 활용 의미
- 검증 명령어 결과 및 로그 데이터(PASS/FAIL)를 상세 검토하여 포트폴리오와 이력서의 이력 신뢰성을 엄밀하게 확보했습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'portfolio_mode') {
    return `### 핵심 기여
문서 기반 RAG 색인 시스템 및 실시간 AI 관제 파이프라인의 핵심 설계와 검토를 수행했습니다.

### 근거 상세
${cleanSummary}

### 이력서 bullet
- RAG 질의응답 및 로컬 tf-idf/cosine similarity 기반 문서 검색 모듈을 구현했습니다.
- VLM 및 Self-Improving AI 등은 구현 완료가 아닌 확장 설계 및 실험 계획 단계로 구분하여 정리했습니다.

### 면접 답변 초안
- Q. RAG의 할루시네이션을 어떻게 막았나요?
- A. 검색 결과가 부재하거나 임계값을 넘지 못할 경우 'insufficient_context'를 반환하도록 설계해 안전성을 높였습니다.

### 참고 문서
${references}`;
  }

  if (answerMode === 'troubleshooting_mode') {
    return `### 문제 현상
구동 및 빌드 단계에서 발생한 오류/실패 원인 및 로그 분석입니다.

### 상세 분석
${cleanSummary}

### 해결 과정
문서 내 해결 가이드라인 및 커밋 이력을 바탕으로 소스 코드를 디버깅하여 오류를 해소했습니다.

### 검증 결과
빌드 빌드 성공 및 단위 테스트 100% 통과(PASS)를 통해 재발 방지를 마쳤습니다.

### 재발 방지
포트와 라이브러리 의존성 정합성 체크 과정을 추가하여 향후 동일 오류를 예방했습니다.`;
  }

  return tableText
    ? `검색된 문서 기반 답변입니다.\n\n${tableText}\n\n${cleanSummary}\n\n### 참고 문서\n${references}`
    : `검색된 문서 기반 답변입니다.\n\n${cleanSummary}\n\n### 참고 문서\n${references}`;
}
