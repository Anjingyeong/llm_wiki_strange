# LLM Wiki Design System

## 0. Modern AI Dashboard Design Concept

LLM Wiki uses a **Modern AI Dashboard** visual language. The goal is to elevate the wiki from a raw developer tool into a polished portfolio artifact that demonstrates both technical depth and product craftsmanship.

### Design Principles

| Principle | Intent |
|---|---|
| Card-based information hierarchy | Each section (document, RAG answer, search results) lives in a clearly bounded card with shadow + border |
| Muted slate-50 background | `#F8FAFC` base prevents full-white glare, makes white cards pop naturally |
| Emerald + Blue dual accent | Emerald for primary actions / evidence; blue for navigation / links / search |
| Pretendard-first font stack | Korean-optimised variable font; falls back to Inter → system-ui |
| Dense but breathable spacing | Comfortable reading with 1.8 line-height; generous section gaps |
| Progressive disclosure | Debug info, raw scores, and chunk IDs hidden behind `<details>` toggles |

### Color Token Overhaul (v2)

```
--bg            #F8FAFC          Slate-50 page canvas
--panel         #FFFFFF          White card surface
--panel-strong  #F1F5F9          Elevated/selected surface
--text          #0F172A          Slate-900 primary text
--text-sub      #334155          Slate-700 secondary text
--muted         #64748B          Slate-500 meta text
--line          #E2E8F0          Slate-200 borders
--accent        #059669          Emerald-600
--blue          #2563EB          Blue-600
--shadow-sm/md  0 1px 3px…       Layered elevation system
```

Dark mode uses a deep navy (`#0B1120`) canvas with adjusted contrast ratios.

### Card Architecture

Every major UI region is a **card**:
- Sidebar: white panel with gradient brand mark
- Document viewer: white card with xl border-radius, padding 36px 44px
- Search results: floating card with drop shadow
- RAG panel: gradient-header card with overflow: hidden
- Answer card: nested card with status-coloured header strip

### RAG Portfolio Assistant UI Patterns

- **Quick buttons**: pill group for one-click evidence queries
- **answerMode badge**: coloured chip showing detected query mode (flow / evidence / portfolio / troubleshooting / general)
- **Loading skeleton**: shimmer animation while waiting for response
- **Source chips**: compact rounded badges linking back to wiki documents
- **Debug details**: collapsed `<details>` with raw JSON scores and query expansion — invisible to reviewers by default

### Portfolio UX Rationale

This wiki doubles as a **live portfolio demonstration** tool. The UI design choices serve this dual purpose:
1. The gradient brand mark and status dot signal that this is an active, maintained project
2. answerMode badges show that the system has intent-classification logic
3. Source chips provide **grounded evidence** visible to interviewers
4. The card-based layout screenshots well in portfolio decks and README previews

---



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
