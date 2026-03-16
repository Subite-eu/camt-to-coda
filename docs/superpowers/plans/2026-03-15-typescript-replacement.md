# TypeScript CAMT-to-CODA Replacement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Java/XSLT CAMT-to-CODA converter with a TypeScript implementation that achieves feature parity (except CAMT 054), adds a web UI, and includes comprehensive testing.

**Architecture:** Config-driven mapping engine with pure-function record builders. Pluggable storage (filesystem + S3). Parser → normalized model → writer pipeline. Each record builder is a self-contained function returning exactly 128 characters.

**Tech Stack:** TypeScript, Node 22, fast-xml-parser, @aws-sdk/client-s3, commander, vitest, fast-check. Docker for deployment. Bun for standalone binary compilation.

**Spec:** `docs/superpowers/specs/2026-03-15-typescript-replacement-design.md`

---

## Pre-flight

Before starting, the implementor should understand:

1. **CODA 2.6 spec** — Read `specifications/CODA/standard-coda-2.6-en.pdf` for record layouts
2. **Existing PoC** — The `ts/` directory has a working proof-of-concept (4 source files, 1 test file) that already converts CAMT 052/053 to valid CODA. This plan restructures and extends it.
3. **Java reference** — The `java/` directory has the production converter. Use it to generate golden file baselines.
4. **Anonymized test data** — `example-files/CAMT/` has 696 anonymized XML files across CAMT 052 and 053 formats.

---

## Chunk 1: Project Scaffolding & Core Types

### Task 1: Initialize project at repo root

Move the TS project from `ts/` to repo root. This is the migration start.

**Files:**
- Move: `ts/src/*` → `src/`
- Move: `ts/test/*` → `test/`
- Move: `ts/package.json` → `package.json`
- Move: `ts/tsconfig.json` → `tsconfig.json`
- Create: `vitest.config.ts`
- Delete: `ts/` directory (after moving)

- [ ] **Step 1: Tag Java final and create TS branch**

```bash
git tag -a v1.0-java-final -m "Final Java/XSLT version before TypeScript rewrite"
git push origin v1.0-java-final
git checkout -b ts-rewrite
```

- [ ] **Step 2: Move PoC files to repo root**

```bash
cp -r ts/src ./src
cp -r ts/test ./test
cp ts/tsconfig.json ./tsconfig.json
rm -rf ts/
```

- [ ] **Step 3: Create package.json at root**

```json
{
  "name": "camt2coda",
  "version": "2.0.0",
  "description": "CAMT to CODA bank statement converter",
  "type": "module",
  "main": "dist/cli.js",
  "bin": { "camt2coda": "dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/ test/",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["camt", "coda", "iso20022", "bank-statement", "converter"],
  "author": "Subite",
  "license": "MIT",
  "dependencies": {
    "fast-xml-parser": "^5.5.5",
    "commander": "^13.1.0"
  },
  "optionalDependencies": {
    "@aws-sdk/client-s3": "^3.750.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "fast-check": "^3.22.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/web/**"],
      thresholds: { lines: 90, branches: 80 },
    },
  },
});
```

- [ ] **Step 5: Update tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 6: Install dependencies and verify**

```bash
npm install
npx tsc --noEmit  # should pass (PoC code compiles)
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: move TS project to repo root, update scaffolding"
```

### Task 2: Extract model types to dedicated file

**Files:**
- Create: `src/core/model.ts`
- Modify: `src/core/camt-parser.ts` (remove interfaces, import from model)
- Modify: `src/core/coda-writer.ts` (import from model)

- [ ] **Step 1: Create src/core/model.ts**

Extract interfaces from `camt-parser.ts` and add `camtVersion` field per spec:

```typescript
// src/core/model.ts

export interface CamtStatement {
  messageId: string;
  creationDate: string;
  statementId: string;
  reportDate: string;
  camtVersion: "052" | "053";
  account: AccountInfo;
  openingBalance: Balance;
  closingBalance: Balance;
  entries: CamtEntry[];
  sequence?: number;
}

export interface AccountInfo {
  iban?: string;
  otherId?: string;
  currency: string;
  ownerName?: string;
  bic?: string;
}

export interface Balance {
  amount: number;
  creditDebit: "CRDT" | "DBIT";
  date: string;
}

export interface CamtEntry {
  amount: number;
  currency: string;
  creditDebit: "CRDT" | "DBIT";
  bookingDate?: string;
  valueDate?: string;
  entryRef?: string;
  accountServicerRef?: string;
  transactionCode?: TransactionCode;
  details: TransactionDetail[];
  batchCount?: number;
}

export interface TransactionCode {
  domain?: string;
  family?: string;
  subFamily?: string;
  proprietary?: string;
}

export interface TransactionDetail {
  refs?: { endToEndId?: string; txId?: string; instrId?: string };
  counterparty?: { name?: string; iban?: string; bic?: string };
  remittanceInfo?: {
    unstructured?: string;
    structured?: { creditorRef?: string };
  };
}
```

- [ ] **Step 2: Update camt-parser.ts imports**

Remove all `export interface` blocks from `camt-parser.ts`. Add:
```typescript
import type { CamtStatement, CamtEntry, TransactionDetail } from "./model.js";
export type { CamtStatement, CamtEntry, TransactionDetail };
```

Add `camtVersion` to parser return values:
- In `parseStatement()`: add `camtVersion: "053"` to the returned object
- In `parseReport()`: add `camtVersion: "052"` to the returned object

- [ ] **Step 3: Update coda-writer.ts imports**

```typescript
import type { CamtStatement, CamtEntry } from "./model.js";
```

Update filename generation to use `stmt.camtVersion`:
```typescript
const fileName = `${dateStr}-${acct}-${stmt.account.currency}-${stmt.statementId}-CAMT-${stmt.camtVersion}.cod`;
```

- [ ] **Step 4: Run tests to verify nothing broke**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: extract model types to dedicated file, add camtVersion"
```

### Task 3: Extract formatting utilities

**Files:**
- Create: `src/core/formatting.ts`
- Modify: `src/core/coda-writer.ts` (import from formatting)
- Create: `test/unit/formatting.test.ts`

- [ ] **Step 1: Write formatting tests**

```typescript
// test/unit/formatting.test.ts
import { describe, it, expect } from "vitest";
import { padRight, padLeft, formatBalance, formatDate, signCode, movementSign, accountStructure } from "../../src/core/formatting.js";

describe("padRight", () => {
  it("pads short string", () => expect(padRight("AB", 5)).toBe("AB   "));
  it("truncates long string", () => expect(padRight("ABCDEF", 3)).toBe("ABC"));
  it("returns exact fit", () => expect(padRight("ABC", 3)).toBe("ABC"));
  it("pads with custom char", () => expect(padRight("1", 4, "0")).toBe("1000"));
});

describe("padLeft", () => {
  it("pads short string", () => expect(padLeft("1", 4, "0")).toBe("0001"));
  it("truncates long string", () => expect(padLeft("12345", 3, "0")).toBe("123"));
});

describe("formatBalance", () => {
  it("formats zero", () => expect(formatBalance(0)).toBe("000000000000000"));
  it("formats integer", () => expect(formatBalance(1000)).toBe("000000001000000"));
  it("formats decimals", () => expect(formatBalance(123.45)).toBe("000000000123450"));
  it("always 15 chars", () => {
    for (const n of [0, 0.01, 1, 99.99, 1000000, 123456789.123])
      expect(formatBalance(n)).toHaveLength(15);
  });
  it("handles negative (uses absolute)", () => expect(formatBalance(-500)).toBe("000000000500000"));
});

describe("formatDate", () => {
  it("formats ISO date", () => expect(formatDate("2024-03-07")).toBe("070324"));
  it("formats datetime", () => expect(formatDate("2024-11-30T23:59:59Z")).toBe("301124"));
  it("handles empty", () => expect(formatDate("")).toBe("000000"));
});

describe("signCode", () => {
  it("positive is 0 (credit)", () => expect(signCode(100)).toBe("0"));
  it("zero is 0", () => expect(signCode(0)).toBe("0"));
  it("negative is 1 (debit)", () => expect(signCode(-100)).toBe("1"));
});

describe("movementSign", () => {
  it("CRDT is 0", () => expect(movementSign("CRDT")).toBe("0"));
  it("DBIT is 1", () => expect(movementSign("DBIT")).toBe("1"));
});

describe("accountStructure", () => {
  it("BE is 2", () => expect(accountStructure("BE68793230773034")).toBe("2"));
  it("LT is 3", () => expect(accountStructure("LT625883379695428516")).toBe("3"));
  it("non-IBAN is 0", () => expect(accountStructure("1234567890")).toBe("0"));
});
```

- [ ] **Step 2: Run tests to see them fail**

```bash
npx vitest run test/unit/formatting.test.ts
# Expected: FAIL (module not found)
```

- [ ] **Step 3: Create src/core/formatting.ts**

Extract from `coda-writer.ts`:

```typescript
// src/core/formatting.ts

export function padRight(s: string, len: number, char = " "): string {
  return s.slice(0, len).padEnd(len, char);
}

export function padLeft(s: string, len: number, char = " "): string {
  return s.slice(0, len).padStart(len, char);
}

export function formatBalance(amount: number): string {
  const abs = Math.abs(amount);
  const [integer, decimals = "0"] = abs.toFixed(3).split(".");
  return padLeft(integer, 12, "0") + padRight(decimals, 3, "0");
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "000000";
  const d = dateStr.slice(8, 10);
  const m = dateStr.slice(5, 7);
  const y = dateStr.slice(2, 4);
  return d + m + y;
}

export function signCode(amount: number): string {
  return amount >= 0 ? "0" : "1";
}

export function movementSign(creditDebit: "CRDT" | "DBIT"): string {
  return creditDebit === "CRDT" ? "0" : "1";
}

export function accountStructure(account: string): string {
  if (account.startsWith("BE")) return "2";
  if (/^[A-Z]{2}/.test(account)) return "3";
  return "0";
}

export function signedAmount(amount: number, creditDebit: "CRDT" | "DBIT"): number {
  return creditDebit === "CRDT" ? amount : -amount;
}
```

**IMPORTANT:** Note the `signCode` fix — the PoC had `amount >= 0 ? "1" : "0"` which was wrong per CODA spec (0=credit, 1=debit). The Java XSLT was also corrected to `0` for positive. This is the correct mapping.

- [ ] **Step 4: Update coda-writer.ts to import from formatting**

Remove all formatting functions from `coda-writer.ts`. Add:
```typescript
import { padRight, padLeft, formatBalance, formatDate, signCode, movementSign, accountStructure, signedAmount } from "./formatting.js";
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run
# Expected: all pass
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: extract formatting utilities with tests, fix signCode"
```

---

## Chunk 2: Record Builders (Pure Functions)

### Task 4: Extract record builders into individual files

Split `coda-writer.ts` record functions into `src/core/records/record0.ts` through `record9.ts`. Each file exports one pure function.

**Files:**
- Create: `src/core/records/record0.ts` through `src/core/records/record9.ts`
- Create: `test/unit/records/record0.test.ts` through `test/unit/records/record9.test.ts`
- Modify: `src/core/coda-writer.ts` (import from records, keep orchestration only)

- [ ] **Step 1: Write record0 test first (TDD)**

Create `test/unit/records/record0.test.ts` (test code shown in Step 2 below).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/records/record0.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create src/core/records/record0.ts**

```typescript
import { padRight, padLeft, formatDate } from "../formatting.js";
import type { CamtStatement } from "../model.js";

export function record0(stmt: CamtStatement): string {
  const date = formatDate(stmt.reportDate);
  const bic = stmt.account.bic || "";
  return [
    "0",                      // 1     record id
    "0000",                   // 2-5   zeros
    date,                     // 6-11  creation date
    "000",                    // 12-14 bank id
    "05",                     // 15-16 application code
    " ",                      // 17    duplicate indicator
    padRight("", 7),          // 18-24 blanks
    padRight("", 10),         // 25-34 file reference
    padRight("", 26),         // 35-60 addressee name
    padRight(bic, 11),        // 61-71 BIC
    padRight("", 11),         // 72-82 company number
    " ",                      // 83    blank
    padLeft("", 5, "0"),      // 84-88 separate application
    padRight("", 16),         // 89-104 transaction ref
    padRight("", 16),         // 105-120 related ref
    padRight("", 7),          // 121-127 blanks
    "2",                      // 128   version code
  ].join("");
}
```

- [ ] **Step 2: Create test/unit/records/record0.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { record0 } from "../../../src/core/records/record0.js";
import type { CamtStatement } from "../../../src/core/model.js";

const minStmt: CamtStatement = {
  messageId: "MSG1", creationDate: "2024-03-07T12:00:00Z",
  statementId: "STMT1", reportDate: "2024-03-07T12:00:00Z",
  camtVersion: "053",
  account: { currency: "EUR", bic: "TESTBE21" },
  openingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-03-07" },
  closingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-03-07" },
  entries: [],
};

describe("record0", () => {
  it("returns exactly 128 chars", () => {
    expect(record0(minStmt)).toHaveLength(128);
  });

  it("starts with 0", () => {
    expect(record0(minStmt)[0]).toBe("0");
  });

  it("contains BIC at position 60-70 (0-indexed)", () => {
    const line = record0(minStmt);
    expect(line.slice(60, 68)).toBe("TESTBE21");
  });

  it("ends with version code 2", () => {
    expect(record0(minStmt)[127]).toBe("2");
  });

  it("contains formatted date at position 5-10", () => {
    const line = record0(minStmt);
    expect(line.slice(5, 11)).toBe("070324");
  });

  it("handles missing BIC", () => {
    const stmt = { ...minStmt, account: { currency: "EUR" } };
    const line = record0(stmt);
    expect(line).toHaveLength(128);
    expect(line.slice(60, 71)).toBe("           ");
  });
});
```

- [ ] **Step 3: Repeat for record1, record21, record22, record23, record8, record9**

Each follows the same pattern: extract the function, write a test verifying 128-char output and key field positions. I'll outline record21 since it's the most complex:

**src/core/records/record21.ts:**
```typescript
import { padRight, padLeft, formatBalance, formatDate, movementSign } from "../formatting.js";
import type { CamtEntry } from "../model.js";

export interface Record21Params {
  entry: CamtEntry;
  seqNum: string;
  comm: string;
  commType: string;
  txCode: string;
  entryDate: string;
  hasNextRecord: boolean;
  needRecord3: boolean;
}

export function record21(p: Record21Params): string {
  const valueDate = p.entry.valueDate
    ? formatDate(p.entry.valueDate)
    : p.entry.bookingDate
    ? formatDate(p.entry.bookingDate)
    : "000000";

  const refs = p.entry.details
    .flatMap((d) =>
      [d.refs?.endToEndId, d.refs?.txId, d.refs?.instrId].filter(
        (r) => r && r !== "NOTPROVIDED"
      )
    )
    .join("/");

  return [
    "2",                                        // 1     record id
    "1",                                        // 2     article code
    p.seqNum,                                   // 3-6   sequence number
    "0000",                                     // 7-10  detail number
    padRight(refs || p.entry.entryRef || "", 21),// 11-31 bank ref
    movementSign(p.entry.creditDebit),          // 32    movement sign
    formatBalance(p.entry.amount),              // 33-47 amount
    valueDate,                                  // 48-53 value date
    padRight(p.txCode, 8),                      // 54-61 transaction code
    p.commType,                                 // 62    comm type
    padRight(p.comm.slice(0, 53), 53),          // 63-115 communication
    p.entryDate,                                // 116-121 entry date
    "000",                                      // 122-124 sequence
    p.needRecord3 ? "1" : "0",                  // 125   globalisation code
    p.hasNextRecord ? "1" : "0",                // 126   next code
    " ",                                        // 127   blank
    p.needRecord3 ? "1" : "0",                  // 128   link code
  ].join("");
}
```

- [ ] **Step 4: Write record31/32/33 tests first (TDD — new records not in PoC)**

Create `test/unit/records/record31.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { record31 } from "../../../src/core/records/record31.js";

describe("record31", () => {
  it("returns exactly 128 chars", () => {
    const line = record31({ seqNum: "0001", detailNum: 1, bankRef: "REF1", txCode: "04500001", commType: "0", comm: "Test comm", entryDate: "150624", hasRecord32: false });
    expect(line).toHaveLength(128);
  });
  it("starts with 31", () => { /* ... */ });
  it("has globalisation code 0 at position 123 (0-indexed)", () => { /* ... */ });
});
```

Repeat for record32 and record33 with 128-char assertion.

- [ ] **Step 5: Create record31, record32, record33 implementation**

**src/core/records/record31.ts:**
```typescript
import { padRight, padLeft, formatDate } from "../formatting.js";

export interface Record31Params {
  seqNum: string;
  detailNum: number;
  bankRef: string;
  txCode: string;
  commType: string;
  comm: string;
  entryDate: string;
  hasRecord32: boolean;
}

export function record31(p: Record31Params): string {
  return [
    "3",                                        // 1     record id
    "1",                                        // 2     article code
    p.seqNum,                                   // 3-6   sequence
    padLeft(String(p.detailNum), 4, "0"),        // 7-10  detail number
    padRight(p.bankRef, 21),                    // 11-31 bank ref
    "1",                                        // 32    tx code type (detail of globalisation)
    padRight(p.txCode, 8),                      // 33-40 transaction code
    p.commType,                                 // 41    comm type
    padRight(p.comm.slice(0, 73), 73),          // 42-114 communication (73 chars)
    p.entryDate,                                // 115-120 entry date
    "000",                                      // 121-123 sequence
    "0",                                        // 124   globalisation code (detail)
    p.hasRecord32 ? "1" : "0",                  // 125   next code
    " ",                                        // 126   blank
    "0",                                        // 127   link code
    " ",                                        // 128   padding — VERIFY against spec
  ].join("");
}
```

**Note to implementor:** The exact field positions for Record 3 must be verified against the CODA 2.6 spec PDF and the Java XSLT at `java/BankFileConverter/CamtToCoda/src/main/resources/xslt/camt.053.001.XX-to-coda.xslt` (lines 228-331). The XSLT `createRecord.3.1` template shows the exact field order. Record 3.2 uses 105-char comm + 10-char blank, not the same layout as Record 2.2.

- [ ] **Step 5: Update coda-writer.ts to import all records**

The `coda-writer.ts` becomes a thin orchestrator:
```typescript
import { record0 } from "./records/record0.js";
import { record1 } from "./records/record1.js";
import { record21, type Record21Params } from "./records/record21.js";
// ... etc
```

Remove all inline record builder functions. Keep `statementToCoda()` and `resolveCommunication()`.

Add Record 3 emission logic to `statementToCoda()`:
```typescript
// After Record 2.3 emission:
if (entry.details.length > 1) {
  for (let d = 0; d < entry.details.length; d++) {
    const detail = entry.details[d];
    const txComm = detail.remittanceInfo?.unstructured || /* ... refs fallback */;
    lines.push(record31({ seqNum, detailNum: d + 1, bankRef: /* ... */, txCode, commType: "0", comm: txComm.slice(0, 73), entryDate, hasRecord32: txComm.length > 73 }));
    recordCount++; // count one per detail (not per 3.x line)
    if (txComm.length > 73) {
      lines.push(record32({ seqNum, detailNum: d + 1, comm: txComm.slice(73, 178), hasRecord33: txComm.length > 178 }));
    }
    if (txComm.length > 178) {
      lines.push(record33({ seqNum, detailNum: d + 1, comm: txComm.slice(178, 268) }));
    }
  }
}
```

Also update Record 2.3 to pass `needRecord3: entry.details.length > 1` for link code.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
# Expected: all pass including existing test/coda-writer.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split record builders into individual files, add Record 3"
```

---

### Task 4b: Transaction code mapping with tests

**Files:**
- Move: `src/transaction-codes.ts` → `src/core/transaction-codes.ts` (already exists from PoC)
- Create: `test/unit/transaction-codes.test.ts`

- [ ] **Step 1: Write transaction code tests**

```typescript
// test/unit/transaction-codes.test.ts
import { describe, it, expect } from "vitest";
import { mapTransactionCode } from "../../src/core/transaction-codes.js";

describe("mapTransactionCode", () => {
  it("PMNT/RCDT/ESCT → 04500001", () => expect(mapTransactionCode("PMNT", "RCDT", "ESCT")).toBe("04500001"));
  it("PMNT/ICDT/ESCT → 13010001", () => expect(mapTransactionCode("PMNT", "ICDT", "ESCT")).toBe("13010001"));
  it("PMNT/CCRD/anything → 04370000 (wildcard)", () => expect(mapTransactionCode("PMNT", "CCRD", "VISA")).toBe("04370000"));
  it("CAMT/ACCB/INTR → 35010000", () => expect(mapTransactionCode("CAMT", "ACCB", "INTR")).toBe("35010000"));
  it("CAMT/ACCB/CHRG → 80370000", () => expect(mapTransactionCode("CAMT", "ACCB", "CHRG")).toBe("80370000"));
  it("unknown → 8 spaces", () => expect(mapTransactionCode("XXXX", "YYYY", "ZZZZ")).toBe("        "));
  it("missing domain → 8 spaces", () => expect(mapTransactionCode(undefined, undefined, undefined)).toBe("        "));
  it("PMNT/RCDT/INST → 02500001", () => expect(mapTransactionCode("PMNT", "RCDT", "INST")).toBe("02500001"));
  it("PMNT/ICDT/INST → 02010001", () => expect(mapTransactionCode("PMNT", "ICDT", "INST")).toBe("02010001"));
  it("PMNT/IDDT/ESDD → 05010000", () => expect(mapTransactionCode("PMNT", "IDDT", "ESDD")).toBe("05010000"));
});
```

- [ ] **Step 2: Move existing transaction-codes.ts to core/**

```bash
mv src/transaction-codes.ts src/core/transaction-codes.ts
```

Update imports in coda-writer.ts.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run test/unit/transaction-codes.test.ts
git add -A && git commit -m "test: transaction code mapping with 10 test cases"
```

---

## Chunk 3: Holiday Calculator & Validation

### Task 5: Implement holiday calculator

Port the Java `HolidaysFactory` + `DateToSequenceHelper` to TypeScript.

**Files:**
- Create: `src/holidays/holidays.ts`
- Create: `src/holidays/belgium.ts`
- Create: `src/holidays/lithuania.ts`
- Create: `src/holidays/netherlands.ts`
- Create: `test/unit/holidays.test.ts`

- [ ] **Step 1: Write holiday tests**

```typescript
// test/unit/holidays.test.ts
import { describe, it, expect } from "vitest";
import { workingDaysFromJan1 } from "../../src/holidays/holidays.js";

describe("workingDaysFromJan1", () => {
  it("Jan 1 is always 1", () => {
    expect(workingDaysFromJan1("BE", "2024-01-01")).toBe(1);
  });

  it("Jan 2 2024 is 1 for BE (Jan 1 is holiday)", () => {
    // 2024-01-01 is Monday (holiday), so Jan 2 = seq 1
    expect(workingDaysFromJan1("BE", "2024-01-02")).toBe(1);
  });

  it("skips weekends", () => {
    // 2024-01-08 is Monday. Working days: Jan 2(Tue)-5(Fri) = 4 + 1 start = 5
    expect(workingDaysFromJan1("BE", "2024-01-08")).toBe(5);
  });

  it("Dec 31 has high sequence", () => {
    const seq = workingDaysFromJan1("BE", "2024-12-31");
    expect(seq).toBeGreaterThan(240);
    expect(seq).toBeLessThan(270);
  });

  it("unknown country still works (no holidays)", () => {
    expect(workingDaysFromJan1("XX", "2024-03-07")).toBeGreaterThan(0);
  });

  it("Easter 2024 is March 31 (Good Friday March 29 is BE bank holiday)", () => {
    // March 29 2024 = Good Friday (bank holiday in BE)
    const withFriday = workingDaysFromJan1("BE", "2024-04-01");
    const withoutFriday = workingDaysFromJan1("XX", "2024-04-01");
    expect(withFriday).toBeLessThan(withoutFriday);
  });
});
```

- [ ] **Step 2: Implement Easter computation (Computus algorithm)**

```typescript
// src/holidays/holidays.ts
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  return new Date(year, n - 1, p + 1);  // month is 0-indexed
}
```

- [ ] **Step 3: Implement country holidays**

Port each country's holidays from `HolidaysFactory.java`. Each file exports a function that returns holiday dates for a given year.

```typescript
// src/holidays/belgium.ts
import { easterSunday } from "./holidays.js";

export function belgiumHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return [
    new Date(year, 0, 1),    // New Year
    addDays(easter, -2),     // Good Friday (bank)
    addDays(easter, 1),      // Easter Monday
    new Date(year, 4, 1),    // Labour Day
    addDays(easter, 39),     // Ascension
    addDays(easter, 40),     // Ascension Friday (bank)
    addDays(easter, 50),     // Pentecost Monday
    new Date(year, 6, 21),   // Independence Day
    new Date(year, 7, 15),   // Assumption
    new Date(year, 10, 1),   // All Saints
    new Date(year, 10, 11),  // Armistice
    new Date(year, 11, 25),  // Christmas
    new Date(year, 11, 26),  // Boxing Day (bank)
  ];
}
```

- [ ] **Step 4: Implement workingDaysFromJan1**

```typescript
// in src/holidays/holidays.ts
import { belgiumHolidays } from "./belgium.js";
import { lithuaniaHolidays } from "./lithuania.js";
import { netherlandsHolidays } from "./netherlands.js";

function getHolidays(country: string, year: number): Date[] {
  switch (country) {
    case "BE": return belgiumHolidays(year);
    case "LT": return lithuaniaHolidays(year);
    case "NL": return netherlandsHolidays(year);
    default: return [];
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function workingDaysFromJan1(country: string, dateStr: string): number {
  const target = new Date(dateStr.slice(0, 10));
  const year = target.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const holidays = getHolidays(country, year);

  let seq = 1;
  const d = new Date(jan1);
  while (d < target) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {  // not weekend
      if (!holidays.some(h => isSameDay(h, d))) {
        seq++;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return seq;
}
```

- [ ] **Step 5: Wire into coda-writer.ts**

Replace the hardcoded `"001"` fallback with:
```typescript
import { workingDaysFromJan1 } from "../holidays/holidays.js";

const sequence = stmt.sequence
  ? padLeft(String(stmt.sequence % 1000), 3, "0")
  : padLeft(String(workingDaysFromJan1(
      (stmt.account.iban || stmt.account.otherId || "").slice(0, 2),
      stmt.reportDate
    )), 3, "0");
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: holiday calculator with BE/LT/NL support"
```

### Task 6: Implement validation

**Files:**
- Create: `src/validation/result.ts`
- Create: `src/validation/camt-validator.ts`
- Create: `src/validation/coda-validator.ts`
- Create: `test/unit/validation.test.ts`

- [ ] **Step 1: Create ValidationResult type**

```typescript
// src/validation/result.ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function success(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

export function merge(a: ValidationResult, b: ValidationResult): ValidationResult {
  return {
    valid: a.valid && b.valid,
    errors: [...a.errors, ...b.errors],
    warnings: [...a.warnings, ...b.warnings],
  };
}
```

- [ ] **Step 2: Implement CAMT pre-flight validator**

```typescript
// src/validation/camt-validator.ts
import type { CamtStatement } from "../core/model.js";
import type { ValidationResult } from "./result.js";

export function validateCamt(stmt: CamtStatement): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!stmt.account.iban && !stmt.account.otherId) {
    errors.push("No account identifier found (IBAN or other ID required)");
  }
  if (!stmt.account.currency) {
    errors.push("No currency found");
  }
  if (!stmt.openingBalance.date) {
    warnings.push("No opening balance date");
  }
  if (!stmt.closingBalance.date) {
    warnings.push("No closing balance date");
  }
  if (!stmt.account.bic && stmt.camtVersion === "053") {
    warnings.push("No BIC found, left blank in CODA output");
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 3: Implement CODA post-conversion validator**

```typescript
// src/validation/coda-validator.ts
import type { ValidationResult } from "./result.js";

export function validateCoda(lines: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128) {
      errors.push(`Line ${i + 1} (record ${lines[i][0]}): ${lines[i].length} chars (expected 128)`);
    }
  }

  // Check record sequence: must start with 0, end with 9
  if (lines.length > 0 && lines[0][0] !== "0") {
    errors.push("First record must be Record 0 (header)");
  }
  if (lines.length > 0 && lines[lines.length - 1][0] !== "9") {
    errors.push("Last record must be Record 9 (trailer)");
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 4: Write tests and run**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: CAMT pre-flight and CODA post-conversion validation"
```

---

## Chunk 4: Storage Abstraction (Filesystem + S3)

### Task 7: Filesystem storage

**Files:**
- Create: `src/storage/storage.ts`
- Create: `src/storage/fs-storage.ts`
- Create: `test/unit/fs-storage.test.ts`

- [ ] **Step 1: Define Storage interface**

```typescript
// src/storage/storage.ts
export interface Storage {
  list(path: string): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export function isS3Path(path: string): boolean {
  return path.startsWith("s3://");
}

export function parseS3Path(path: string): { bucket: string; key: string } {
  const withoutScheme = path.slice(5); // remove "s3://"
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex === -1) return { bucket: withoutScheme, key: "" };
  return { bucket: withoutScheme.slice(0, slashIndex), key: withoutScheme.slice(slashIndex + 1) };
}
```

- [ ] **Step 2: Implement FsStorage**

```typescript
// src/storage/fs-storage.ts
import { readdir, readFile, writeFile, rename, mkdir, access, stat } from "fs/promises";
import { join, dirname, basename } from "path";
import type { Storage } from "./storage.js";

export class FsStorage implements Storage {
  async list(path: string): Promise<string[]> {
    const s = await stat(path);
    if (!s.isDirectory()) return [path];
    const files = await readdir(path);
    return files.filter(f => f.endsWith(".xml")).map(f => join(path, f));
  }

  async read(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async move(from: string, to: string): Promise<void> {
    await mkdir(dirname(to), { recursive: true });
    await rename(from, join(to, basename(from)));
  }

  async exists(path: string): Promise<boolean> {
    try { await access(path); return true; } catch { return false; }
  }
}
```

- [ ] **Step 3: Write integration test using temp dirs**
- [ ] **Step 4: Run tests, commit**

### Task 8: S3 storage

**Files:**
- Create: `src/storage/s3-storage.ts`
- Create: `test/integration/s3-storage.test.ts` (skipped unless MinIO running)

- [ ] **Step 1: Implement S3Storage with lazy import**

```typescript
// src/storage/s3-storage.ts
import { parseS3Path, type Storage } from "./storage.js";

export interface S3Config {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export class S3Storage implements Storage {
  private client: any;
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  private async getClient() {
    if (!this.client) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this.client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region || "us-east-1",
        credentials: this.config.accessKeyId ? {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey!,
        } : undefined,
        forcePathStyle: true,  // needed for MinIO
      });
    }
    return this.client;
  }

  async list(path: string): Promise<string[]> {
    const { bucket, key } = parseS3Path(path);
    const client = await this.getClient();
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const result = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: key,
    }));
    return (result.Contents || [])
      .filter((o: any) => o.Key?.endsWith(".xml"))
      .map((o: any) => `s3://${bucket}/${o.Key}`);
  }

  async read(path: string): Promise<string> {
    const { bucket, key } = parseS3Path(path);
    const client = await this.getClient();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return result.Body!.transformToString("utf-8");
  }

  async write(path: string, content: string): Promise<void> {
    const { bucket, key } = parseS3Path(path);
    const client = await this.getClient();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: content, ContentType: "text/plain",
    }));
  }

  async move(from: string, to: string): Promise<void> {
    const { bucket: srcBucket, key: srcKey } = parseS3Path(from);
    const { bucket: dstBucket, key: dstKey } = parseS3Path(to);
    const client = await this.getClient();
    const { CopyObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const destKey = dstKey.endsWith("/") ? dstKey + srcKey.split("/").pop() : dstKey;
    await client.send(new CopyObjectCommand({
      Bucket: dstBucket, Key: destKey,
      CopySource: `${srcBucket}/${srcKey}`,
    }));
    await client.send(new DeleteObjectCommand({ Bucket: srcBucket, Key: srcKey }));
  }

  async exists(path: string): Promise<boolean> {
    const { bucket, key } = parseS3Path(path);
    const client = await this.getClient();
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch { return false; }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: storage abstraction with filesystem and S3 backends"
```

---

## Chunk 5: CLI, Anonymizer & Web UI

### Task 9: CLI with commander

**Files:**
- Rewrite: `src/cli.ts`

- [ ] **Step 1: Implement CLI with convert, validate, info, serve subcommands**

Use `commander` for argument parsing. The convert command auto-detects storage type from path prefix. Wire in all the modules built so far.

Key behaviors:
- `--dry-run`: run pipeline but skip Storage.write and Storage.move, log what would happen
- `--anonymize`: post-process CODA lines before writing
- S3 detection: if input starts with `s3://`, use S3Storage with credentials from flags/env

- [ ] **Step 2: Test CLI manually**

```bash
npx tsx src/cli.ts convert -i example-files/CAMT/Other/BE68793230773034-202411.xml -o /tmp/coda-test/
npx tsx src/cli.ts info example-files/CAMT/Other/BE68793230773034-202411.xml
npx tsx src/cli.ts validate example-files/CAMT/Other/BE68793230773034-202411.xml
```

- [ ] **Step 3: Commit**

### Task 10: CODA output anonymizer

**Files:**
- Create: `src/anonymize/anonymizer.ts`
- Create: `test/unit/anonymizer.test.ts`

- [ ] **Step 1: Implement position-based CODA line anonymizer**

Replace sensitive data at known field positions in CODA lines. Uses SHA-256 of original value + seed for deterministic, referentially-integer fake data.

Key: this operates on the 128-char CODA strings, not on the CAMT model. It splices fake values into known positions per record type.

- [ ] **Step 2: Write tests (deterministic output, referential integrity)**
- [ ] **Step 3: Commit**

### Task 11: Minimal web UI

**Files:**
- Create: `src/web/server.ts`
- Create: `src/web/index.html`
- Create: `test/integration/web.test.ts`

- [ ] **Step 1: Implement HTTP server**

```typescript
// src/web/server.ts
import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCamt } from "../core/camt-parser.js";
import { statementToCoda } from "../core/coda-writer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(port: number) {
  const indexHtml = readFileSync(join(__dirname, "index.html"), "utf-8");

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexHtml);
    } else if (req.method === "GET" && req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else if (req.method === "POST" && req.url === "/api/convert") {
      // Read multipart body, extract XML, convert, return JSON
      // ... (parse body, call parseCamt + statementToCoda)
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(`camt2coda web UI: http://localhost:${port}`);
  });
  return server;
}
```

- [ ] **Step 2: Create index.html**

Single-page HTML with drag-drop zone, monospace preview pane, download button, anonymize checkbox. No framework — vanilla JS + fetch API.

- [ ] **Step 3: Write integration test for /api/convert endpoint**
- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: CLI, anonymizer, and minimal web UI"
```

---

## Chunk 6: Integration Tests & Golden Files

### Task 12: Integration tests

**Files:**
- Create: `test/integration/convert.test.ts`
- Create: `test/fixtures/*.xml` (synthetic CAMT snippets)

- [ ] **Step 1: Create test fixtures**

Small, hand-crafted CAMT XML files covering:
- Empty statement (no entries)
- Single entry with counterparty
- Batch entry (multiple TxDtls → Record 3)
- Structured remittance
- Long communication (>106 chars)
- Missing optional fields

- [ ] **Step 2: Write integration tests (~30)**

Each test: parse XML string → convert → verify CODA output properties.

- [ ] **Step 3: Commit**

### Task 13: Golden file tests

**Files:**
- Create: `test/golden/*.cod` (generated from Java converter)
- Create: `test/golden/DIFFERENCES.md`
- Create: `test/golden/golden.test.ts`

- [ ] **Step 1: Generate golden files from Java converter**

Before removing the Java code, generate golden .cod output for key test files. The TS converter output will be diffed against these.

```bash
cd java/BankFileConverter
sh local_test_FS.sh 53
# Output goes to test_data/fs/out/
cp test_data/fs/out/*.cod ../../test/golden/

# Also convert a small CAMT 052 file
sh local_test_FS.sh 52
cp test_data/fs/out/*.cod ../../test/golden/
```

**Pairing convention:** Each golden pair consists of:
- `test/golden/<name>.xml` — the CAMT input (copied from example-files)
- `test/golden/<name>.cod` — the expected CODA output (from Java converter)

Name them identically except for extension. Example: `test/golden/053-be-statement.xml` + `test/golden/053-be-statement.cod`.

- [ ] **Step 2: Write parameterized golden file test**

```typescript
// test/golden/golden.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";

const goldenDir = "test/golden";
const xmlFiles = readdirSync(goldenDir).filter(f => f.endsWith(".xml"));

describe.each(xmlFiles)("golden: %s", (xmlFile) => {
  it("matches expected CODA output", () => {
    const xml = readFileSync(`${goldenDir}/${xmlFile}`, "utf-8");
    const codFile = xmlFile.replace(".xml", ".cod");
    const expected = readFileSync(`${goldenDir}/${codFile}`, "utf-8").split("\n").filter(Boolean);

    const stmts = parseCamt(xml);
    const result = statementToCoda(stmts[0]);

    // Compare line by line
    for (let i = 0; i < Math.max(expected.length, result.lines.length); i++) {
      expect(result.lines[i]).toBe(expected[i]);
    }
    expect(result.lines.length).toBe(expected.length);
  });
});
```

- [ ] **Step 3: Document differences in DIFFERENCES.md**
- [ ] **Step 4: Commit**

### Task 14: Property-based tests

**Files:**
- Create: `test/unit/property.test.ts`

- [ ] **Step 1: Write property tests with fast-check**

```typescript
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatBalance, formatDate, padLeft, padRight } from "../../src/core/formatting.js";

describe("property: formatting invariants", () => {
  it("formatBalance always returns 15 chars", () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 999999999999.999, noNaN: true }), (n) => {
      expect(formatBalance(n)).toHaveLength(15);
    }));
  });

  it("padLeft always returns exactly n chars", () => {
    fc.assert(fc.property(fc.string(), fc.integer({ min: 1, max: 100 }), (s, n) => {
      expect(padLeft(s, n, "0")).toHaveLength(n);
    }));
  });

  it("padRight always returns exactly n chars", () => {
    fc.assert(fc.property(fc.string(), fc.integer({ min: 1, max: 100 }), (s, n) => {
      expect(padRight(s, n)).toHaveLength(n);
    }));
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "test: integration, golden file, and property-based tests"
```

---

## Chunk 7: CI/CD, Docker & Packaging

### Task 15: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/build.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/security-scan.yml`

- [ ] **Step 1: Create build.yml**

```yaml
name: build
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  quality:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run lint
      - run: npm audit --audit-level=high || true

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    needs: test
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: image
        shell: bash
        env: { REPO: '${{ github.repository }}' }
        run: echo "name=${REPO,,}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v6
        with:
          push: true
          file: Dockerfile
          tags: ghcr.io/${{ steps.image.outputs.name }}:main
```

- [ ] **Step 2: Create release.yml with Bun binary compilation**
- [ ] **Step 3: Create security-scan.yml**
- [ ] **Step 4: Commit**

### Task 16: Dockerfile & docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create multi-stage Dockerfile**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENTRYPOINT ["node", "dist/cli.js"]
```

- [ ] **Step 2: Create docker-compose.yml with MinIO**

```yaml
services:
  s3:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5
  s3-init:
    image: quay.io/minio/mc:latest
    depends_on:
      s3: { condition: service_healthy }
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://s3:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/camt local/coda local/archive local/error;
      "
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: CI/CD workflows, Dockerfile, docker-compose"
```

---

## Chunk 8: Documentation & Migration

### Task 17: Documentation

**Files:**
- Rewrite: `README.md`
- Rewrite: `docs/architecture.md`
- Rewrite: `docs/user-guide.md`
- Keep: `docs/format-guide.md` (format-specific, not implementation-specific)
- Rewrite: `docs/releasing.md`
- Rewrite: `CONTRIBUTING.md`
- Create: `CHANGELOG.md` entry for v2.0.0

- [ ] **Step 1: Rewrite README.md for TypeScript version**

Update badges (remove Java badge, add Node badge), update architecture diagram, update quick start instructions, update feature list.

- [ ] **Step 2: Rewrite other docs**
- [ ] **Step 3: Commit**

### Task 18: Remove Java & Go, finalize migration

**Files:**
- Delete: `java/` directory
- Delete: `go/` directory
- Keep: `example-files/`, `specifications/`, `docs/`

- [ ] **Step 1: Remove legacy code**

```bash
rm -rf java/ go/
```

- [ ] **Step 2: Update .gitignore**

Remove Java-specific entries, add Node-specific:
```
node_modules/
dist/
*.tgz
```

- [ ] **Step 3: Final verification**

```bash
npm test               # all tests pass
npm run build          # TypeScript compiles
npm run test:coverage  # >90% coverage
npx tsx src/cli.ts convert -i example-files/CAMT/Other/ -o /tmp/final-test/  # batch conversion works
```

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "chore: remove Java/Go legacy code, finalize TypeScript migration"
git push origin ts-rewrite
```

- [ ] **Step 5: Create PR and merge**

```bash
gh pr create --base main --head ts-rewrite --title "TypeScript rewrite: CAMT-to-CODA v2.0" --body "..."
```

- [ ] **Step 6: Tag and release**

```bash
git tag -a v2.0.0 -m "TypeScript rewrite"
git push origin v2.0.0
```

---

## Summary

| Chunk | Tasks | What it builds |
|-------|-------|----------------|
| 1 | 1-3 | Project scaffold, types, formatting with tests |
| 2 | 4 | Record builders (0-9, 21-23, 31-33) split into files |
| 3 | 5-6 | Holiday calculator, validation |
| 4 | 7-8 | Storage abstraction (filesystem + S3) |
| 5 | 9-11 | CLI, anonymizer, web UI |
| 6 | 12-14 | Integration tests, golden files, property tests |
| 7 | 15-16 | CI/CD, Docker |
| 8 | 17-18 | Documentation, Java/Go removal, release |

Each chunk produces a working, testable increment. Chunks 1-4 are the core. Chunks 5-8 are the shell around it.
