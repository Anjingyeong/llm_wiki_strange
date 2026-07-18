import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const header = readFileSync(join(root, 'src/components/StatusHeader.tsx'), 'utf8');
const sidebar = readFileSync(join(root, 'src/components/Sidebar.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

test('mobile menu exposes the drawer state and stable controlled element', () => {
  // Given: the header button and the sidebar are separate React components.
  // When: assistive technology reads the menu button.
  // Then: the button exposes the real open state and controls the stable sidebar id.
  assert.match(header, /aria-expanded=\{menuOpen\}/);
  assert.match(header, /aria-controls=\{sidebarId\}/);
  assert.match(sidebar, /id=\{WIKI_SIDEBAR_ID\}/);
  assert.match(app, /menuOpen=\{mobileNavOpen\}/);
});

test('closed mobile drawer is inert while the desktop sidebar remains available', () => {
  // Given: drawer visibility depends on both viewport and open state.
  // When: the narrow-screen drawer is closed.
  // Then: it is removed from the accessibility and focus trees only on mobile.
  assert.match(sidebar, /isMobileViewport\s*&&\s*!mobileOpen/);
  assert.match(sidebar, /aria-hidden=\{mobileDrawerHidden\}/);
  assert.match(sidebar, /inert=\{mobileDrawerHidden\s*\?\s*true\s*:\s*undefined\}/);
});

test('drawer focus enters on open and returns to the menu button on Escape', () => {
  // Given: keyboard focus begins on the menu button.
  // When: the drawer opens and then receives Escape.
  // Then: focus enters the drawer and is restored to the trigger when it closes.
  assert.match(
    app,
    /querySelector<HTMLElement>\('button:not\(\[disabled\]\)'\)[\s\S]*?\.focus\(\)/,
  );
  assert.match(app, /e\.key === 'Escape'[\s\S]*closeMobileNav\(\)/);
  assert.match(app, /mobileMenuButtonRef\.current\?\.focus\(\)/);
  assert.match(header, /ref=\{menuButtonRef\}/);
});

test('open drawer wraps Tab focus at both boundaries', () => {
  // Given: focus is on either edge of the open drawer's focusable controls.
  // When: the user presses Tab or Shift+Tab toward the outside of the drawer.
  // Then: focus wraps to the opposite edge instead of escaping the drawer.
  assert.match(app, /e\.key\s*[!=]==\s*'Tab'/);
  assert.match(app, /e\.shiftKey[\s\S]*lastFocusable\.focus\(\)/);
  assert.match(app, /activeElement === lastFocusable[\s\S]*firstFocusable\.focus\(\)/);
});

test('shell provides skip navigation, visible keyboard focus, and reduced motion', () => {
  // Given: keyboard and reduced-motion users enter through the application shell.
  // When: they navigate or request less motion.
  // Then: the main content is directly reachable and motion/focus preferences are honored.
  assert.match(app, /className="skipLink" href="#wiki-main-content"/);
  assert.match(app, /id="wiki-main-content"/);
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('status header uses named areas for desktop and narrow layouts', () => {
  // Given: the header has menu, title, subtitle, and status children.
  // When: CSS lays them out at desktop and mobile widths.
  // Then: named areas keep title out of the menu column and status full-width on mobile.
  assert.match(css, /grid-template-areas:\s*"menu title status"\s*"menu subtitle status"/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*grid-template-areas:\s*"menu title"\s*"subtitle subtitle"\s*"status status"/);
});
