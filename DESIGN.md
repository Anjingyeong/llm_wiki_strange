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
