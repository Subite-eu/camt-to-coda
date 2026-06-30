# Web UI Redesign (shadcn/ui) — Design Spec

**Date:** 2026-07-01
**Status:** Approved (brainstorming)

## Goal

Replace the hand-rolled vanilla web UI with a professional, sleek **shadcn/ui** version: scope **B** (reskin + meaningful UX polish) architected with room to grow to **C** (batch, history, diff) without a rewrite. The conversion engine is unchanged.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Scope | B (reskin + UX polish), seams left for C |
| Architecture | 100% client-side, no backend; conversion stays in-browser |
| Stack | React + Vite + TypeScript + Tailwind + shadcn/ui |
| Engine reuse | `src/core/*` unchanged, via `browser-entry.ts` (`convertForward`/`convertReverse`) |
| Visual style | **Warm Ink** — warm off-whites, near-monochrome, ink-black primary; light-first + dark toggle |
| Layout | **Bottom inspector** — two equal Source/Output panels + slide-up field-detail strip |

## Current state (what we're replacing)

- `src/web/index.html` — 1,625 lines, 563-line inline `<style>`, vanilla DOM JS, no framework. Mantine-inspired **dark** theme via CSS variables.
- `src/web/browser-entry.ts` — esbuild IIFE exposing `window.camt2coda.{convertForward,convertReverse}`; imports `src/core`. **Keep the conversion exports; the new app imports them directly as ES modules instead of via `window`.**
- `npm run build:web` (esbuild) → `dist-web/`. The `serve` CLI command serves the static bundle; Cloudflare hosts it.

## Architecture

A new app at **`src/web-app/`** (Vite root) that builds to `dist-web/`:

```
src/web-app/
  index.html              Vite entry
  main.tsx                React root + ThemeProvider
  App.tsx                 Top-level state machine (idle → loaded → error)
  lib/
    convert.ts            Thin wrapper over src/core convertForward/convertReverse + anonymize
    fields.ts             Field-link model: map a clicked CAMT/CODA field to its counterpart + spec note
    samples.ts            2–3 bundled sample CAMT/CODA strings
    cn.ts                 shadcn class-merge util
  components/
    ui/                   shadcn components (button, switch, toggle-group, badge, card,
                          tooltip, popover, hover-card, collapsible, sonner, sheet)
    Header.tsx            brand · direction ToggleGroup · Anonymize Switch · theme toggle · Download
    FileBar.tsx           file chip · validation Badge(s) · warnings Popover
    DropZone.tsx          empty state: drag-drop + browse + paste + sample files
    SourcePanel.tsx       renders CAMT (or CODA on reverse) with clickable field spans
    OutputPanel.tsx       renders CODA (or CAMT) with clickable field spans
    Inspector.tsx         bottom slide-up detail: field name, CAMT path+value, CODA rec/pos+value, rule, copy
    ThemeToggle.tsx
  styles/
    globals.css           Tailwind + Warm Ink CSS-variable tokens (light + .dark)
```

- **`vite.config.ts` at the repo root** sets `root: "src/web-app"`, `build.outDir: "../../dist-web"`, `build.emptyOutDir: true`, path alias `@core → src/core`, and uses **Tailwind v4 via `@tailwindcss/vite`**.
- The new app imports `src/core` directly (ESM). The browser already runs the core via the `fs`/`crypto` shims; Vite resolves these via the same `--alias` mechanism in `vite.config.ts` (`fs → web/fs-shim`, `crypto → web/crypto-shim`).
- `src/web/server.ts` keeps serving `dist-web/index.html` (now the Vite build output). No server behavior change.

## Components ↔ shadcn

| Area | shadcn primitives |
|------|-------------------|
| Header | `ToggleGroup` (direction), `Switch` (anonymize), `Button` (download, theme), `Tooltip` |
| File bar | `Badge` (valid/warn), `Popover`/`HoverCard` (warning list) |
| Empty state | `Card` + custom drop target; `Button` for sample files |
| Panels | two `Card`s; custom monospace renderer with clickable `<button>` field spans |
| Inspector | `Card` + `Collapsible`; `Button` (copy) |
| Feedback | `Sonner` (toasts); `Sheet` (inspector on mobile) |
| Theme | provider toggling `.dark` class on `<html>` |

## Data flow

1. User drops/pastes/loads a file (or clicks a sample) → `App` reads text.
2. `lib/convert.ts` calls `convertForward`/`convertReverse` (+ `anonymizeCodaLines` when the toggle is on), returns `{ source, output, validation, warnings, fields }`.
3. `fields.ts` builds a **field-link index**: each renderable field span has an id; clicking one in either panel sets `selectedField`, which the `Inspector` reads to show both sides + the spec rule, and highlights the linked span in the other panel.
4. Direction toggle re-runs conversion on the same input where sensible, else prompts for a matching file type.
5. Download writes the output (CODA `.cod` or CAMT `.xml`) via a Blob; Anonymize applies before download/render.

## UX scope (B) with C-seams

**In scope:** empty/onboarding state with sample files; drag-drop + click + paste; anonymize toggle (wired to the hardened `anonymizeCodaLines`); validation/warnings surfaced (balance reconciliation, unmapped tx-code notes); copy-field + download; keyboard navigation (tab through fields, arrows move selection, `c` copies); light/dark; responsive (panels stack, inspector becomes a `Sheet` on mobile).

**Seams for C (designed, not built):** FileBar accepts a list (batch); Inspector can render a diff column; a `history` module can persist to IndexedDB. None implemented now.

## Theming — Warm Ink tokens

Light (`:root`): `--background #fcfbf9`, `--card #ffffff`, `--muted #f5f3ef`, `--border #e7e2d9`, `--foreground #1c1917`, `--primary #1c1917`, `--primary-foreground #fcfbf9`, `--muted-foreground #78716c`, `--radius 0.6rem`; success `#3f6212`/`#f2f7e9`, warning `#854d0e`/`#fbf3df`. Dark (`.dark`): same structure inverted to warm charcoal (`--background #1c1917`, `--card #232020`, `--foreground #ece9e4`, `--primary #ece9e4`). Fonts: JetBrains Mono for data, system sans for UI.

## Error handling

- Invalid/empty file → inline error state in the panel + `Sonner` toast; never a blank screen.
- Wrong file for the chosen direction (e.g. CODA dropped while CAMT→CODA) → detect and offer to switch direction.
- Conversion throw → caught, message surfaced; core stays pure (no `process.exit`, browser-safe).

## Testing

- **Vitest + React Testing Library** component tests: Header controls, DropZone (drag/paste/sample), panel field-click → Inspector linking, Anonymize toggle changes output, theme toggle, validation badge states.
- One integration test: load a bundled sample CAMT → assert both panels render, inspector shows a mapping, download produces a 128-char-line CODA blob.
- The existing 655 core tests are untouched. `vitest.config` includes `src/web-app/**` tests; the app code is browser/jsdom env.

## Build & scripts

- `package.json`: `dev:app` (`vite`), `build:app` (`vite build` → `dist-web/`), replacing `build:web`. `dev:web` updated to serve the Vite build. Dependencies added: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss` (v4), `@tailwindcss/vite`, shadcn deps (`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`). All dev/runtime-static; no backend deps.
- CI builds the static app; output deploys to Cloudflare as today.

## Out of scope

Backend, accounts, server-side conversion, batch/history/diff implementation (C-tier — seams only), changes to `src/core` conversion logic.
