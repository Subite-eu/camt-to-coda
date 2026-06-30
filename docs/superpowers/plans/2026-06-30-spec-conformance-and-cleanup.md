# Spec-Conformance & Lean-Codebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CAMT↔CODA conversion provably conform to the FEBELFIN CODA 2.6, Belgian CAMT053 and AOS1 specifications, and reduce the repository to a lean, dead-code-free codebase.

**Architecture:** Two independent workstreams. **Workstream B** (cleanup) is mechanical/low-risk and runs first to give a clean tree. **Workstream A** (spec conformance) audits every CODA field against the in-repo FEBELFIN PDFs, produces a mapping matrix + golden suite, then fixes each defect TDD-style.

**Tech Stack:** TypeScript (ESM, Node 22+), Vitest + fast-check, fast-xml-parser. Specs in `specifications/` (CODA 2.6, Belgian CAMT053 v2.1, AOS1 OGM-VCS, ISO MDR, XSDs). Reference pair in `specifications/private-examples/`.

**Authorities (cite in commit messages):**
- `specifications/CODA/standard-coda-2.6-en.pdf` — CODA record layouts (Annexe I pp.14–28), transaction codes (Annex II pp.29–60), structured comms (Annex III pp.61–73).
- `specifications/CAMT/standard-camt053-statement-v2.1_0.pdf` — Belgian CAMT053 element list (§2.x).
- `specifications/CAMT/aos.pdf` — AOS1 OGM-VCS: `CdtrRefInf/Tp(SCOR)/Issr(BBA)/Ref`, mod-97 check digit (0→97).
- `specifications/private-examples/coda_BE21737051687303_EUR_2026_03_16_44_44.{cod,xml}` — real reference pair.

**Confirmed spec facts already gathered:**
- Amount field = **15 chars = 12 integer + 3 decimal** (CODA 2.6 Annexe I, Rec 1 pos 44–58; Rec 2.1 pos 33–47). Money scale is thousandths (×1000), NOT cents.
- Transaction code = 8 chars = type(1)+family(2)+transaction(2)+category(3) (CODA 2.6 §3).
- Record 1: pos 3–5 = paper-statement sequence *or zeros*; pos 126–128 = CODA file sequence (001+ per year).
- Comm zones: Rec 2.1 pos 63–115 (53), Rec 2.2 pos 11–63 (53), Rec 2.3 pos 83–125 (43) = 149 total.
- Structured comm: Rec 2.1 pos 62 = "1", type in pos 63–65, reference from pos 66 (Annex III).

---

## Workstream B — Lean codebase (do first; low risk)

### Task B1: Remove stale local cruft

**Files:**
- Delete (untracked, local-only): `java/`, `go/`, `ts/` directories; `dist/cli 2.js`, `dist/cli.js 2.map`, `dist/cli.d 2.ts`.
- Delete (tracked): `test/unit 3/holidays.test.ts` (sync-duplicate of `test/unit/holidays.test.ts`, different/older content, not referenced).

- [ ] **Step 1: Confirm the duplicate test dir is not referenced**

Run: `grep -rn "unit 3" --include='*.ts' --include='*.json' . | grep -v node_modules`
Expected: no references (vitest globs `test/**/*.test.ts`, so the file is *picked up* but is a stale dup — verify its tests also exist in the canonical files before deleting).

- [ ] **Step 2: Diff the duplicate against the canonical holiday tests**

Run: `diff "test/unit 3/holidays.test.ts" test/unit/holidays.test.ts; ls test/unit/holidays.test.ts "test/unit 3/holidays.test.ts"`
Decide: keep whichever is the superset (the 149-line `test/unit 3` version may have MORE cases than the 54-line canonical one — if so, MERGE its unique cases into `test/unit/holidays.test.ts` first, do NOT just delete).

- [ ] **Step 3: Remove untracked cruft and the resolved duplicate**

```bash
rm -rf java go ts "dist/cli 2.js" "dist/cli.js 2.map" "dist/cli.d 2.ts"
git rm "test/unit 3/holidays.test.ts"
```

- [ ] **Step 4: Add a guard so sync artifacts don't return**

Append to `.gitignore`:
```
# macOS/sync duplication artifacts
* [0-9].*
**/* [0-9].*
```

- [ ] **Step 5: Verify tests still pass and commit**

Run: `npm test`
Expected: PASS (same count minus any merged duplicates).
```bash
git add -A && git commit -m "chore: remove stale java/go/ts dirs and sync-duplicate files"
```

### Task B2: Fix stale documentation

**Files:**
- Modify: `CLAUDE.md` (untracked, local) — rewrite to describe the TypeScript project.
- Modify/Delete: `docs/architecture.md` (tracked) — references non-existent files (`parser.ts`, `converter.ts`, `record3.ts`, `calculator.ts`, `preflight.ts`, `fs.ts`, `s3.ts`, `generators.ts`).

- [ ] **Step 1: Rewrite `CLAUDE.md`** to reflect: TS/ESM converter, `src/` layout, `npm test`/`npm run build`/`dev`, both conversion directions, web UI, FS+S3 storage. Remove all Java/Maven/Go/XSLT content.

- [ ] **Step 2: Correct `docs/architecture.md`** module map to the real files: `camt-parser.ts`, `coda-writer.ts`, `coda-parser.ts`, `coda-to-statement.ts`, `camt-writer.ts`, `reverse.ts`, `records/record{0,1,21,22,23,31,32,33,8,9}.ts`, `holidays/{holidays,eea,...}.ts`, `validation/{camt,coda}-validator.ts`, `storage/{fs,s3}-storage.ts`, `web/{server,browser-entry}.ts`. Fix the "Testing Strategy" section (golden suite does not yet exist — say "planned").

- [ ] **Step 3: Commit**
```bash
git add docs/architecture.md && git commit -m "docs: align architecture.md with the TypeScript implementation"
```

### Task B3: Eliminate holiday dead code (single source of truth)

**Files:**
- Delete: `src/holidays/belgium.ts`, `src/holidays/netherlands.ts`, `src/holidays/lithuania.ts` (never imported by `workingDaysFromJan1`; `eea.ts` re-implements their logic, e.g. its own `dutchKingDay`).
- Verify: `src/holidays/holidays.ts` imports only `getEeaHolidays` from `eea.ts`.

- [ ] **Step 1: Confirm the three files are unreferenced**

Run: `grep -rn "belgium\|netherlands\|lithuania" src --include='*.ts'`
Expected: only self-references / no import from `holidays.ts` or `coda-writer.ts`.

- [ ] **Step 2: Delete the dead files**
```bash
git rm src/holidays/belgium.ts src/holidays/netherlands.ts src/holidays/lithuania.ts
```

- [ ] **Step 3: Typecheck + test**

Run: `npm run typecheck && npm test`
Expected: PASS (nothing imported them).

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "refactor: remove dead per-country holiday files; eea.ts is the single source"
```

### Task B4: Dead-export sweep

- [ ] **Step 1: Run a static dead-code check**

Run: `npx -y knip --no-exit-code` (or `npx -y ts-prune`)
Expected: a list of unused exports/files.

- [ ] **Step 2: Remove genuinely-unused exports** (keep public API surface of `cli.ts`, `web/`, and re-exports used by tests). For each removal: `npm run typecheck && npm test` must stay green.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "refactor: prune unused exports flagged by knip"
```

### Task B5: Branch & worktree hygiene (verify-then-delete; never blind `-D`)

- [ ] **Step 1: Sync**
```bash
git fetch --prune
git switch main && git pull   # main is behind origin by 2
```

- [ ] **Step 2: Delete provably-merged branches**
```bash
git branch --merged main   # expect: fix/nvd-api-key, fix/release-workflow
git branch -d fix/nvd-api-key fix/release-workflow
```

- [ ] **Step 3: Verify likely squash-merged branches before deleting**

For each of `ts-rewrite`, `eea-holidays-and-ui-fixes`, `claude/web-ui-reverse`, `fix/fast-xml-parser-vulnerability`:
```bash
git log --oneline main..<branch>      # commits not in main
git cherry -v main <branch>           # '+' = content not in main, '-' = already present
```
Delete with `git branch -D <branch>` ONLY if all commits show `-` (content already on main via squash). Otherwise report and leave.

- [ ] **Step 4: Inspect the stash**
```bash
git stash show -p stash@{0}            # "WIP on main: Record 4, reverseMap bug"
git log --oneline --all | grep -i "Record 4"   # cf. 3e60b58
```
Drop only if redundant: `git stash drop stash@{0}`.

- [ ] **Step 5: Decide the fate of `fix/spec-alignment-camt-coda`** (current branch, 10 commits, no upstream) — this carries the spec work; it will be the PR for Workstream A. Leave intact.

### Task B6: Re-enable coverage honesty

**Files:**
- Modify: `vitest.config.ts:9` (coverage `exclude` list drops `cli.ts`, `web/**`, `model.ts`, `s3-storage.ts`).

- [ ] **Step 1:** Remove `src/cli.ts`, `src/web/**`, `src/storage/s3-storage.ts` from the coverage exclude list (keep `model.ts` if it is pure types).

- [ ] **Step 2:** Run `npm run test:coverage`. Record the new (lower) numbers; do NOT lower thresholds. Add targeted tests in later tasks if a real gap is exposed.

- [ ] **Step 3: Commit**
```bash
git add vitest.config.ts && git commit -m "test: stop excluding cli/web/s3 from coverage"
```

---

## Workstream A — CAMT↔CODA spec conformance

### Task A1: Build the field-level mapping matrix (research deliverable)

**Files:**
- Create: `docs/mapping-matrix.md`

- [ ] **Step 1: Read the layouts.** Read CODA 2.6 Annexe I (records 0/1/2.1/2.2/2.3/3.1/3.2/3.3/8/9) and the Belgian CAMT053 guideline §2.x. For each CODA field capture: positions, length, type, content rule.

- [ ] **Step 2: Cross-check `src/core/field-defs/record*-fields.ts`** against the spec positions. Any mismatch is a row flagged `❌`.

- [ ] **Step 3: Write `docs/mapping-matrix.md`** — one row per CODA field: `Record | Pos | Len | CODA meaning | CAMT path (camt053 §) | forward behaviour | reverse behaviour | verdict (✅/⚠️/❌/⛔)`. Verdicts drive Tasks A4+.

- [ ] **Step 4: Commit**
```bash
git add docs/mapping-matrix.md && git commit -m "docs: add field-level CAMT<->CODA mapping matrix vs FEBELFIN specs"
```

### Task A2: Money as 3-decimal fixed-point (eliminates float drift)

**Files:**
- Create: `src/core/money.ts`
- Test: `test/unit/money.test.ts`
- Modify: `src/core/formatting.ts` (`formatBalance`), `src/core/coda-writer.ts:59-60` (sum accumulation), `src/core/coda-to-statement.ts:35-41` (`parseAmount`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { toMillis, fromMillis, addMillis, formatMillis } from "../../src/core/money.js";

describe("money (3-decimal fixed point, CODA 2.6 Annexe I)", () => {
  it("converts to integer thousandths without float error", () => {
    expect(toMillis(0.1)).toBe(100);
    expect(toMillis(1234.567)).toBe(1234567);
  });
  it("sums exactly where floats drift", () => {
    let acc = 0;
    for (let i = 0; i < 10; i++) acc = addMillis(acc, toMillis(0.1));
    expect(fromMillis(acc)).toBe(1); // 0.1*10 === 1, not 0.9999999999
  });
  it("formats to 12 integer + 3 decimal digits (15 chars)", () => {
    expect(formatMillis(toMillis(1234.5))).toBe("000000001234500");
    expect(formatMillis(toMillis(0))).toBe("000000000000000");
  });
  it("rounds half-up at the 3rd decimal", () => {
    expect(toMillis(1.2345)).toBe(1235);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/money.test.ts`
Expected: FAIL ("toMillis is not a function").

- [ ] **Step 3: Implement `src/core/money.ts`**

```typescript
// 3-decimal fixed-point money, per CODA 2.6 Annexe I (amount = 12 int + 3 dec).
export function toMillis(amount: number): number {
  return Math.round(amount * 1000);
}
export function fromMillis(millis: number): number {
  return millis / 1000;
}
export function addMillis(a: number, b: number): number {
  return a + b; // both already integer thousandths
}
export function formatMillis(millis: number): string {
  const s = Math.abs(millis).toString().padStart(4, "0");
  const intPart = s.slice(0, -3).padStart(12, "0");
  const decPart = s.slice(-3);
  return intPart + decPart; // 15 chars
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/unit/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `formatBalance`/sums/`parseAmount` to use millis**

In `formatting.ts` rewrite `formatBalance(amount)` to `formatMillis(toMillis(amount))`. In `coda-writer.ts` accumulate `sumDebits`/`sumCredits` as millis (`toMillis(entry.amount)` then `addMillis`), format with `formatMillis`. In `coda-to-statement.ts` `parseAmount` returns `fromMillis(parseInt(trimmed, 10))` (the raw 15-digit field IS already thousandths).

- [ ] **Step 6: Run full suite + commit**

Run: `npm test`
Expected: PASS (existing balance/total tests still green; floats no longer drift).
```bash
git add -A && git commit -m "fix: represent amounts as 3-decimal fixed-point per CODA 2.6 (no float drift)"
```

### Task A3: Balance reconciliation validator

**Files:**
- Modify: `src/validation/coda-validator.ts` (add reconciliation), `src/core/coda-writer.ts` (warn when out of balance).
- Test: `test/unit/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it("flags when opening + credits - debits != closing", () => {
  // build a statement whose Record 8 closing balance is wrong by 0.01
  const res = statementToCoda(badlyBalancedStmt);
  expect(res.validation.warnings.join(" ")).toMatch(/balance/i);
});
it("passes a correctly balanced statement", () => {
  const res = statementToCoda(balancedStmt);
  expect(res.validation.warnings.filter(w => /balance/i.test(w))).toHaveLength(0);
});
```

- [ ] **Step 2: Run → FAIL.** Run: `npx vitest run test/unit/validation.test.ts`

- [ ] **Step 3: Implement** — in `coda-writer.ts`, after summing, compute `openingMillis ± sumCredits/sumDebits` and compare to `closingMillis` (all in millis from Task A2); push a warning to `validation.warnings` on mismatch. Keep it a warning, not a hard error (banks differ on partial files).

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: reconcile opening+movements==closing and warn on mismatch"
```

### Task A4: OGM-VCS structured communication per AOS1

**Files:**
- Create: `src/core/ogm-vcs.ts` (mod-97 validator/formatter)
- Test: `test/unit/ogm-vcs.test.ts`
- Modify: `src/core/camt-writer.ts:104-110` (emit full `Tp/SCOR/Issr=BBA` wrapper), `src/core/camt-parser.ts:257-259` (require SCOR/BBA), `src/core/coda-writer.ts` `resolveCommunication` (validate check digit).

- [ ] **Step 1: Write the failing test**

```typescript
import { mod97, isValidOgmVcs, formatVisual } from "../../src/core/ogm-vcs.js";
it("computes the OGM-VCS check digits (mod 97, 0->97) per AOS1", () => {
  // AOS1 example reference 010806817183: first 10 = 0108068171, check = 83
  expect(mod97("0108068171")).toBe(83);
  expect(isValidOgmVcs("010806817183")).toBe(true);
  expect(isValidOgmVcs("010806817100")).toBe(false);
});
it("formats the visual +++010/8068/17183+++ form", () => {
  expect(formatVisual("010806817183")).toBe("+++010/8068/17183+++");
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `src/core/ogm-vcs.ts`**

```typescript
// Belgian OGM-VCS structured communication, FEBELFIN AOS1.
export function mod97(first10: string): number {
  const r = Number(BigInt(first10) % 97n);
  return r === 0 ? 97 : r;
}
export function isValidOgmVcs(ref12: string): boolean {
  if (!/^\d{12}$/.test(ref12)) return false;
  return mod97(ref12.slice(0, 10)) === Number(ref12.slice(10));
}
export function formatVisual(ref12: string): string {
  return `+++${ref12.slice(0, 3)}/${ref12.slice(3, 7)}/${ref12.slice(7)}+++`;
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Fix the CAMT writer wrapper (the conformance bug)**

In `camt-writer.ts`, structured remittance must emit the AOS1-mandated wrapper:
```typescript
riLines.push("  <Strd>");
riLines.push("    <CdtrRefInf>");
riLines.push("      <Tp>");
riLines.push("        <CdOrPrtry>");
riLines.push(`          ${tag("Cd", "SCOR")}`);
riLines.push("        </CdOrPrtry>");
riLines.push(`        ${tag("Issr", "BBA")}`);
riLines.push("      </Tp>");
riLines.push(`      ${tag("Ref", ri.structured.creditorRef)}`);
riLines.push("    </CdtrRefInf>");
riLines.push("  </Strd>");
```

- [ ] **Step 6: Tighten the forward parser** — in `camt-parser.ts`, only treat `RmtInf/Strd/CdtrRefInf/Ref` as a Belgian structured ref when `Tp/CdOrPrtry/Cd === "SCOR"` (Issr BBA optional but preferred); otherwise keep as a generic creditor reference. Add a warning when the 12-digit ref fails `isValidOgmVcs`.

- [ ] **Step 7: Update reverse round-trip test** to assert the regenerated XML contains `<Cd>SCOR</Cd>` and `<Issr>BBA</Issr>`. Run `npm test` → PASS.

- [ ] **Step 8: Commit**
```bash
git add -A && git commit -m "fix: emit AOS1-conformant SCOR/BBA wrapper + validate OGM-VCS mod-97"
```

### Task A5: Belgian sequence number / Ascension Friday

**Files:**
- Modify: `src/holidays/eea.ts:76` (BE `easterOffsets`), `docs/conversion-limitations.md`.
- Test: `test/unit/holidays.test.ts`

- [ ] **Step 1: Write the failing test** asserting a known 2024 working-day count for a date after Ascension that does NOT have the FEBELFIN substitution Friday (cross-check the expected value against the FEBELFIN published calendar for the chosen year).

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — remove the permanent `40` (Ascension Friday) from `BE.easterOffsets`; if a per-year substitution table is in scope, add it as an explicit `beSpecialDays(year)` function. Document the chosen approximation in `conversion-limitations.md`.

- [ ] **Step 4: Run → PASS. Commit**
```bash
git add -A && git commit -m "fix: Belgian sequence no longer treats Ascension Friday as a fixed holiday"
```

### Task A6: Golden suite + true round-trip from the real example pair

**Files:**
- Create: `test/golden/` fixtures + `test/integration/golden.test.ts`
- Use: `specifications/private-examples/coda_BE21737051687303_EUR_2026_03_16_44_44.{cod,xml}`

- [ ] **Step 1:** Copy the `.xml` and `.cod` into `test/golden/` (anonymize if needed).

- [ ] **Step 2: Forward golden test** — `parseCamt(xml)` → `statementToCoda` → join lines; assert byte-equality against the `.cod` (or, where documented lossy fields differ, assert on the stable subset and record diffs in `DIFFERENCES.md`).

- [ ] **Step 3: Reverse + round-trip test** — `codaToCamt(cod)` → assert key fields vs the `.xml`; then `parseCamt(generatedXml)` and assert the model equals the model parsed from the original (closing the loop the current `round-trip.test.ts` leaves open).

- [ ] **Step 4: Run → PASS (or capture documented diffs). Commit**
```bash
git add -A && git commit -m "test: golden + closed-loop round-trip from real CAMT/CODA reference pair"
```

### Task A7: Transaction-code coverage decision

**Files:**
- Modify: `src/core/transaction-codes.ts`, `docs/conversion-limitations.md`.

- [ ] **Step 1:** Compare the 10-entry `TRANSACTION_CODE_MAP` against CODA 2.6 Annex II (pp.29–60). Decide scope: (a) expand the table for the common families, or (b) formally document BBA-passthrough (`BkTxCd/Prtry/Cd` Issr=BBA) as the primary path with the ISO map as best-effort fallback.

- [ ] **Step 2:** Implement the decision; add tests for any newly-mapped codes. Run `npm test` → PASS.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: expand/document CODA transaction-code coverage per Annex II"
```

---

## Self-Review notes
- Money task uses the spec-confirmed 3-decimal scale (not cents). Verify rounding direction against any bank sample before shipping.
- A1 matrix is a discovery deliverable; it MAY append tasks A8+ for ❌ rows it finds.
- Branch deletion (B5) is gated on `git cherry`/`--merged` evidence — never blind `-D`.
- Golden byte-equality (A6) may legitimately differ on documented lossy fields; record, don't force.
