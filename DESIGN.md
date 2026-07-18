# LLM Wiki Design Contract

## 0. Contract status

This document is the implementation contract for the existing LLM Wiki. It reconciles the current slate, white, emerald, and blue interface into one direction: a **quiet technical evidence desk**. The product should help a reader understand a system, inspect a claim, and follow its proof. It is not a generic AI dashboard, a marketing portfolio, or a wall of decorative cards.

Priority order:

1. Evidence and provenance
2. Reading and navigation
3. Search and grounded questions
4. Operational status
5. Decoration

When rules conflict, accessibility and task completion outrank visual taste. Existing strengths to preserve are the restrained slate-white-emerald hierarchy, the readable desktop measure, the three-part desktop shell, and compact evidence labels.

## 1. Product character and hierarchy

LLM Wiki is a maintained knowledge system for interviewers, engineers, and constrained readers. It should feel calm, precise, and inspectable.

- **Proof before decoration:** a status, answer, or recommendation must lead to its evidence, verification date, and related knowledge.
- **Document first:** the current document is the dominant surface. Search, RAG, and system health support it and must not permanently push it below the fold.
- **Progressive disclosure:** summaries and provenance are immediately legible; raw scores, chunk IDs, and diagnostics stay behind labelled disclosure controls.
- **One level of emphasis:** emerald marks verified evidence and primary actions; blue marks navigation, focus, and links. Do not use both accents to decorate the same element.
- **Cards are bounded, not universal:** use a bordered card only for a workflow with its own state (search, ask, access) or for a bounded evidence group (answer, sources, incident status). Navigation, document sections, metadata rows, and page chrome use spacing and dividers, not nested cards.
- **No fake health:** "available", "verified", "live", or similar states must come from current runtime or metadata, never from decorative dots or optimistic copy.

## 2. Foundation tokens

### 2.1 Colour

The existing perceptual roles remain locked. Implementations may tune exact dark-mode values only after contrast verification.

| Role | Light token | Meaning |
|---|---|---|
| Canvas | `--bg: #f8fafc` | Quiet slate page background |
| Primary surface | `--panel: #ffffff` | Document and bounded workflow surface |
| Selected surface | `--panel-strong: #f1f5f9` | Current row, subtle grouping, code-adjacent UI |
| Primary text | `--text: #0f172a` | Headings and body |
| Secondary text | `--text-sub: #334155` | Explanations and metadata values |
| Muted text | `--muted: #64748b` | Labels and timestamps; not for critical instructions |
| Divider | `--line: #e2e8f0` | Structural separation |
| Strong divider | `--line-strong: #cbd5e1` | Input and selected boundaries |
| Evidence | `--accent: #059669` | Verified evidence and primary action |
| Navigation | `--blue: #2563eb` | Links, focus, navigation state |
| Warning | `--warning: #b45309` | Partial or attention-needed state |
| Danger | `--danger: #b91c1c` | Error, failed, or unavailable state |

Do not communicate document state by colour alone. Every state has a text label; icons are optional reinforcement.

### 2.2 Typography

There is one product type decision: **Pretendard-first Korean UI and reading text**. Use one stack throughout prose and controls:

```css
font-family: "Pretendard Variable", Pretendard, -apple-system,
  BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR",
  "Malgun Gothic", "Segoe UI", sans-serif;
```

Do not add Inter as a competing Latin family. The Korean-capable system fallbacks preserve the current rendering when Pretendard is not installed; no runtime font download may block first paint. Use the existing monospace stack only for code, identifiers, and machine values.

- Body: `1rem / 1.75`, regular; target 60-78 Korean characters per line where practical.
- Compact controls: `0.8125rem-0.9375rem`, medium or semibold.
- Metadata labels: `0.75rem-0.8125rem`; uppercase only for short Latin tokens.
- Document title: responsive `clamp`, strong but not marketing-scale.
- Avoid font sizes below 12px for meaningful content.

### 2.3 Spacing, radius, and density

- Base spacing unit: 4px; default sequence: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Reading density is comfortable; navigation and command density are compact.
- Small controls: 6px radius; navigation and inputs: 8-10px; bounded workflows: 12-14px.
- Reserve 20px radius and medium/large shadows for modal or transient overlay surfaces. Do not apply them to every section.
- Dividers and spacing establish hierarchy before shadows.

### 2.4 Semantic state tokens

| State | Required treatment |
|---|---|
| `verified` / success | Emerald text + pale surface + "검증됨" label + verification date when available |
| `partial` / warning | Amber text + pale surface + "부분 검증" label + explicit gap |
| `planned` / neutral | Slate/blue neutral surface + "계획됨" label; never styled as success |
| `superseded` | Muted label + replacement link; old content remains readable |
| error / unavailable | Red text + plain-language reason + recovery action when possible |
| loading | Stable reserved space, `aria-busy`, short text; skeleton only when it reduces layout shift |
| empty | Explain what is empty and the next useful action; no decorative mascot |

## 3. Layout and responsive behaviour

### 3.1 Desktop - 1280px and wider

- Three-column app shell: task navigation (about 268px), fluid document column, and document outline (about 228px).
- Keep the reading surface at or below 900px and centre it within the fluid column.
- The document title, concise answer, state/evidence row, and opening content should form the first reading screen.
- The tools entry is a compact command bar above or adjacent to the document. It may be sticky only when it does not obscure headings or reduce reading space.
- The outline owns its own scroll only when necessary; the page remains the primary document scroll owner.

### 3.2 Tablet - 768px

- Two-column shell: compact task navigation (about 220px) and fluid document content.
- Remove the persistent right outline. Offer the same headings through an in-document disclosure or compact outline control.
- Keep tool tabs/actions compact. Opening Search or Ask may expand a dedicated workflow surface in the content column.
- No horizontal page scrolling at 200% zoom.

### 3.3 Mobile - 375px

- Single-column reading flow beneath a compact sticky header.
- Navigation is a fixed, off-canvas dialog-like drawer and never participates in document flow. Its backdrop, focus trap, Escape close, and focus return are required behaviours.
- Meaningful document content must be visible in the initial 375x812 viewport. A closed drawer must consume no layout height.
- The default tool affordance is a compact command bar. Full Search and Ask are dedicated views/surfaces opened on demand, not an always-expanded card above every document.
- Inputs, tables, code, relationship rows, and source lists wrap or scroll within their own bounds; the viewport does not overflow horizontally.

## 4. Information architecture

Primary navigation groups answer reader questions rather than mirror repository folders:

- Understand the system
- Trace AI decisions
- Debug runtime behaviour
- Inspect evidence
- Operate and reflect

Use stable machine IDs separately from Korean/English display labels. Each canonical page exposes:

1. Concise answer or purpose
2. Document status and evidence level
3. Verification date or explicit verification gap
4. Main explanation
5. Typed outgoing relationships
6. Derived backlinks
7. Sources or operational proof where applicable

Relations use plain-language labels for `supports`, `depends-on`, `implements`, `supersedes`, `contrasts`, and generic `related`. A relation is always a real link, never a dead chip.

## 5. Component contracts

### 5.1 Document surface

- One primary document surface with a readable measure and restrained border/elevation.
- Sections inside the document are not cards by default.
- The header contains category/task context, title, canonical title where needed, status/evidence, and updated/verified dates.
- Dense machine metadata may use a compact definition list or row group.

### 5.2 Compact command bar and dedicated tools

- The reading view exposes short actions: Search, Ask, and System status.
- The compact bar is navigation/command chrome, not a dashboard card.
- Search and Ask open dedicated workflow surfaces with labelled inputs, clear submit actions, loading/error/empty states, and close/back behaviour.
- Search results show title, task/category context, match reason, and a short excerpt. They navigate as links or link-equivalent buttons with a visible focus state.
- Grounded answers show answer mode in plain language, confidence/provenance state, source links, and explicit insufficient-evidence behaviour. Raw retrieval diagnostics remain in a labelled `<details>` block.

### 5.3 Evidence and relationship groups

- A bounded evidence group may use a light border and subtle surface; avoid cards nested inside cards.
- Status chips are short, textual, and semantically consistent across documents and RAG answers.
- Source and relation items must expose a clear link target, relation type, and keyboard focus.
- Superseded documents prominently link to the replacement; replacement documents expose the reciprocal history.

### 5.4 Navigation and outline

- Group headers are buttons with `aria-expanded` and an SVG chevron.
- Document entries are links or link-equivalent controls with a visible current state.
- Use one SVG icon family throughout (Lucide-compatible line icons preferred). No emoji may serve as a menu, search, document, folder, status, answer, or empty-state icon.
- Icons are decorative (`aria-hidden`) when adjacent text carries the meaning; icon-only buttons require an accessible name and tooltip where useful.

## 6. Interaction and motion

Every interactive primitive defines default, hover, focus-visible, active/current, disabled, loading, error, and empty states where applicable.

- Focus ring: 3px blue outline with at least 2px offset; it must remain visible against light, dark, selected, and error surfaces.
- Minimum target: 44x44 CSS px for icon-only and mobile controls. Dense desktop text rows may be 36px high only when spacing prevents adjacent-target errors.
- Current navigation uses more than colour: weight, border/inset marker, and `aria-current`.
- Disabled controls remain legible and state why the action is unavailable when ambiguity is likely.
- Motion communicates navigation, disclosure, or state change only. Animate `transform`, `opacity`, or `filter`; do not animate layout properties.
- `prefers-reduced-motion: reduce` removes nonessential transitions, smooth scrolling, pulsing, and shimmer while preserving immediate state feedback.

## 7. Accessibility and content

- Preserve semantic landmarks: header, navigation, main, article, complementary outline, search, and labelled regions.
- Provide a skip link to the document/main region.
- Keyboard order follows visual order. Dialog/drawer focus is contained while open and returns to its trigger on close.
- Search suggestions use a correct combobox/listbox pattern only if arrow-key selection is implemented; otherwise use a simple search field plus ordinary result links.
- Live results and async answers announce concise status through a polite live region without rereading the full answer.
- Heading levels reflect document structure; do not skip levels for visual sizing.
- Text and controls meet WCAG AA contrast. Focus indicators and state labels are not colour-only.
- Support 200% browser zoom, Korean line breaking, long identifiers, narrow screens, and OS text scaling without clipped actions or horizontal page overflow.
- Plain-language errors state what happened, what remains safe, and what the reader can do next.
- Never claim accessibility, service health, or evidence freshness without exercising or deriving that state.

## 8. Verification contract

Before UI completion, verify the actual production build at 1280, 768, and 375 widths. Evidence must cover:

- Initial document visibility and reading measure
- Mobile drawer open/close, focus trap, Escape, backdrop, and focus return
- Task-group navigation and current-document state
- Canonical answer/status/evidence block
- Outgoing relation and backlink round trip
- Search result navigation and empty/no-match state
- Grounded Ask loading, answer, insufficient-evidence, error, sources, and debug disclosure states
- Keyboard-only flow, focus visibility, 200% zoom, reduced motion, dark mode, and long Korean/identifier stress content
- No emoji UI icons and one consistent SVG family
- No universal-card/dashboard regression

Objective screenshots and browser action logs precede design critique. Significant implementation closes through visual QA and independent review.

## 9. Accepted debt

Accepted debt is explicit; it is not permission to ignore a blocker.

| ID | Debt | Affected users | Required follow-up | Status |
|---|---|---|---|---|
| D-001 | Dark mode currently follows OS only; there is no manual theme control. | Readers needing a per-site override | Add a persistent theme preference only if user research or feedback requires it. | Accepted, low |
| D-002 | Pretendard is not guaranteed to be installed; Korean-capable system fonts may render with small metric differences. | Cross-platform readers | Consider a self-hosted, subset font only after performance and licensing review. | Accepted, low |
| D-003 | Automated screen-reader output is not equivalent to testing with a human assistive-technology user. | Screen-reader users | Run NVDA/VoiceOver task testing before claiming conformance. | Open verification debt; no conformance claim |

Critical or major accessibility, mobile first-screen, evidence-truthfulness, broken-link, or keyboard-navigation failures are not accepted debt and must be repaired or escalated.
