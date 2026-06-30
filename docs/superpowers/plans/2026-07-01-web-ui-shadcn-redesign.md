# Web UI Redesign (shadcn/ui) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla web UI with a professional shadcn/ui React app (Warm Ink palette, bottom-inspector layout), reusing the existing `src/core` conversion engine, 100% client-side.

**Architecture:** New Vite + React + TS app at `src/web-app/` building to `dist-web/`. Pure-logic libs (`convert`, `fields`, `samples`) are TDD'd with Vitest; presentational components are tested with React Testing Library (jsdom). `src/core/*` is unchanged.

**Tech Stack:** React 18, Vite 6, TypeScript, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (Radix + CVA), lucide-react, sonner, Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-01-web-ui-shadcn-redesign-design.md`

---

## File structure

```
vite.config.ts                      root config (root=src/web-app, outDir=dist-web)
components.json                     shadcn config
src/web-app/
  index.html  main.tsx  App.tsx
  styles/globals.css                Tailwind + Warm Ink tokens (light + .dark)
  lib/{cn,convert,fields,samples,download}.ts
  components/ui/*                    shadcn primitives (button, switch, toggle-group, badge, card, tooltip, popover, collapsible, sonner, sheet)
  components/{Header,FileBar,DropZone,SourcePanel,OutputPanel,Inspector,ThemeToggle}.tsx
  test/setup.ts
```

Test env: a second Vitest project (jsdom) for `src/web-app/**`; existing node tests untouched.

---

## Task 0: Toolchain scaffold (Vite + React + Tailwind v4)

**Files:**
- Create: `vite.config.ts`, `src/web-app/index.html`, `src/web-app/main.tsx`, `src/web-app/App.tsx`, `src/web-app/styles/globals.css`
- Modify: `package.json` (deps + scripts), `tsconfig.json` (jsx, paths)

- [ ] **Step 1: Install deps**

```bash
npm i react react-dom sonner lucide-react class-variance-authority clsx tailwind-merge \
  @radix-ui/react-switch @radix-ui/react-toggle-group @radix-ui/react-tooltip \
  @radix-ui/react-popover @radix-ui/react-collapsible @radix-ui/react-slot @radix-ui/react-dialog
npm i -D vite @vitejs/plugin-react @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";

export default defineConfig({
  root: "src/web-app",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/web-app", import.meta.url)),
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      // reuse the existing browser shims for the in-browser core
      fs: fileURLToPath(new URL("./src/web/fs-shim.ts", import.meta.url)),
      crypto: fileURLToPath(new URL("./src/web/crypto-shim.ts", import.meta.url)),
    },
  },
  build: { outDir: "../../dist-web", emptyOutDir: true },
});
```

- [ ] **Step 3: `src/web-app/index.html`**

```html
<!doctype html>
<html lang="en" class="">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>camt2coda — field inspector</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: `src/web-app/styles/globals.css`** (Warm Ink tokens)

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

:root {
  --background: #fcfbf9; --foreground: #1c1917;
  --card: #ffffff; --card-foreground: #1c1917;
  --muted: #f5f3ef; --muted-foreground: #78716c;
  --border: #e7e2d9; --input: #e7e2d9; --ring: #1c1917;
  --primary: #1c1917; --primary-foreground: #fcfbf9;
  --accent: #f0ece5; --accent-foreground: #44403c;
  --success: #3f6212; --success-bg: #f2f7e9;
  --warning: #854d0e; --warning-bg: #fbf3df;
  --destructive: #b91c1c; --radius: 0.6rem;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
.dark {
  --background: #1c1917; --foreground: #ece9e4;
  --card: #232020; --card-foreground: #ece9e4;
  --muted: #2a2624; --muted-foreground: #a8a29e;
  --border: #34302c; --input: #34302c; --ring: #ece9e4;
  --primary: #ece9e4; --primary-foreground: #1c1917;
  --accent: #2a2624; --accent-foreground: #d6d3d1;
  --success: #a3c585; --success-bg: #20251a;
  --warning: #e0b66b; --warning-bg: #29220f;
}
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border); --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --radius-lg: var(--radius);
}
* { border-color: var(--border); }
body { background: var(--background); color: var(--foreground); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
```

- [ ] **Step 5: `src/web-app/main.tsx` + minimal `App.tsx`**

```tsx
// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```
```tsx
// App.tsx
export default function App() {
  return <div className="min-h-screen grid place-items-center text-foreground">camt2coda</div>;
}
```

- [ ] **Step 6: `tsconfig.json`** — add `"jsx": "react-jsx"`, `"lib": ["ES2022","DOM","DOM.Iterable"]`, and `"paths": { "@/*": ["src/web-app/*"], "@core/*": ["src/core/*"] }`. Keep `noEmit`.

- [ ] **Step 7: `package.json` scripts** — add:
```json
"dev:app": "vite",
"build:app": "vite build",
```
Replace the old `"build:web"` esbuild line with `"build:web": "vite build"`. Keep `"dev:web": "npm run build:app && npx -y serve dist-web"`.

- [ ] **Step 8: Verify + commit**

Run: `npm run build:app`
Expected: builds to `dist-web/` with no errors.
```bash
git add -A && git commit -m "build: scaffold Vite+React+Tailwind v4 web app (Warm Ink tokens)"
```

---

## Task 1: shadcn primitives + cn util

**Files:**
- Create: `src/web-app/lib/cn.ts`, `components.json`, `src/web-app/components/ui/*`

- [ ] **Step 1: `src/web-app/lib/cn.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

- [ ] **Step 2: `components.json`** (so the shadcn CLI drops files in the right place)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york", "rsc": false, "tsx": true,
  "tailwind": { "config": "", "css": "src/web-app/styles/globals.css", "baseColor": "stone", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/cn", "ui": "@/components/ui" }
}
```

- [ ] **Step 3: Add primitives via CLI**

```bash
npx shadcn@latest add button switch toggle-group badge card tooltip popover collapsible sonner sheet --yes
```
Expected: files created under `src/web-app/components/ui/`. If the CLI cannot run non-interactively, copy the component source from https://ui.shadcn.com/docs/components for each.

- [ ] **Step 4: Smoke test render**

Create `src/web-app/test/setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```
Add to `vitest.config.ts` a jsdom project for `src/web-app/**` (see Task 2 Step 1). Then:
```bash
npm run build:app
```
Expected: still builds (the primitives compile).

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(web): add shadcn ui primitives + cn util"
```

---

## Task 2: Conversion + field-link + samples libs (pure logic, TDD)

**Files:**
- Create: `src/web-app/lib/convert.ts`, `src/web-app/lib/fields.ts`, `src/web-app/lib/samples.ts`, `src/web-app/lib/download.ts`
- Test: `src/web-app/lib/convert.test.ts`, `src/web-app/lib/fields.test.ts`
- Modify: `vitest.config.ts` (add jsdom project for web-app)

- [ ] **Step 1: `vitest.config.ts`** — make it multi-project so node tests stay node and web-app tests run in jsdom:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { test: { name: "node", include: ["test/**/*.test.ts"], environment: "node" } },
      { test: { name: "web", include: ["src/web-app/**/*.test.{ts,tsx}"], environment: "jsdom", setupFiles: ["src/web-app/test/setup.ts"] } },
    ],
    coverage: {
      provider: "v8", include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/cli.ts","src/web/browser-entry.ts","src/web/fs-shim.ts","src/web/crypto-shim.ts","src/core/model.ts","src/storage/s3-storage.ts","src/web-app/components/ui/**","src/web-app/main.tsx"],
      thresholds: { lines: 90, branches: 80 },
    },
  },
});
```

- [ ] **Step 2: Write failing test `src/web-app/lib/convert.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { convert, type ConvertResult } from "./convert";

const SAMPLE_CAMT = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr>
<Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

describe("convert", () => {
  it("forward CAMT->CODA returns source, output lines and validation", () => {
    const r: ConvertResult = convert(SAMPLE_CAMT, "camt-to-coda", false);
    expect(r.direction).toBe("camt-to-coda");
    expect(r.outputText.split("\n").every((l) => l.length === 128 || l.length === 0)).toBe(true);
    expect(r.validation.valid).toBe(true);
  });
  it("anonymize=true scrubs the holder name from the output", () => {
    const r = convert(SAMPLE_CAMT, "camt-to-coda", true);
    expect(r.outputText).not.toContain("BE68539007547034");
  });
  it("invalid input yields an error result, not a throw", () => {
    const r = convert("not xml", "camt-to-coda", false);
    expect(r.error).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run → FAIL.** Run: `npx vitest run src/web-app/lib/convert.test.ts`

- [ ] **Step 4: Implement `src/web-app/lib/convert.ts`**

```typescript
import { convertForward, convertReverse } from "@core/../web/browser-entry";
import { anonymizeCodaLines } from "@core/../anonymize/anonymizer";
import type { CodaLine } from "@core/field-defs/types";

export type Direction = "camt-to-coda" | "coda-to-camt";

export interface ConvertResult {
  direction: Direction;
  sourceText: string;
  outputText: string;
  codaLines: CodaLine[];          // CODA side (output for forward, input for reverse)
  fileName: string;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  error?: string;
}

export function convert(input: string, direction: Direction, anonymize: boolean): ConvertResult {
  try {
    if (direction === "camt-to-coda") {
      const r = convertForward(input);
      const file = r.files[0];
      const lines = anonymize ? anonymizeCodaLines(file.lines) : file.lines.map((l) => l.raw);
      return {
        direction, sourceText: input, outputText: lines.join("\n"),
        codaLines: file.lines, fileName: file.fileName, validation: file.validation,
      };
    }
    const r = convertReverse(input);
    return {
      direction, sourceText: input, outputText: r.xml, codaLines: r.lines,
      fileName: "statement.xml",
      validation: { valid: r.validation.valid, errors: r.validation.errors, warnings: r.warnings },
    };
  } catch (err) {
    return {
      direction, sourceText: input, outputText: "", codaLines: [], fileName: "",
      validation: { valid: false, errors: [(err as Error).message], warnings: [] },
      error: (err as Error).message,
    };
  }
}
```

- [ ] **Step 5: Run → PASS.** Run: `npx vitest run src/web-app/lib/convert.test.ts`

- [ ] **Step 6: Write failing test `src/web-app/lib/fields.test.ts`** for the field-link index. A CODA line's `fields` already carry `name/start/length/value/sourceXPath/description`. `buildFieldIndex` flattens them into selectable entries keyed by `recordType:name`.

```typescript
import { describe, it, expect } from "vitest";
import { convert } from "./convert";
import { buildFieldIndex } from "./fields";

const CAMT = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr>
<Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

describe("buildFieldIndex", () => {
  it("creates an entry per non-blank CODA field with positions and xpath", () => {
    const r = convert(CAMT, "camt-to-coda", false);
    const idx = buildFieldIndex(r.codaLines);
    const acct = idx.find((f) => f.name === "accountNumber");
    expect(acct).toBeDefined();
    expect(acct!.codaPos).toBe("5-38");
    expect(acct!.value).toContain("BE68539007547034");
    expect(acct!.id).toMatch(/^1:accountNumber/);
  });
});
```

- [ ] **Step 7: Run → FAIL, then implement `src/web-app/lib/fields.ts`**

```typescript
import type { CodaLine } from "@core/field-defs/types";

export interface FieldEntry {
  id: string;           // `${recordType}:${name}:${lineIndex}`
  recordType: string;
  name: string;
  value: string;
  codaPos: string;      // "start-end" (1-indexed)
  sourceXPath?: string;
  description?: string;
  lineIndex: number;
}

export function buildFieldIndex(lines: CodaLine[]): FieldEntry[] {
  const out: FieldEntry[] = [];
  lines.forEach((line, lineIndex) => {
    for (const f of line.fields) {
      if (!f.value.trim()) continue;
      out.push({
        id: `${line.recordType}:${f.name}:${lineIndex}`,
        recordType: line.recordType, name: f.name, value: f.value.trim(),
        codaPos: `${f.start + 1}-${f.start + f.length}`,
        sourceXPath: f.sourceXPath, description: f.description, lineIndex,
      });
    }
  });
  return out;
}
```

- [ ] **Step 8: Run → PASS.**

- [ ] **Step 9: Implement `src/web-app/lib/samples.ts` and `download.ts`** (no test needed — trivial data/DOM):

```typescript
// samples.ts — small inline fixtures so the empty state has one-click demos
export const SAMPLES: { label: string; direction: "camt-to-coda" | "coda-to-camt"; content: string }[] = [
  { label: "CAMT 053 · SEPA credit transfer", direction: "camt-to-coda", content: `<?xml version="1.0"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">...</Document>` },
];
```
```typescript
// download.ts
export function downloadText(name: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
```
Replace the `samples.ts` `...` with a real minimal CAMT (copy the one from `convert.test.ts`).

- [ ] **Step 10: Run full web suite + commit**

Run: `npx vitest run --project web`
Expected: PASS.
```bash
git add -A && git commit -m "feat(web): convert/fields/samples/download libs (TDD)"
```

---

## Task 3: App state + Header

**Files:**
- Modify: `src/web-app/App.tsx`
- Create: `src/web-app/components/Header.tsx`, `src/web-app/components/ThemeToggle.tsx`
- Test: `src/web-app/components/Header.test.tsx`

- [ ] **Step 1: Failing test `Header.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";

describe("Header", () => {
  it("renders direction toggle and fires onDirectionChange", async () => {
    const onDir = vi.fn();
    render(<Header direction="camt-to-coda" onDirectionChange={onDir} anonymize={false} onAnonymizeChange={() => {}} onDownload={() => {}} canDownload />);
    await userEvent.click(screen.getByRole("radio", { name: /CODA → CAMT/i }));
    expect(onDir).toHaveBeenCalledWith("coda-to-camt");
  });
  it("disables download when canDownload is false", () => {
    render(<Header direction="camt-to-coda" onDirectionChange={() => {}} anonymize={false} onAnonymizeChange={() => {}} onDownload={() => {}} canDownload={false} />);
    expect(screen.getByRole("button", { name: /download/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run → FAIL. Implement `ThemeToggle.tsx` then `Header.tsx`**

```tsx
// ThemeToggle.tsx
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return (
    <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={() => setDark((d) => !d)}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```
```tsx
// Header.tsx
import { Download } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import type { Direction } from "@/lib/convert";

export function Header(props: {
  direction: Direction; onDirectionChange: (d: Direction) => void;
  anonymize: boolean; onAnonymizeChange: (v: boolean) => void;
  onDownload: () => void; canDownload: boolean;
}) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b">
      <span className="font-bold tracking-tight">camt2coda <span className="text-muted-foreground text-xs font-medium">field inspector</span></span>
      <ToggleGroup type="single" value={props.direction} onValueChange={(v) => v && props.onDirectionChange(v as Direction)}>
        <ToggleGroupItem value="camt-to-coda">CAMT → CODA</ToggleGroupItem>
        <ToggleGroupItem value="coda-to-camt">CODA → CAMT</ToggleGroupItem>
      </ToggleGroup>
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={props.anonymize} onCheckedChange={props.onAnonymizeChange} /> Anonymize
        </label>
        <ThemeToggle />
        <Button onClick={props.onDownload} disabled={!props.canDownload}><Download className="size-4" /> Download</Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Run → PASS.**

- [ ] **Step 4: Wire `App.tsx`** to hold `{ input, direction, anonymize, result, selectedFieldId }`, recompute `result = convert(input, direction, anonymize)` via `useMemo`, and render `<Header>` + (DropZone when no input, else FileBar + panels + Inspector — added in later tasks). For now render Header + a placeholder.

```tsx
import { useMemo, useState } from "react";
import { Header } from "./components/Header";
import { convert, type Direction } from "./lib/convert";
import { downloadText } from "./lib/download";

export default function App() {
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<Direction>("camt-to-coda");
  const [anonymize, setAnonymize] = useState(false);
  const result = useMemo(() => (input ? convert(input, direction, anonymize) : null), [input, direction, anonymize]);
  return (
    <div className="min-h-screen flex flex-col">
      <Header direction={direction} onDirectionChange={setDirection}
        anonymize={anonymize} onAnonymizeChange={setAnonymize}
        canDownload={!!result && !result.error}
        onDownload={() => result && downloadText(result.fileName, result.outputText, direction === "camt-to-coda" ? "text/plain" : "application/xml")} />
      <main className="flex-1">{/* DropZone / panels added next */}</main>
    </div>
  );
}
```

- [ ] **Step 5: Run web suite + build + commit**

Run: `npx vitest run --project web && npm run build:app`
```bash
git add -A && git commit -m "feat(web): App state machine + Header (direction, anonymize, theme, download)"
```

---

## Task 4: DropZone / empty state

**Files:**
- Create: `src/web-app/components/DropZone.tsx`
- Test: `src/web-app/components/DropZone.test.tsx`
- Modify: `src/web-app/App.tsx`

- [ ] **Step 1: Failing test** — pasting/typing content calls `onLoad`, and a sample button calls `onLoad` with sample content + sets direction.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropZone } from "./DropZone";

it("loads a sample on click", async () => {
  const onLoad = vi.fn();
  render(<DropZone onLoad={onLoad} />);
  await userEvent.click(screen.getAllByRole("button", { name: /sample/i })[0]);
  expect(onLoad).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run → FAIL. Implement `DropZone.tsx`** — a `Card` with: drag-and-drop (`onDrop` reads `file.text()`), a hidden `<input type="file">` triggered by a Browse button, a textarea-paste affordance, and a row of `SAMPLES` buttons. `onLoad(content, direction)`.

```tsx
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SAMPLES } from "@/lib/samples";
import type { Direction } from "@/lib/convert";

export function DropZone({ onLoad }: { onLoad: (content: string, direction?: Direction) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  async function fromFile(file?: File | null) { if (file) onLoad(await file.text()); }
  return (
    <div className="grid place-items-center min-h-[60vh] p-6">
      <Card
        className={`w-full max-w-xl p-10 text-center border-dashed transition-colors ${over ? "border-primary bg-accent" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); fromFile(e.dataTransfer.files[0]); }}
      >
        <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Drop a CAMT XML or CODA file</p>
        <p className="text-sm text-muted-foreground mb-4">or paste it, or browse</p>
        <input ref={fileRef} type="file" hidden onChange={(e) => fromFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>Browse…</Button>
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {SAMPLES.map((s) => (
            <Button key={s.label} variant="ghost" size="sm" onClick={() => onLoad(s.content, s.direction)}>
              Sample: {s.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run → PASS.** Wire into `App.tsx`: when `!input`, render `<DropZone onLoad={(c, d) => { setInput(c); if (d) setDirection(d); }} />`; also add a global `onPaste` on the main element that sets input.

- [ ] **Step 4: Build + commit**
```bash
git add -A && git commit -m "feat(web): empty state DropZone (drag/browse/paste/samples)"
```

---

## Task 5: Source/Output panels with clickable fields

**Files:**
- Create: `src/web-app/components/SourcePanel.tsx`, `src/web-app/components/OutputPanel.tsx`
- Test: `src/web-app/components/OutputPanel.test.tsx`
- Modify: `src/web-app/App.tsx`

- [ ] **Step 1: Failing test** — OutputPanel renders one clickable element per field and fires `onSelect(id)`.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { convert } from "@/lib/convert";
import { buildFieldIndex } from "@/lib/fields";
import { OutputPanel } from "./OutputPanel";

const CAMT = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr><Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct><Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal><Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal></Stmt></BkToCstmrStmt></Document>`;

it("clicking a field fires onSelect with its id", async () => {
  const r = convert(CAMT, "camt-to-coda", false);
  const idx = buildFieldIndex(r.codaLines);
  const onSelect = vi.fn();
  render(<OutputPanel lines={r.codaLines} index={idx} selectedId={null} onSelect={onSelect} />);
  await userEvent.click(screen.getAllByRole("button")[1]); // a field button
  expect(onSelect).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run → FAIL. Implement `OutputPanel.tsx`** — renders each CODA line; within a line, splits into field `<button>`s (using each field's `start/length`), highlighting the one whose `id === selectedId`. `SourcePanel.tsx` renders `sourceText` in a `<pre>` (XML side has no fixed offsets; it stays read-only text with the selected field's value highlighted via string match).

```tsx
// OutputPanel.tsx
import { Card } from "@/components/ui/card";
import type { CodaLine } from "@core/field-defs/types";
import type { FieldEntry } from "@/lib/fields";

export function OutputPanel({ lines, index, selectedId, onSelect }: {
  lines: CodaLine[]; index: FieldEntry[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <Card className="flex-1 overflow-auto">
      <div className="px-3 py-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground">Output · CODA</div>
      <pre className="p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, li) => (
          <div key={li}>
            {line.fields.map((f) => {
              const id = `${line.recordType}:${f.name}:${li}`;
              const isSel = id === selectedId;
              const known = index.some((e) => e.id === id);
              return known ? (
                <button key={f.name} onClick={() => onSelect(id)}
                  className={`rounded-sm ${isSel ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{f.value}</button>
              ) : <span key={f.name}>{f.value}</span>;
            })}
          </div>
        ))}
      </pre>
    </Card>
  );
}
```
```tsx
// SourcePanel.tsx — read-only source with the selected value highlighted
import { Card } from "@/components/ui/card";
export function SourcePanel({ text, highlight }: { text: string; highlight?: string }) {
  const parts = highlight ? text.split(highlight) : [text];
  return (
    <Card className="flex-1 overflow-auto">
      <div className="px-3 py-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground">Source</div>
      <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {parts.flatMap((p, i) => i === 0 ? [p] : [<mark key={i} className="bg-primary text-primary-foreground rounded-sm px-0.5">{highlight}</mark>, p])}
      </pre>
    </Card>
  );
}
```

- [ ] **Step 3: Run → PASS.** Wire into `App.tsx`: when `result && !result.error`, render a flex row of `<SourcePanel text={result.sourceText} highlight={selectedField?.value} />` and `<OutputPanel ... selectedId={selectedFieldId} onSelect={setSelectedFieldId} />`. Compute `index = useMemo(() => buildFieldIndex(result.codaLines), [result])` and `selectedField = index.find((f) => f.id === selectedFieldId)`.

- [ ] **Step 4: Build + commit**
```bash
git add -A && git commit -m "feat(web): Source/Output panels with clickable linked fields"
```

---

## Task 6: Bottom Inspector

**Files:**
- Create: `src/web-app/components/Inspector.tsx`
- Test: `src/web-app/components/Inspector.test.tsx`
- Modify: `src/web-app/App.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inspector } from "./Inspector";

it("shows the selected field's CODA position and xpath", () => {
  render(<Inspector field={{ id: "1:accountNumber:1", recordType: "1", name: "accountNumber", value: "BE68539007547034", codaPos: "5-38", sourceXPath: "Acct/Id/IBAN", description: "Account number (IBAN)", lineIndex: 1 }} />);
  expect(screen.getByText(/5-38/)).toBeInTheDocument();
  expect(screen.getByText(/Acct\/Id\/IBAN/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run → FAIL. Implement `Inspector.tsx`** — a bottom strip showing field name, CAMT path + value, CODA record/pos + value, the description (spec rule), and a copy button. Renders nothing when `field` is null.

```tsx
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FieldEntry } from "@/lib/fields";

export function Inspector({ field }: { field: FieldEntry | null }) {
  if (!field) return null;
  return (
    <div className="border-t bg-muted/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Field mapping</div>
      <div className="flex items-center gap-2"><span className="font-bold text-base">{field.name}</span>
        <Button variant="ghost" size="icon" aria-label="Copy value" onClick={() => navigator.clipboard?.writeText(field.value)}><Copy className="size-3.5" /></Button>
      </div>
      <div className="flex gap-8 mt-1 text-sm">
        <div><div className="text-[10px] uppercase text-muted-foreground">CAMT</div><div className="font-mono">{field.sourceXPath ?? "—"}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">CODA</div><div className="font-mono">Record {field.recordType} · pos {field.codaPos}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Value</div><div className="font-mono">{field.value}</div></div>
        {field.description && <div className="ml-auto self-center text-xs text-muted-foreground max-w-xs">{field.description}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run → PASS.** Wire `<Inspector field={selectedField ?? null} />` at the bottom of `App.tsx`'s loaded view.

- [ ] **Step 4: Build + commit**
```bash
git add -A && git commit -m "feat(web): bottom field-mapping Inspector"
```

---

## Task 7: FileBar (validation + warnings)

**Files:**
- Create: `src/web-app/components/FileBar.tsx`
- Test: `src/web-app/components/FileBar.test.tsx`
- Modify: `src/web-app/App.tsx`

- [ ] **Step 1: Failing test** — shows a "Valid" badge when valid, and a warnings count when warnings exist.

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileBar } from "./FileBar";

it("shows valid badge and warning count", () => {
  render(<FileBar fileName="x.cod" recordCount={13} validation={{ valid: true, errors: [], warnings: ["w1"] }} onClear={() => {}} />);
  expect(screen.getByText(/valid/i)).toBeInTheDocument();
  expect(screen.getByText(/1 note/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run → FAIL. Implement `FileBar.tsx`** — file chip + record count, a `Badge` (valid → success, has-errors → destructive), a warnings `Popover` listing notes, and an "X" to clear/load another file.

```tsx
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FileBar({ fileName, recordCount, validation, onClear }: {
  fileName: string; recordCount: number;
  validation: { valid: boolean; errors: string[]; warnings: string[] }; onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-sm">
      <span className="font-mono text-xs px-2 py-1 rounded-md border bg-card">{fileName} · {recordCount} records</span>
      <Badge variant={validation.valid ? "secondary" : "destructive"}>{validation.valid ? "✓ Valid" : `✕ ${validation.errors.length} error(s)`}</Badge>
      {validation.warnings.length > 0 && (
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm">⚠ {validation.warnings.length} note{validation.warnings.length > 1 ? "s" : ""}</Button></PopoverTrigger>
          <PopoverContent className="text-sm"><ul className="list-disc pl-4">{validation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></PopoverContent>
        </Popover>
      )}
      <Button variant="ghost" size="icon" className="ml-auto" aria-label="Clear" onClick={onClear}><X className="size-4" /></Button>
    </div>
  );
}
```

- [ ] **Step 3: Run → PASS.** Wire into `App.tsx` above the panels (when `result`). `onClear` resets `input` to "".

- [ ] **Step 4: Build + commit**
```bash
git add -A && git commit -m "feat(web): FileBar with validation badge + warnings popover"
```

---

## Task 8: Responsive + Sonner + integration test

**Files:**
- Modify: `src/web-app/App.tsx` (Sonner `<Toaster />`, error toast, mobile: panels stack, Inspector in a `Sheet`)
- Test: `src/web-app/App.test.tsx`

- [ ] **Step 1: Failing integration test** — load a sample CAMT, assert both panels render and clicking a field shows the inspector; toggling anonymize changes the output.

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

it("loads a sample and inspects a field end to end", async () => {
  render(<App />);
  await userEvent.click(screen.getAllByRole("button", { name: /sample/i })[0]);
  expect(screen.getByText(/Output · CODA/i)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button").find((b) => /BE\d/.test(b.textContent || ""))!);
  expect(screen.getByText(/Field mapping/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run → FAIL. Implement** the App wiring (mount `<Toaster />`, fire `toast.error` when `result.error`, add `flex-col md:flex-row` to the panel row, and on `max-md` render the Inspector inside a shadcn `Sheet` triggered by selection). Show the error state in-panel.

- [ ] **Step 3: Run → PASS.** Run: `npx vitest run --project web`

- [ ] **Step 4: Build + commit**
```bash
git add -A && git commit -m "feat(web): responsive layout, toasts, end-to-end integration test"
```

---

## Task 9: Cut over the build, remove the old vanilla UI

**Files:**
- Delete: `src/web/index.html`, `src/web/browser-entry.ts`'s `window` assignment (keep the exported functions — `convert.ts` imports them).
- Modify: `src/web/server.ts` (still serves `dist-web/index.html` — verify path), `.github/workflows/*` (build step uses `build:app`), `README.md` + `docs/architecture.md` (web UI section).

- [ ] **Step 1: Point the server at the Vite output** — confirm `findIndexHtml()` in `src/web/server.ts` resolves `dist-web/index.html`. Update the fallback path if needed. Run the server test:
```bash
npm run build:app && npx vitest run test/integration/server.test.ts
```
Expected: PASS (server still serves the built index.html). If the test asserted `<!DOCTYPE html>` + "camt2coda", both still hold.

- [ ] **Step 2: Remove the old vanilla UI**
```bash
git rm src/web/index.html
```
Keep `browser-entry.ts` exports; delete only the trailing `(window as any).camt2coda = ...` line (no longer needed).

- [ ] **Step 3: Update CI + docs** — in the GitHub Actions web build, replace any `build:web` esbuild invocation (already aliased to `vite build`); update README "Web UI" section and `docs/architecture.md` web module map to describe the React app.

- [ ] **Step 4: Full verification**
```bash
npm run typecheck && npx vitest run && npm run build:app
```
Expected: all node + web tests pass; static build emitted to `dist-web/`.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "build(web): cut over to the shadcn app, remove vanilla UI"
```

---

## Self-review notes
- **Spec coverage:** architecture (T0), components/shadcn (T1,3-7), convert/fields/samples (T2), data flow + field-link (T2,5,6), UX empty-state/anonymize/validation (T4,6,7), theming Warm Ink (T0), error handling + responsive (T8), testing (each task), build/scripts + cutover (T0,9). C-seams are structural (FileBar list-ready, Inspector layout) — no extra task.
- **Browser-only:** no backend introduced; `convert.ts` runs the core via the existing fs/crypto shims aliased in `vite.config.ts`.
- **Types:** `Direction`, `ConvertResult`, `FieldEntry` defined in T2 and used consistently in T3–T8.
- **Coverage:** `components/ui/**` (shadcn vendored) and `main.tsx` excluded; the rest of `web-app` is exercised by component + integration tests.
