# LLM Wiki Design System

## 1. Product Character

LLM Wiki is a dense project knowledge base for engineers and operators. The interface should feel quiet, readable, and operational: fast scanning, clear provenance, and no marketing-style decoration.

## 2. Color Tokens

- `--bg`: page background.
- `--panel`: primary surface.
- `--panel-strong`: selected and elevated surface.
- `--text`: primary text.
- `--muted`: secondary text.
- `--line`: borders and dividers.
- `--accent`: primary action fill.
- `--accent-strong`: action text and source labels.
- `--code`: code block background.
- `--code-text`: code block text.

## 3. Typography

- Font stack: Inter, system UI, Segoe UI, sans-serif.
- Body: 1rem, 1.75 line height for markdown reading.
- Compact controls: 0.85rem to 0.95rem with 700 weight labels.
- Document hero heading: responsive clamp already defined in `src/styles.css`.

## 4. Spacing

- Base unit: 4px.
- Dense panels use 8px, 12px, 16px, and 20px spacing.
- Page gutters use responsive clamps already defined on `.content`.

## 5. Components

- Navigation items: 8px radius, border-on-hover, no shadows.
- Search results: single-level cards with category, title, excerpt, and tags.
- RAG answer panel: same surface language as search, with a textarea, compact action button, answer body, and source rows.
- Tags and source IDs: small border pills, never oversized.

## 6. Interaction

- Keep interactions predictable: submit buttons for commands, links for document navigation, and visible disabled/loading states.
- All text inputs must have labels.
- API errors must be rendered as text in the panel without blocking document reading.

## 7. Accessibility

- Preserve semantic landmarks: sidebar navigation, main content, article, and labelled sections.
- Maintain contrast through existing light/dark tokens.
- Use real buttons for submit actions and ensure focus stays in normal tab order.

## 8. RAG Portfolio Assistant & Evidence Wiki Architecture

### 8.1 Evidence Wiki 목적
- 엔지니어링 수행 이력에 대한 구체적인 "검증 근거(PASS/FAIL 명령어, 결과 로그, 아키텍처 스키마)"를 RAG 엔진과 밀접하게 연동하여 신뢰할 수 있는 이력서/포트폴리오 백업을 제공한다.

### 8.2 answerMode 구조
- **flow_mode**: 아키텍처 및 데이터 흐름 질문 대응. 핵심 요약 ➔ 단계별 흐름 표 ➔ 포트폴리오 활용 문장 ➔ 참고 문서 구조로 답한다.
- **evidence_template**: 검증 결과 및 테스트 로그 질문 대응. 핵심 요약 ➔ 검증 근거 표(PASS/FAIL) ➔ 포트폴리오 활용 의미 ➔ 참고 문서 구조로 답한다.
- **portfolio_mode**: 자소서, 이력서, 면접 초안 질문 대응. 핵심 기여 ➔ 근거 ➔ 이력서 bullet ➔ 면접 답변 초안 ➔ 참고 문서 구조로 답한다.
- **troubleshooting_mode**: 에러 및 버그 질문 대응. 문제 현상 ➔ 원인 ➔ 해결 과정 ➔ 검증 결과 ➔ 재발 방지 구조로 답한다.
- **general**: 일반 질문 대응.

### 8.3 Local Template Fallback
- 외부 LLM API 키(`RAG_LLM_API_KEY`)가 없을 때도, 로컬 검색된 chunk의 \`cleanSummary\`와 문맥을 파싱하여 핵심 마크다운 표 및 단계별 템플릿 답변 구조를 동적으로 결합해 완전한 답변 포맷을 제공한다.

### 8.4 외부 LLM Grounded Answer 구조
- \`RAG_LLM_PROVIDER\`, \`RAG_LLM_MODEL\`, \`RAG_LLM_API_KEY\` 환경변수를 로드하여 서버측에서 API를 안전하게 호출한다. (OpenAI 키가 클라이언트에 노출되지 않는다.)
- 검색된 Top-k chunk만 LLM Context로 전달하여 토큰 비용을 최소화하고, 할루시네이션(Hallucination) 방지를 위해 Context 범위 내의 사실만 기재하도록 시스템 프롬프트 제약을 가한다.

### 8.5 Metadata & Query Boosting 방식
- **Query Expansion**: 쿼리 키워드 분석을 통해 검색 쿼리를 관련 키워드(예: \`architecture\`, \`pipeline\`, \`PASS/FAIL\`)로 자동 확장한다.
- **Score Boosting**: 각 문서의 frontmatter(\`project\`, \`type\`, \`portfolio_use\`)를 색인화하고, \`portfolio_use: true\` 인 문서 및 질문 의도와 정합하는 \`type\` 문서에 대해 cosine similarity score에 동적 가중치(Boost multiplier)를 적용하여 정밀하게 우선 노출한다.

### 8.6 디버그 정보 숨김 정책
- 유저 화면에는 \`Code Keywords\`, raw score, chunk ID 등의 지저분한 디버그용 메타데이터가 본문에 섞여 노출되지 않도록 필터링한다.
- 디버그 목적의 정보는 RAG API 응답의 \`debugInfo\` 객체에 구조화하여 전송되며, 프론트엔드 UI에서는 \`<details>\` 태그 하위의 개발자 모드 서랍 내부에 접어둔다.
