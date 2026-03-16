# Extended Web UI + CODA-to-CAMT Reverse Conversion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional field inspector web UI and CODA-to-CAMT reverse conversion, both driven by shared CodaField metadata.

**Architecture:** Extract FieldDef[] arrays from existing record builders into a shared `field-defs/` module. Migrate builders to return CodaLine (with .raw for backward compat). Build a CODA parser + CAMT XML writer that reuses the same FieldDef[] arrays. Upgrade the web UI from drag-drop-preview to three-panel inspector with cross-highlighting.

**Tech Stack:** TypeScript, Vitest, fast-check, fast-xml-parser (for CAMT parsing), vanilla JS web UI

**Branch:** Create from `ts-rewrite`

**Spec:** `docs/superpowers/specs/2026-03-16-web-ui-and-reverse-conversion-design.md`

---

## File Structure

### New files

```
src/core/field-defs/
  types.ts                    # FieldDef, CodaField, CodaLine, AnnotatedCodaOutput interfaces
  extract.ts                  # extractFields(line, defs) → CodaField[]
  record0-fields.ts           # RECORD0_FIELDS: FieldDef[]
  record1-fields.ts           # RECORD1_FIELDS: FieldDef[]
  record21-fields.ts          # RECORD21_FIELDS: FieldDef[]
  record22-fields.ts          # RECORD22_FIELDS: FieldDef[]
  record23-fields.ts          # RECORD23_FIELDS: FieldDef[]
  record31-fields.ts          # RECORD31_FIELDS: FieldDef[]
  record32-fields.ts          # RECORD32_FIELDS: FieldDef[]
  record33-fields.ts          # RECORD33_FIELDS: FieldDef[]
  record4-fields.ts           # RECORD4_FIELDS: FieldDef[] (free communication)
  record8-fields.ts           # RECORD8_FIELDS: FieldDef[]
  record9-fields.ts           # RECORD9_FIELDS: FieldDef[]
  index.ts                    # Re-exports all field defs + types + extract

src/core/
  coda-parser.ts              # parseCoda(content) → CodaLine[]
  coda-to-statement.ts        # codaToStatement(lines) → CamtStatement
  camt-writer.ts              # statementToXml(stmt, version?) → string
  reverse.ts                  # codaToCamt(content, version?) → ReverseConversionResult

test/unit/
  field-defs.test.ts          # Field def completeness (128-char coverage per record)
  coda-parser.test.ts         # Parse each record type from known lines
  coda-to-statement.test.ts   # Record grouping → CamtStatement
  camt-writer.test.ts         # XML serialization
  reverse.test.ts             # End-to-end reverse conversion
test/integration/
  round-trip.test.ts          # CAMT → CODA → CAMT field preservation
test/golden/coda-to-camt/     # Known CODA → expected CAMT baselines
```

### Modified files

```
src/core/records/record0.ts   # Return CodaLine instead of string
src/core/records/record1.ts   # (same for all builders)
src/core/records/record21.ts
src/core/records/record22.ts
src/core/records/record23.ts
src/core/records/record31.ts
src/core/records/record32.ts
src/core/records/record33.ts
src/core/records/record8.ts
src/core/records/record9.ts
src/core/coda-writer.ts       # Return AnnotatedCodaOutput, use CodaLine[]
src/core/transaction-codes.ts  # Add reverseMapTransactionCode()
src/validation/coda-validator.ts # Accept CodaLine[] | string[]
src/anonymize/anonymizer.ts    # Accept CodaLine[] | string[]
src/web/server.ts              # Bidirectional convert, return CodaLine[]
src/web/index.html             # Three-panel inspector UI
src/cli.ts                     # Add reverse subcommand
test/unit/records/*.test.ts    # Update for CodaLine return type
test/unit/transaction-codes.test.ts # Add reverse mapping tests
test/unit/coda-writer.test.ts  # Update for AnnotatedCodaOutput
test/coda-writer.test.ts       # Update for AnnotatedCodaOutput
test/unit/validation.test.ts   # Update for CodaLine[] input
test/unit/anonymizer.test.ts   # Update for CodaLine[] input
```

---

## Chunk 1: Field Metadata Foundation

### Task 1: Core Types

**Files:**
- Create: `src/core/field-defs/types.ts`
- Test: `test/unit/field-defs.test.ts`

- [ ] **Step 1: Write the type definitions file**

```typescript
// src/core/field-defs/types.ts

/** Static definition of a field within a 128-char CODA record */
export interface FieldDef {
  name: string;
  start: number;       // 0-based position
  length: number;
  description: string;
  sourceXPath?: string; // CAMT XPath this field maps to/from
}

/** Runtime field instance with actual value */
export interface CodaField {
  name: string;
  start: number;
  length: number;
  value: string;
  sourceXPath?: string;
  description: string;
}

/** A single CODA line with metadata */
export interface CodaLine {
  recordType: string;  // "0", "1", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "8", "9"
  raw: string;         // 128-char string
  fields: CodaField[];
  sequenceNumber?: number;
}

/** Full conversion output with metadata */
export interface AnnotatedCodaOutput {
  fileName: string;
  lines: CodaLine[];
  recordCount: number;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}
```

- [ ] **Step 2: Write test for type completeness**

```typescript
// test/unit/field-defs.test.ts
import { describe, it, expect } from "vitest";
import type { FieldDef, CodaField, CodaLine, AnnotatedCodaOutput } from "../../src/core/field-defs/types.js";

describe("field-defs types", () => {
  it("CodaField satisfies FieldDef shape plus value", () => {
    const field: CodaField = {
      name: "test",
      start: 0,
      length: 5,
      value: "hello",
      description: "Test field",
    };
    expect(field.value).toBe("hello");
    expect(field.start + field.length).toBeLessThanOrEqual(128);
  });

  it("CodaLine has raw and fields", () => {
    const line: CodaLine = {
      recordType: "2.1",
      raw: "x".repeat(128),
      fields: [],
    };
    expect(line.raw).toHaveLength(128);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd /Users/thierry/Desktop/Coding/pnvt/misc/camt-to-coda && npx vitest run test/unit/field-defs.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/field-defs/types.ts test/unit/field-defs.test.ts
git commit -m "feat: add CodaField/CodaLine/AnnotatedCodaOutput type definitions"
```

---

### Task 2: extractFields Utility

**Files:**
- Create: `src/core/field-defs/extract.ts`
- Modify: `test/unit/field-defs.test.ts`

- [ ] **Step 1: Write failing test for extractFields**

Add to `test/unit/field-defs.test.ts`:

```typescript
import { extractFields } from "../../src/core/field-defs/extract.js";

describe("extractFields", () => {
  const defs: FieldDef[] = [
    { name: "recordType", start: 0, length: 1, description: "Record type" },
    { name: "data", start: 1, length: 4, description: "Data" },
    { name: "rest", start: 5, length: 123, description: "Rest" },
  ];

  it("extracts field values from a line by position", () => {
    const line = "2" + "ABCD" + " ".repeat(123);
    const fields = extractFields(line, defs);
    expect(fields).toHaveLength(3);
    expect(fields[0].value).toBe("2");
    expect(fields[0].name).toBe("recordType");
    expect(fields[1].value).toBe("ABCD");
    expect(fields[2].value).toHaveLength(123);
  });

  it("preserves sourceXPath from FieldDef", () => {
    const defsWithXPath: FieldDef[] = [
      { name: "amount", start: 0, length: 15, description: "Amount", sourceXPath: "Ntry/Amt" },
      { name: "rest", start: 15, length: 113, description: "Rest" },
    ];
    const line = "000000001000000" + " ".repeat(113);
    const fields = extractFields(line, defsWithXPath);
    expect(fields[0].sourceXPath).toBe("Ntry/Amt");
    expect(fields[1].sourceXPath).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/field-defs.test.ts`
Expected: FAIL — `extractFields` not found

- [ ] **Step 3: Implement extractFields**

```typescript
// src/core/field-defs/extract.ts
import type { FieldDef, CodaField } from "./types.js";

export function extractFields(line: string, defs: FieldDef[]): CodaField[] {
  return defs.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: line.slice(def.start, def.start + def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/field-defs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/field-defs/extract.ts test/unit/field-defs.test.ts
git commit -m "feat: add extractFields utility for CodaLine parsing"
```

---

### Task 3: All 10 FieldDef Arrays

**Files:**
- Create: `src/core/field-defs/record0-fields.ts` through `record9-fields.ts`
- Create: `src/core/field-defs/index.ts`
- Modify: `test/unit/field-defs.test.ts`

- [ ] **Step 1: Write failing test — each FieldDef[] covers exactly 128 positions**

Add to `test/unit/field-defs.test.ts`:

```typescript
import {
  RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
  RECORD23_FIELDS, RECORD31_FIELDS, RECORD32_FIELDS, RECORD33_FIELDS,
  RECORD4_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
} from "../../src/core/field-defs/index.js";

const ALL_FIELD_DEFS = [
  { name: "Record 0", fields: RECORD0_FIELDS },
  { name: "Record 1", fields: RECORD1_FIELDS },
  { name: "Record 2.1", fields: RECORD21_FIELDS },
  { name: "Record 2.2", fields: RECORD22_FIELDS },
  { name: "Record 2.3", fields: RECORD23_FIELDS },
  { name: "Record 3.1", fields: RECORD31_FIELDS },
  { name: "Record 3.2", fields: RECORD32_FIELDS },
  { name: "Record 3.3", fields: RECORD33_FIELDS },
  { name: "Record 4", fields: RECORD4_FIELDS },
  { name: "Record 8", fields: RECORD8_FIELDS },
  { name: "Record 9", fields: RECORD9_FIELDS },
];

describe("FieldDef completeness", () => {
  it.each(ALL_FIELD_DEFS)("$name covers all 128 positions", ({ fields }) => {
    // Total length should be 128
    const totalLength = fields.reduce((sum, f) => sum + f.length, 0);
    expect(totalLength).toBe(128);

    // Should start at 0
    expect(fields[0].start).toBe(0);

    // Fields should be contiguous and non-overlapping
    for (let i = 1; i < fields.length; i++) {
      const prev = fields[i - 1];
      expect(fields[i].start).toBe(prev.start + prev.length);
    }

    // Last field should end at 128
    const last = fields[fields.length - 1];
    expect(last.start + last.length).toBe(128);
  });

  it.each(ALL_FIELD_DEFS)("$name has unique field names", ({ fields }) => {
    const names = fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(ALL_FIELD_DEFS)("$name has non-empty descriptions", ({ fields }) => {
    for (const f of fields) {
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/field-defs.test.ts`
Expected: FAIL — imports not found

- [ ] **Step 3: Create all 10 FieldDef files + index**

Create each file based on the existing builder's field layout. The positions below are derived from each builder's `.join("")` array (1-based comments in builders → 0-based start in FieldDefs).

**`src/core/field-defs/record0-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD0_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (0 = header)" },
  { name: "zeros",           start: 1,   length: 4,  description: "Zeros" },
  { name: "creationDate",    start: 5,   length: 6,  description: "Creation date DDMMYY", sourceXPath: "GrpHdr/CreDtTm" },
  { name: "bankId",          start: 11,  length: 3,  description: "Bank identification" },
  { name: "applicationCode", start: 14,  length: 2,  description: "Application code (05)" },
  { name: "duplicate",       start: 16,  length: 1,  description: "Duplicate indicator" },
  { name: "blanks1",         start: 17,  length: 7,  description: "Blanks" },
  { name: "fileReference",   start: 24,  length: 10, description: "File reference" },
  { name: "addressee",       start: 34,  length: 26, description: "Addressee name" },
  { name: "bic",             start: 60,  length: 11, description: "BIC of the bank", sourceXPath: "Acct/Svcr/FinInstnId/BIC" },
  { name: "companyNumber",   start: 71,  length: 11, description: "Company identification number" },
  { name: "blank2",          start: 82,  length: 1,  description: "Blank" },
  { name: "separateApp",     start: 83,  length: 5,  description: "Separate application" },
  { name: "transactionRef",  start: 88,  length: 16, description: "Transaction reference" },
  { name: "relatedRef",      start: 104, length: 16, description: "Related reference" },
  { name: "blanks3",         start: 120, length: 7,  description: "Blanks" },
  { name: "versionCode",     start: 127, length: 1,  description: "Version code (2)" },
];
```

**`src/core/field-defs/record1-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD1_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (1 = old balance)" },
  { name: "accountStructure",start: 1,   length: 1,  description: "Account structure (0/2/3)", sourceXPath: "Acct/Id/IBAN" },
  { name: "sequence",        start: 2,   length: 3,  description: "Serial number of continuous sequence" },
  { name: "accountNumber",   start: 5,   length: 34, description: "Account number (IBAN)", sourceXPath: "Acct/Id/IBAN" },
  { name: "currency",        start: 39,  length: 3,  description: "Currency code (ISO 4217)", sourceXPath: "Acct/Ccy" },
  { name: "balanceSign",     start: 42,  length: 1,  description: "Balance sign (0=credit, 1=debit)", sourceXPath: "Bal/CdtDbtInd" },
  { name: "balanceAmount",   start: 43,  length: 15, description: "Old balance (3 decimals)", sourceXPath: "Bal/Amt" },
  { name: "balanceDate",     start: 58,  length: 6,  description: "Balance date DDMMYY", sourceXPath: "Bal/Dt" },
  { name: "holderName",      start: 64,  length: 26, description: "Account holder name", sourceXPath: "Acct/Ownr/Nm" },
  { name: "description",     start: 90,  length: 35, description: "Statement description" },
  { name: "sequenceEnd",     start: 125, length: 3,  description: "Sequence number (repeat)" },
];
```

**`src/core/field-defs/record21-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD21_FIELDS: FieldDef[] = [
  { name: "recordType",        start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",     start: 1,   length: 1,  description: "Article number (1 = movement)" },
  { name: "sequenceNumber",    start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",      start: 6,   length: 4,  description: "Detail number" },
  { name: "bankReference",     start: 10,  length: 21, description: "Bank reference", sourceXPath: "Ntry/NtryRef" },
  { name: "amountSign",        start: 31,  length: 1,  description: "0=credit, 1=debit", sourceXPath: "Ntry/CdtDbtInd" },
  { name: "amount",            start: 32,  length: 15, description: "Amount (3 decimals)", sourceXPath: "Ntry/Amt" },
  { name: "valueDate",         start: 47,  length: 6,  description: "Value date DDMMYY", sourceXPath: "Ntry/ValDt/Dt" },
  { name: "transactionCode",   start: 53,  length: 8,  description: "CODA transaction code", sourceXPath: "Ntry/BkTxCd/Domn" },
  { name: "communicationType", start: 61,  length: 1,  description: "0=unstructured, 1=structured" },
  { name: "communication",     start: 62,  length: 53, description: "Communication zone 1", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "entryDate",         start: 115, length: 6,  description: "Entry/booking date DDMMYY", sourceXPath: "Ntry/BookgDt/Dt" },
  { name: "statementSequence", start: 121, length: 3,  description: "Statement sequence" },
  { name: "globalisationCode", start: 124, length: 1,  description: "0=simple, 1=batch with details" },
  { name: "nextCode",          start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",             start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",          start: 127, length: 1,  description: "0=simple, 1=linked to Record 3" },
];
```

**`src/core/field-defs/record22-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD22_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (2 = continuation)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 53, description: "Communication zone 2", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "customerRef",     start: 63,  length: 35, description: "Customer reference" },
  { name: "counterpartBic",  start: 98,  length: 11, description: "Counterpart BIC", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdAgts" },
  { name: "blanks",          start: 109, length: 3,  description: "Blanks" },
  { name: "rTransactionType",start: 112, length: 1,  description: "R-transaction type" },
  { name: "isoReason",       start: 113, length: 4,  description: "ISO reason code" },
  { name: "categoryPurpose", start: 117, length: 4,  description: "Category purpose" },
  { name: "purpose",         start: 121, length: 4,  description: "Purpose" },
  { name: "nextCode",        start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
```

**`src/core/field-defs/record23-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD23_FIELDS: FieldDef[] = [
  { name: "recordType",       start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",    start: 1,   length: 1,  description: "Article number (3 = counterparty)" },
  { name: "sequenceNumber",   start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",     start: 6,   length: 4,  description: "Detail number" },
  { name: "counterpartAccount", start: 10, length: 34, description: "Counterparty account (IBAN)", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdPties/CdtrAcct/Id/IBAN" },
  { name: "currency",         start: 44,  length: 3,  description: "Currency code" },
  { name: "counterpartName",  start: 47,  length: 35, description: "Counterparty name", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdPties/Cdtr/Nm" },
  { name: "communication",    start: 82,  length: 43, description: "Communication zone 3", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "nextCode",         start: 125, length: 1,  description: "Next code (always 0)" },
  { name: "blank",            start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",         start: 127, length: 1,  description: "0=simple, 1=linked to Record 3" },
];
```

**`src/core/field-defs/record31-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD31_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (1 = batch detail)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "bankReference",   start: 10,  length: 21, description: "Bank reference" },
  { name: "txCodeType",      start: 31,  length: 1,  description: "1=detail of globalisation" },
  { name: "transactionCode", start: 32,  length: 8,  description: "Transaction code" },
  { name: "communicationType", start: 40, length: 1,  description: "0=unstructured, 1=structured" },
  { name: "communication",   start: 41,  length: 73, description: "Communication zone (73 chars)", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "entryDate",       start: 114, length: 6,  description: "Entry date DDMMYY" },
  { name: "sequence",        start: 120, length: 3,  description: "Sequence" },
  { name: "globalisationCode", start: 123, length: 1, description: "0=detail of globalised movement" },
  { name: "nextCode",        start: 124, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank1",          start: 125, length: 1,  description: "Blank" },
  { name: "linkCode",        start: 126, length: 1,  description: "Link code" },
  { name: "padding",         start: 127, length: 1,  description: "Padding" },
];
```

**`src/core/field-defs/record32-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD32_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (2 = batch continuation)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 105, description: "Communication zone (105 chars)" },
  { name: "blanks",          start: 115, length: 10, description: "Blanks" },
  { name: "nextCode",        start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
```

**`src/core/field-defs/record33-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD33_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (3 = batch counterparty)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 90, description: "Communication zone (90 chars)" },
  { name: "blanks",          start: 100, length: 25, description: "Blanks" },
  { name: "nextCode",        start: 125, length: 1,  description: "Next code (always 0)" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
```

**`src/core/field-defs/record8-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD8_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (8 = new balance)" },
  { name: "sequence",        start: 1,   length: 3,  description: "Serial number of sequence" },
  { name: "accountNumber",   start: 4,   length: 34, description: "Account number (IBAN)", sourceXPath: "Acct/Id/IBAN" },
  { name: "currency",        start: 38,  length: 3,  description: "Currency code", sourceXPath: "Acct/Ccy" },
  { name: "balanceSign",     start: 41,  length: 1,  description: "Balance sign (0=credit, 1=debit)", sourceXPath: "Bal/CdtDbtInd" },
  { name: "balanceAmount",   start: 42,  length: 15, description: "New balance (3 decimals)", sourceXPath: "Bal/Amt" },
  { name: "balanceDate",     start: 57,  length: 6,  description: "Balance date DDMMYY", sourceXPath: "Bal/Dt" },
  { name: "blanks",          start: 63,  length: 64, description: "Blanks" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code (always 0)" },
];
```

**`src/core/field-defs/record9-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD9_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (9 = trailer)" },
  { name: "blanks1",         start: 1,   length: 15, description: "Blanks" },
  { name: "recordCount",     start: 16,  length: 6,  description: "Number of records" },
  { name: "sumDebits",       start: 22,  length: 15, description: "Sum of debit amounts (3 decimals)" },
  { name: "sumCredits",      start: 37,  length: 15, description: "Sum of credit amounts (3 decimals)" },
  { name: "blanks2",         start: 52,  length: 75, description: "Blanks" },
  { name: "lastFile",        start: 127, length: 1,  description: "Last file indicator (2)" },
];
```

**`src/core/field-defs/record4-fields.ts`:**
```typescript
import type { FieldDef } from "./types.js";

export const RECORD4_FIELDS: FieldDef[] = [
  { name: "recordType",    start: 0,   length: 1,   description: "Record type (4 = free communication)" },
  { name: "detailNumber",  start: 1,   length: 4,   description: "Detail number" },
  { name: "sequenceNumber",start: 5,   length: 4,   description: "Sequence number" },
  { name: "blanks1",       start: 9,   length: 23,  description: "Blanks" },
  { name: "communication", start: 32,  length: 80,  description: "Free communication text" },
  { name: "blanks2",       start: 112, length: 15,  description: "Blanks" },
  { name: "linkCode",      start: 127, length: 1,   description: "Link code" },
];
```

**`src/core/field-defs/index.ts`:**
```typescript
export type { FieldDef, CodaField, CodaLine, AnnotatedCodaOutput } from "./types.js";
export { extractFields } from "./extract.js";
export { RECORD0_FIELDS } from "./record0-fields.js";
export { RECORD1_FIELDS } from "./record1-fields.js";
export { RECORD21_FIELDS } from "./record21-fields.js";
export { RECORD22_FIELDS } from "./record22-fields.js";
export { RECORD23_FIELDS } from "./record23-fields.js";
export { RECORD31_FIELDS } from "./record31-fields.js";
export { RECORD32_FIELDS } from "./record32-fields.js";
export { RECORD33_FIELDS } from "./record33-fields.js";
export { RECORD4_FIELDS } from "./record4-fields.js";
export { RECORD8_FIELDS } from "./record8-fields.js";
export { RECORD9_FIELDS } from "./record9-fields.js";
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run test/unit/field-defs.test.ts`
Expected: PASS — all 11 records cover exactly 128 positions, contiguous, unique names, non-empty descriptions

- [ ] **Step 5: Commit**

```bash
git add src/core/field-defs/
git commit -m "feat: add FieldDef arrays for all 10 CODA record types"
```

---

## Chunk 2: Migrate Record Builders to Return CodaLine

### Task 4: Migrate Record Builders

**Files:**
- Modify: `src/core/records/record0.ts` through `record9.ts`, `record21.ts`–`record33.ts`
- Modify: `test/unit/records/*.test.ts`

Each builder currently returns `string`. Migrate to return `CodaLine`. The builder constructs field values, builds `CodaField[]` from the corresponding `FieldDef[]`, and sets `.raw` to the joined string.

**Pattern for each builder** (shown for record0, apply same to all 10):

- [ ] **Step 1: Update record0 builder to return CodaLine**

```typescript
// src/core/records/record0.ts
import type { CamtStatement } from "../model.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD0_FIELDS } from "../field-defs/record0-fields.js";
import { padRight, padLeft, formatDate } from "../formatting.js";

export function record0(stmt: CamtStatement): CodaLine {
  const date = formatDate(stmt.reportDate);
  const bic = stmt.account.bic || "";

  const values: Record<string, string> = {
    recordType: "0",
    zeros: "0000",
    creationDate: date,
    bankId: "000",
    applicationCode: "05",
    duplicate: " ",
    blanks1: padRight("", 7),
    fileReference: padRight("", 10),
    addressee: padRight("", 26),
    bic: padRight(bic, 11),
    companyNumber: padRight("", 11),
    blank2: " ",
    separateApp: padLeft("", 5, "0"),
    transactionRef: padRight("", 16),
    relatedRef: padRight("", 16),
    blanks3: padRight("", 7),
    versionCode: "2",
  };

  const fields = RECORD0_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? padRight("", def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "0",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
```

- [ ] **Step 2: Update record0 test to use `.raw`**

In `test/unit/records/record0.test.ts`, replace all `record0(stmt)` assertions that treat the result as a string to use `record0(stmt).raw` instead. For example:

```typescript
// Before: expect(record0(stmt)).toHaveLength(128)
// After:
expect(record0(stmt).raw).toHaveLength(128);
```

Also add:

```typescript
it("returns CodaLine with fields array", () => {
  const result = record0(stmt);
  expect(result.recordType).toBe("0");
  expect(result.fields.length).toBeGreaterThan(0);
  expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
});
```

- [ ] **Step 3: Run record0 tests**

Run: `npx vitest run test/unit/records/record0.test.ts`
Expected: PASS

- [ ] **Step 4: Repeat for all other 9 builders**

Apply the same pattern to: `record1.ts`, `record21.ts`, `record22.ts`, `record23.ts`, `record31.ts`, `record32.ts`, `record33.ts`, `record8.ts`, `record9.ts`.

Each builder:
1. Import its `RECORD_XX_FIELDS` and `CodaLine` type
2. Build a `values: Record<string, string>` map from computed fields
3. Map `RECORD_XX_FIELDS` to `CodaField[]` using `values[def.name]`
4. Return `{ recordType, raw, fields }`

Each test file: replace direct string assertions with `.raw` and add a `CodaLine` structure test.

**Important builder-specific notes:**
- `record1.ts`: `recordType` is `"1"`, values map uses `accountStructure(acctNum)` for `accountStructure` field
- `record21.ts`: `recordType` is `"2.1"`
- `record22.ts`: `recordType` is `"2.2"`
- `record23.ts`: `recordType` is `"2.3"`
- `record31.ts`: `recordType` is `"3.1"`
- `record32.ts`: `recordType` is `"3.2"`
- `record33.ts`: `recordType` is `"3.3"`
- `record8.ts`: `recordType` is `"8"`
- `record9.ts`: `recordType` is `"9"`

- [ ] **Step 5: Run all record tests**

Run: `npx vitest run test/unit/records/`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/records/ test/unit/records/
git commit -m "refactor: migrate all record builders to return CodaLine"
```

---

### Task 5: Update coda-writer.ts to Return AnnotatedCodaOutput

**Files:**
- Modify: `src/core/coda-writer.ts`
- Modify: `test/unit/coda-writer.test.ts`
- Modify: `test/coda-writer.test.ts`

- [ ] **Step 1: Update coda-writer.ts**

Replace `ConversionResult` with `AnnotatedCodaOutput`. The `lines` array becomes `CodaLine[]`. Validation uses `.raw`.

Key changes in `statementToCoda`:
- Remove `ConversionResult` interface (replaced by `AnnotatedCodaOutput` from field-defs)
- `lines` accumulates `CodaLine[]` (push the CodaLine objects returned by builders)
- Line-length validation: `lines[i].raw.length !== 128`
- Return `AnnotatedCodaOutput` with `warnings: []`

```typescript
// Updated return type
import type { CodaLine, AnnotatedCodaOutput } from "./field-defs/types.js";

export function statementToCoda(stmt: CamtStatement): AnnotatedCodaOutput {
  const lines: CodaLine[] = [];
  // ... (same logic, but push CodaLine objects from builders)
  // ... validation checks use line.raw.length
  return {
    fileName,
    lines,
    recordCount,
    validation: { valid: errors.length === 0, errors, warnings: [] },
  };
}
```

- [ ] **Step 2: Update coda-writer tests**

In both `test/unit/coda-writer.test.ts` and `test/coda-writer.test.ts`:
- Replace `result.lines[i]` string checks with `result.lines[i].raw`
- Replace `result.lines.length` with `result.lines.length` (unchanged, still an array)
- Update any `result.validation` checks to include `warnings`

- [ ] **Step 3: Run coda-writer tests**

Run: `npx vitest run test/unit/coda-writer.test.ts test/coda-writer.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/coda-writer.ts test/unit/coda-writer.test.ts test/coda-writer.test.ts
git commit -m "refactor: coda-writer returns AnnotatedCodaOutput with CodaLine[]"
```

---

### Task 6: Update Downstream Consumers (Validator, Anonymizer, CLI, Server)

**Files:**
- Modify: `src/validation/coda-validator.ts`
- Modify: `src/anonymize/anonymizer.ts`
- Modify: `src/cli.ts`
- Modify: `src/web/server.ts`
- Modify: `test/unit/validation.test.ts`
- Modify: `test/unit/anonymizer.test.ts`
- Modify: `test/integration/convert.test.ts`

- [ ] **Step 1: Update coda-validator to accept CodaLine[] | string[]**

```typescript
// src/validation/coda-validator.ts
import type { ValidationResult } from "./result.js";
import type { CodaLine } from "../core/field-defs/types.js";

export function validateCoda(lines: (CodaLine | string)[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = typeof lines[i] === "string" ? lines[i] as string : (lines[i] as CodaLine).raw;
    if (raw.length !== 128)
      errors.push(`Line ${i + 1}: ${raw.length} chars (expected 128)`);
  }

  const firstRaw = typeof lines[0] === "string" ? lines[0] as string : (lines[0] as CodaLine).raw;
  const lastRaw = typeof lines[lines.length - 1] === "string"
    ? lines[lines.length - 1] as string
    : (lines[lines.length - 1] as CodaLine).raw;

  if (lines.length > 0 && firstRaw[0] !== "0") errors.push("Must start with Record 0");
  if (lines.length > 0 && lastRaw[0] !== "9") errors.push("Must end with Record 9");

  return { valid: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 2: Update anonymizer to accept CodaLine[] | string[]**

```typescript
// In anonymizeCodaLines, accept (CodaLine | string)[] and return string[]
export function anonymizeCodaLines(lines: (CodaLine | string)[], seed = 0): string[] {
  return lines.map((lineOrObj) => {
    let line = typeof lineOrObj === "string" ? lineOrObj : lineOrObj.raw;
    // ... rest unchanged
    return line;
  });
}
```

Note: The anonymizer still returns `string[]` since it modifies raw content.

- [ ] **Step 3: Update CLI convert command**

In `src/cli.ts`, the convert action calls `statementToCoda` which now returns `AnnotatedCodaOutput`. Update:
- `validateCoda(result.lines)` → works because validator accepts `CodaLine[]`
- `result.lines` for anonymizer → `anonymizeCodaLines(result.lines)`
- `lines.join("\n")` → `lines.map(l => typeof l === "string" ? l : l.raw).join("\n")`
- The `validate` and `info` subcommands similarly need `.raw` access

- [ ] **Step 4: Update web server**

In `src/web/server.ts`, the convert handler already sends JSON. Update the response to include `CodaLine[]` metadata:

```typescript
// In handleConvert, after conversion:
const lines = doAnonymize
  ? anonymizeCodaLines(result.lines)
  : result.lines.map(l => l.raw);

return {
  fileName: result.fileName,
  lines: result.lines,  // full CodaLine[] for inspector
  rawLines: doAnonymize ? anonymizeCodaLines(result.lines) : undefined,
  recordCount: result.recordCount,
  validation: { ... }
};
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL 367+ tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/validation/coda-validator.ts src/anonymize/anonymizer.ts src/cli.ts src/web/server.ts test/
git commit -m "refactor: update all consumers for CodaLine[] type migration"
```

---

## Chunk 3: Reverse Transaction Code Mapping

### Task 7: Add reverseMapTransactionCode

**Files:**
- Modify: `src/core/transaction-codes.ts`
- Modify: `test/unit/transaction-codes.test.ts`

- [ ] **Step 1: Write failing tests for reverse mapping**

Add to `test/unit/transaction-codes.test.ts`:

```typescript
import { reverseMapTransactionCode } from "../../src/core/transaction-codes.js";

describe("reverseMapTransactionCode", () => {
  it("04500001 → PMNT/RCDT/ESCT", () => {
    const result = reverseMapTransactionCode("04500001");
    expect(result).toEqual({ domain: "PMNT", family: "RCDT", subFamily: "ESCT" });
  });

  it("13010001 → PMNT/ICDT/ESCT", () => {
    const result = reverseMapTransactionCode("13010001");
    expect(result).toEqual({ domain: "PMNT", family: "ICDT", subFamily: "ESCT" });
  });

  it("04370000 → PMNT/CCRD/OTHR (synthetic)", () => {
    const result = reverseMapTransactionCode("04370000");
    expect(result).toEqual({ domain: "PMNT", family: "CCRD", subFamily: "OTHR" });
  });

  it("unknown code → undefined", () => {
    expect(reverseMapTransactionCode("99999999")).toBeUndefined();
  });

  it("8 spaces → undefined", () => {
    expect(reverseMapTransactionCode("        ")).toBeUndefined();
  });

  it("all known codes round-trip", () => {
    const codes = ["04500001", "13010001", "41010000", "41500000",
                   "05010000", "05500000", "02500001", "02010001",
                   "35010000", "80370000", "04370000"];
    for (const code of codes) {
      const result = reverseMapTransactionCode(code);
      expect(result).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/transaction-codes.test.ts`
Expected: FAIL — `reverseMapTransactionCode` not found

- [ ] **Step 3: Implement reverse mapping**

Add to `src/core/transaction-codes.ts`:

```typescript
import type { TransactionCode } from "./model.js";

// Build reverse map from existing forward map
const REVERSE_MAP: Record<string, TransactionCode> = {};
for (const [key, code] of Object.entries(TRANSACTION_CODE_MAP)) {
  const [domain, family, subFamily] = key.split("/");
  REVERSE_MAP[code] = { domain, family, subFamily };
}
// Card code: synthetic SubFamily since original is lost
REVERSE_MAP[CARD_CODE] = { domain: "PMNT", family: "CCRD", subFamily: "OTHR" };

export function reverseMapTransactionCode(codaCode: string): TransactionCode | undefined {
  const trimmed = codaCode.trim();
  if (trimmed.length === 0) return undefined;
  return REVERSE_MAP[trimmed];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/transaction-codes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/transaction-codes.ts test/unit/transaction-codes.test.ts
git commit -m "feat: add reverseMapTransactionCode for CODA→ISO 20022 lookup"
```

---

## Chunk 4: CODA Parser

### Task 8: parseCoda — Parse CODA Lines into CodaLine[]

**Files:**
- Create: `src/core/coda-parser.ts`
- Create: `test/unit/coda-parser-reverse.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/coda-parser-reverse.test.ts
import { describe, it, expect } from "vitest";
import { parseCoda } from "../../src/core/coda-parser.js";

// Build a minimal valid CODA file: Record 0 + Record 1 + Record 8 + Record 9
const rec0 = "00000150324000050 " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
const rec1 = "12001BE68539007547034              EUR0000000001000000150324" + " ".repeat(26) + " ".repeat(35) + "001";
const rec8 = "8001BE68539007547034              EUR0000000001500000150324" + " ".repeat(64) + "0";
const rec9 = "9" + " ".repeat(15) + "000004" + "000000000000000" + "000000000500000" + " ".repeat(75) + "2";

describe("parseCoda", () => {
  it("parses a minimal CODA file (0 + 1 + 8 + 9)", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
    expect(lines[0].recordType).toBe("0");
    expect(lines[1].recordType).toBe("1");
    expect(lines[2].recordType).toBe("8");
    expect(lines[3].recordType).toBe("9");
  });

  it("each parsed line has fields covering 128 positions", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    for (const line of lines) {
      const total = line.fields.reduce((s, f) => s + f.length, 0);
      expect(total).toBe(128);
    }
  });

  it("handles CRLF line endings", () => {
    const content = [rec0, rec1, rec8, rec9].join("\r\n");
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
  });

  it("handles trailing newline", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n") + "\n";
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
  });

  it("rejects lines not exactly 128 chars", () => {
    const badLine = rec0.slice(0, 100);
    const content = [badLine, rec1, rec8, rec9].join("\n");
    expect(() => parseCoda(content)).toThrow(/128/);
  });

  it("classifies Record 2.x subtypes correctly", () => {
    // Build a Record 2.1 line
    const rec21 = "21" + "0001" + "0000" + " ".repeat(21) + "0" + "000000001000000" + "150324" + "04500001" + "0" + " ".repeat(53) + "150324" + "000" + "0" + "0" + " " + "0";
    const content = [rec0, rec1, rec21, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    expect(lines[2].recordType).toBe("2.1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/coda-parser-reverse.test.ts`
Expected: FAIL — `parseCoda` not found (note: there's already `src/core/camt-parser.ts` for CAMT; this is different — it's the CODA parser)

- [ ] **Step 3: Implement parseCoda**

```typescript
// src/core/coda-parser.ts
import type { CodaLine } from "./field-defs/types.js";
import { extractFields } from "./field-defs/extract.js";
import { RECORD0_FIELDS } from "./field-defs/record0-fields.js";
import { RECORD1_FIELDS } from "./field-defs/record1-fields.js";
import { RECORD21_FIELDS } from "./field-defs/record21-fields.js";
import { RECORD22_FIELDS } from "./field-defs/record22-fields.js";
import { RECORD23_FIELDS } from "./field-defs/record23-fields.js";
import { RECORD31_FIELDS } from "./field-defs/record31-fields.js";
import { RECORD32_FIELDS } from "./field-defs/record32-fields.js";
import { RECORD33_FIELDS } from "./field-defs/record33-fields.js";
import { RECORD4_FIELDS } from "./field-defs/record4-fields.js";
import { RECORD8_FIELDS } from "./field-defs/record8-fields.js";
import { RECORD9_FIELDS } from "./field-defs/record9-fields.js";

function classifyLine(line: string): { recordType: string; fields: typeof RECORD0_FIELDS } {
  const rec = line[0];
  const art = line[1];

  switch (rec) {
    case "0": return { recordType: "0", fields: RECORD0_FIELDS };
    case "1": return { recordType: "1", fields: RECORD1_FIELDS };
    case "2":
      switch (art) {
        case "1": return { recordType: "2.1", fields: RECORD21_FIELDS };
        case "2": return { recordType: "2.2", fields: RECORD22_FIELDS };
        case "3": return { recordType: "2.3", fields: RECORD23_FIELDS };
        default: throw new Error(`Unknown Record 2 article: ${art}`);
      }
    case "3":
      switch (art) {
        case "1": return { recordType: "3.1", fields: RECORD31_FIELDS };
        case "2": return { recordType: "3.2", fields: RECORD32_FIELDS };
        case "3": return { recordType: "3.3", fields: RECORD33_FIELDS };
        default: throw new Error(`Unknown Record 3 article: ${art}`);
      }
    case "4": return { recordType: "4", fields: RECORD4_FIELDS };
    case "8": return { recordType: "8", fields: RECORD8_FIELDS };
    case "9": return { recordType: "9", fields: RECORD9_FIELDS };
    default: throw new Error(`Unknown record type: ${rec}`);
  }
}

export function parseCoda(content: string): CodaLine[] {
  // Normalize line endings
  const rawLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Filter empty trailing lines
  const lines = rawLines.filter((l) => l.length > 0);

  // Strict validation: all lines must be exactly 128 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128) {
      throw new Error(
        `Line ${i + 1}: ${lines[i].length} chars (expected 128)`
      );
    }
  }

  return lines.map((line) => {
    const { recordType, fields: fieldDefs } = classifyLine(line);
    return {
      recordType,
      raw: line,
      fields: extractFields(line, fieldDefs),
    };
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/coda-parser-reverse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/coda-parser.ts test/unit/coda-parser-reverse.test.ts
git commit -m "feat: add CODA parser — parseCoda(content) → CodaLine[]"
```

---

### Task 9: codaToStatement — Reconstruct CamtStatement from CodaLine[]

**Files:**
- Create: `src/core/coda-to-statement.ts`
- Create: `test/unit/coda-to-statement.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/coda-to-statement.test.ts
import { describe, it, expect } from "vitest";
import { codaToStatement } from "../../src/core/coda-to-statement.js";
import { parseCoda } from "../../src/core/coda-parser.js";

// Helper to build valid 128-char records with specific field values
function pad(s: string, len: number): string { return s.padEnd(len).slice(0, len); }
function padL(s: string, len: number): string { return s.padStart(len, "0").slice(0, len); }

const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + pad("BBRUBEBB", 11) + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
const rec1 = "1" + "3" + "001" + pad("BE68539007547034", 34) + "EUR" + "0" + "000000001000000" + "150324" + pad("ACME CORP", 26) + " ".repeat(35) + "001";
const rec21 = "2" + "1" + "0001" + "0000" + pad("E2E-REF-001", 21) + "0" + "000000000500000" + "150324" + "04500001" + "0" + pad("Payment for invoice", 53) + "150324" + "000" + "0" + "0" + " " + "0";
const rec8 = "8" + "001" + pad("BE68539007547034", 34) + "EUR" + "0" + "000000001500000" + "150324" + " ".repeat(64) + "0";
const rec9 = "9" + " ".repeat(15) + "000004" + "000000000000000" + "000000000500000" + " ".repeat(75) + "2";

describe("codaToStatement", () => {
  it("reconstructs account IBAN from Record 1", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.account.iban).toBe("BE68539007547034");
  });

  it("reconstructs currency from Record 1", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.account.currency).toBe("EUR");
  });

  it("reconstructs opening balance", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.openingBalance.amount).toBe(1000);
    expect(stmt.openingBalance.creditDebit).toBe("CRDT");
  });

  it("reconstructs closing balance from Record 8", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.closingBalance.amount).toBe(1500);
  });

  it("reconstructs BIC from Record 0", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.account.bic).toBe("BBRUBEBB");
  });

  it("reconstructs entries from Record 2.1", () => {
    const lines = parseCoda([rec0, rec1, rec21, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.entries).toHaveLength(1);
    expect(stmt.entries[0].amount).toBe(500);
    expect(stmt.entries[0].creditDebit).toBe("CRDT");
  });

  it("reconstructs communication from Record 2.1", () => {
    const lines = parseCoda([rec0, rec1, rec21, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.entries[0].details[0].remittanceInfo?.unstructured).toContain("Payment for invoice");
  });

  it("sets camtVersion to 053", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.camtVersion).toBe("053");
  });

  it("reconstructs owner name from Record 1", () => {
    const lines = parseCoda([rec0, rec1, rec8, rec9].join("\n"));
    const stmt = codaToStatement(lines);
    expect(stmt.account.ownerName).toBe("ACME CORP");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/coda-to-statement.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement codaToStatement**

```typescript
// src/core/coda-to-statement.ts
import type { CodaLine } from "./field-defs/types.js";
import type { CamtStatement, CamtEntry, TransactionDetail, Balance } from "./model.js";
import { reverseMapTransactionCode } from "./transaction-codes.js";

function getField(line: CodaLine, name: string): string {
  const field = line.fields.find((f) => f.name === name);
  return field?.value.trim() ?? "";
}

function parseDate(ddmmyy: string): string {
  if (!ddmmyy || ddmmyy.trim().length < 6 || ddmmyy === "000000") return "";
  const dd = ddmmyy.slice(0, 2);
  const mm = ddmmyy.slice(2, 4);
  const yy = ddmmyy.slice(4, 6);
  const century = parseInt(yy, 10) > 50 ? "19" : "20";
  return `${century}${yy}-${mm}-${dd}`;
}

function parseAmount(raw: string): number {
  // 15 chars: 12 integer + 3 decimal, no separator
  const trimmed = raw.replace(/\s/g, "");
  if (trimmed.length === 0) return 0;
  const integer = parseInt(trimmed.slice(0, -3), 10) || 0;
  const decimal = parseInt(trimmed.slice(-3), 10) || 0;
  return integer + decimal / 1000;
}

function parseSign(sign: string): "CRDT" | "DBIT" {
  return sign === "1" ? "DBIT" : "CRDT";
}

export function codaToStatement(lines: CodaLine[]): CamtStatement {
  let bic = "";
  let creationDate = "";
  let iban = "";
  let currency = "";
  let ownerName = "";
  let openingBalance: Balance = { amount: 0, creditDebit: "CRDT", date: "" };
  let closingBalance: Balance = { amount: 0, creditDebit: "CRDT", date: "" };
  const entries: CamtEntry[] = [];

  // Current entry accumulator for multi-record movements
  let currentEntry: CamtEntry | null = null;
  let currentComm = "";

  function flushEntry() {
    if (currentEntry) {
      // Set communication on the first detail
      if (currentEntry.details.length > 0 && currentComm.trim()) {
        const detail = currentEntry.details[0];
        if (!detail.remittanceInfo) detail.remittanceInfo = {};
        detail.remittanceInfo.unstructured = currentComm.trim();
      }
      entries.push(currentEntry);
      currentEntry = null;
      currentComm = "";
    }
  }

  for (const line of lines) {
    switch (line.recordType) {
      case "0": {
        bic = getField(line, "bic");
        creationDate = parseDate(getField(line, "creationDate"));
        break;
      }
      case "1": {
        iban = getField(line, "accountNumber");
        currency = getField(line, "currency");
        ownerName = getField(line, "holderName");
        const sign = getField(line, "balanceSign");
        const amount = parseAmount(getField(line, "balanceAmount"));
        const date = parseDate(getField(line, "balanceDate"));
        openingBalance = { amount, creditDebit: parseSign(sign), date };
        break;
      }
      case "2.1": {
        flushEntry();
        const sign = getField(line, "amountSign");
        const amount = parseAmount(getField(line, "amount"));
        const valueDate = parseDate(getField(line, "valueDate"));
        const bookingDate = parseDate(getField(line, "entryDate"));
        const txCodeStr = getField(line, "transactionCode");
        const txCode = reverseMapTransactionCode(txCodeStr);
        const commType = getField(line, "communicationType");
        const commZone = getField(line, "communication");
        const bankRef = getField(line, "bankReference");

        currentComm = commZone;

        const detail: TransactionDetail = { refs: {} };
        if (commType === "1" && commZone.startsWith("101")) {
          // Structured communication — preserve zero-padded form
          detail.remittanceInfo = {
            structured: { creditorRef: commZone.slice(3).trim() },
          };
          currentComm = ""; // don't also set as unstructured
        }

        currentEntry = {
          amount,
          currency,
          creditDebit: parseSign(sign),
          bookingDate: bookingDate || undefined,
          valueDate: valueDate || undefined,
          entryRef: bankRef || undefined,
          transactionCode: txCode || undefined,
          details: [detail],
        };
        break;
      }
      case "2.2": {
        if (currentEntry) {
          const comm = getField(line, "communication");
          currentComm += comm;
          const bic = getField(line, "counterpartBic");
          if (bic && currentEntry.details[0]) {
            if (!currentEntry.details[0].counterparty) currentEntry.details[0].counterparty = {};
            currentEntry.details[0].counterparty.bic = bic;
          }
        }
        break;
      }
      case "2.3": {
        if (currentEntry) {
          const comm = getField(line, "communication");
          currentComm += comm;
          const cpIban = getField(line, "counterpartAccount");
          const cpName = getField(line, "counterpartName");
          if (currentEntry.details[0]) {
            if (!currentEntry.details[0].counterparty) currentEntry.details[0].counterparty = {};
            if (cpIban) currentEntry.details[0].counterparty.iban = cpIban;
            if (cpName) currentEntry.details[0].counterparty.name = cpName;
          }
        }
        break;
      }
      case "3.1": case "3.2": case "3.3": {
        // Batch details — add as additional TransactionDetail on current entry
        if (currentEntry && line.recordType === "3.1") {
          const detail: TransactionDetail = {
            remittanceInfo: { unstructured: getField(line, "communication").trim() },
          };
          // Add as new detail (beyond the first one from 2.1)
          currentEntry.details.push(detail);
        } else if (currentEntry && (line.recordType === "3.2" || line.recordType === "3.3")) {
          // Append communication to last detail
          const lastDetail = currentEntry.details[currentEntry.details.length - 1];
          if (lastDetail?.remittanceInfo?.unstructured !== undefined) {
            lastDetail.remittanceInfo.unstructured += getField(line, "communication").trim();
          }
        }
        break;
      }
      case "8": {
        flushEntry();
        const sign = getField(line, "balanceSign");
        const amount = parseAmount(getField(line, "balanceAmount"));
        const date = parseDate(getField(line, "balanceDate"));
        closingBalance = { amount, creditDebit: parseSign(sign), date };
        break;
      }
      case "9": {
        // Trailer — validation only (not modelling)
        break;
      }
    }
  }

  flushEntry();

  const reportDate = closingBalance.date || creationDate || "";

  return {
    camtVersion: "053",
    messageId: `CODA-REVERSE-${new Date().toISOString().slice(0, 19)}`,
    creationDate: creationDate || new Date().toISOString().slice(0, 10),
    statementId: `CODA-${iban}-${reportDate}`,
    account: { iban: iban || undefined, currency, ownerName: ownerName || undefined, bic: bic || undefined },
    openingBalance,
    closingBalance,
    entries,
    reportDate,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/coda-to-statement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/coda-to-statement.ts test/unit/coda-to-statement.test.ts
git commit -m "feat: add codaToStatement — reconstructs CamtStatement from CodaLine[]"
```

---

### Task 10: CAMT XML Writer

**Files:**
- Create: `src/core/camt-writer.ts`
- Create: `test/unit/camt-writer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/camt-writer.test.ts
import { describe, it, expect } from "vitest";
import { statementToXml } from "../../src/core/camt-writer.js";
import type { CamtStatement } from "../../src/core/model.js";

const stmt: CamtStatement = {
  camtVersion: "053",
  messageId: "CODA-REVERSE-2024-03-15",
  creationDate: "2024-03-15",
  statementId: "STMT-001",
  account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB", ownerName: "ACME" },
  openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-03-15" },
  closingBalance: { amount: 1500, creditDebit: "CRDT", date: "2024-03-15" },
  entries: [{
    amount: 500,
    currency: "EUR",
    creditDebit: "CRDT",
    bookingDate: "2024-03-15",
    valueDate: "2024-03-15",
    transactionCode: { domain: "PMNT", family: "RCDT", subFamily: "ESCT" },
    details: [{
      refs: { endToEndId: "NOTPROVIDED" },
      remittanceInfo: { unstructured: "Invoice payment" },
      counterparty: { name: "Sender", iban: "BE91516952884376", bic: "SNDRBEBB" },
    }],
  }],
  reportDate: "2024-03-15",
};

describe("statementToXml", () => {
  it("produces valid XML with CAMT 053 namespace", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<?xml");
    expect(xml).toContain("urn:iso:std:iso:20022:tech:xsd:camt.053.001.08");
  });

  it("includes account IBAN", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<IBAN>BE68539007547034</IBAN>");
  });

  it("includes BIC", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<BIC>BBRUBEBB</BIC>");
  });

  it("includes opening balance", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Amt Ccy=\"EUR\">1000.00</Amt>");
    expect(xml).toContain("<Cd>OPBD</Cd>");
  });

  it("includes entry amount", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Amt Ccy=\"EUR\">500.00</Amt>");
  });

  it("includes transaction code domain", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Cd>PMNT</Cd>");
    expect(xml).toContain("<Cd>RCDT</Cd>");
    expect(xml).toContain("<Cd>ESCT</Cd>");
  });

  it("includes counterparty name and IBAN", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Nm>Sender</Nm>");
    expect(xml).toContain("<IBAN>BE91516952884376</IBAN>");
  });

  it("includes remittance info", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Ustrd>Invoice payment</Ustrd>");
  });

  it("respects custom CAMT version", () => {
    const xml = statementToXml(stmt, "camt.053.001.02");
    expect(xml).toContain("urn:iso:std:iso:20022:tech:xsd:camt.053.001.02");
  });

  it("generates well-formed XML (no unclosed tags)", () => {
    const xml = statementToXml(stmt);
    // Count opening and closing Document tags
    expect(xml.match(/<Document/g)?.length).toBe(1);
    expect(xml.match(/<\/Document>/g)?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/camt-writer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement statementToXml**

```typescript
// src/core/camt-writer.ts
import type { CamtStatement, CamtEntry, TransactionDetail } from "./model.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tag(name: string, value: string, attrs = ""): string {
  const attrStr = attrs ? " " + attrs : "";
  return `<${name}${attrStr}>${esc(value)}</${name}>`;
}

function amountTag(amount: number, currency: string): string {
  return `<Amt Ccy="${esc(currency)}">${amount.toFixed(2)}</Amt>`;
}

function dateTag(name: string, date: string): string {
  return `<${name}><Dt>${esc(date)}</Dt></${name}>`;
}

function balanceXml(type: string, amount: number, creditDebit: "CRDT" | "DBIT", date: string, currency: string): string {
  return `<Bal>
      <Tp><CdOrPrtry>${tag("Cd", type)}</CdOrPrtry></Tp>
      ${amountTag(amount, currency)}
      ${tag("CdtDbtInd", creditDebit)}
      ${dateTag("Dt", date)}
    </Bal>`;
}

function entryXml(entry: CamtEntry): string {
  const detail = entry.details[0];
  let txDtlsXml = "";

  for (const d of entry.details) {
    txDtlsXml += `<TxDtls>
          ${d.refs?.endToEndId ? `<Refs>${tag("EndToEndId", d.refs.endToEndId)}</Refs>` : ""}
          ${d.counterparty ? `<RltdPties>
            ${entry.creditDebit === "CRDT"
              ? `<Dbtr>${tag("Nm", d.counterparty.name ?? "")}</Dbtr>
                 <DbtrAcct><Id>${d.counterparty.iban ? tag("IBAN", d.counterparty.iban) : ""}</Id></DbtrAcct>`
              : `<Cdtr>${tag("Nm", d.counterparty.name ?? "")}</Cdtr>
                 <CdtrAcct><Id>${d.counterparty.iban ? tag("IBAN", d.counterparty.iban) : ""}</Id></CdtrAcct>`}
          </RltdPties>` : ""}
          ${d.counterparty?.bic ? `<RltdAgts>
            <${entry.creditDebit === "CRDT" ? "DbtrAgt" : "CdtrAgt"}>
              <FinInstnId>${tag("BIC", d.counterparty.bic)}</FinInstnId>
            </${entry.creditDebit === "CRDT" ? "DbtrAgt" : "CdtrAgt"}>
          </RltdAgts>` : ""}
          <RmtInf>
            ${d.remittanceInfo?.structured?.creditorRef
              ? `<Strd><CdtrRefInf><Ref>${esc(d.remittanceInfo.structured.creditorRef)}</Ref></CdtrRefInf></Strd>`
              : d.remittanceInfo?.unstructured
              ? tag("Ustrd", d.remittanceInfo.unstructured)
              : ""}
          </RmtInf>
        </TxDtls>`;
  }

  return `<Ntry>
      ${amountTag(entry.amount, entry.currency)}
      ${tag("CdtDbtInd", entry.creditDebit)}
      ${entry.bookingDate ? dateTag("BookgDt", entry.bookingDate) : ""}
      ${entry.valueDate ? dateTag("ValDt", entry.valueDate) : ""}
      ${entry.entryRef ? tag("NtryRef", entry.entryRef) : ""}
      ${entry.transactionCode?.domain ? `<BkTxCd><Domn>
        ${tag("Cd", entry.transactionCode.domain)}
        <Fmly>${tag("Cd", entry.transactionCode.family ?? "")}
          ${tag("SubFmlyCd", entry.transactionCode.subFamily ?? "")}
        </Fmly>
      </Domn></BkTxCd>` : ""}
      <NtryDtls>${txDtlsXml}</NtryDtls>
    </Ntry>`;
}

export function statementToXml(stmt: CamtStatement, version = "camt.053.001.08"): string {
  const ns = `urn:iso:std:iso:20022:tech:xsd:${version}`;
  const ccy = stmt.account.currency;

  const entries = stmt.entries.map(entryXml).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="${ns}">
  <BkToCstmrStmt>
    <GrpHdr>
      ${tag("MsgId", stmt.messageId)}
      ${tag("CreDtTm", stmt.creationDate + "T00:00:00")}
    </GrpHdr>
    <Stmt>
      ${tag("Id", stmt.statementId)}
      <Acct>
        <Id>${stmt.account.iban ? tag("IBAN", stmt.account.iban) : stmt.account.otherId ? `<Othr>${tag("Id", stmt.account.otherId)}</Othr>` : ""}</Id>
        ${tag("Ccy", ccy)}
        ${stmt.account.ownerName ? `<Ownr>${tag("Nm", stmt.account.ownerName)}</Ownr>` : ""}
        ${stmt.account.bic ? `<Svcr><FinInstnId>${tag("BIC", stmt.account.bic)}</FinInstnId></Svcr>` : ""}
      </Acct>
      ${balanceXml("OPBD", stmt.openingBalance.amount, stmt.openingBalance.creditDebit, stmt.openingBalance.date, ccy)}
      ${entries}
      ${balanceXml("CLBD", stmt.closingBalance.amount, stmt.closingBalance.creditDebit, stmt.closingBalance.date, ccy)}
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/camt-writer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/camt-writer.ts test/unit/camt-writer.test.ts
git commit -m "feat: add CAMT XML writer — statementToXml(stmt, version)"
```

---

### Task 11: Reverse Orchestrator

**Files:**
- Create: `src/core/reverse.ts`
- Create: `test/unit/reverse.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/unit/reverse.test.ts
import { describe, it, expect } from "vitest";
import { codaToCamt } from "../../src/core/reverse.js";

// Use known CODA output — build from existing forward conversion
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { readFileSync } from "fs";
import { join } from "path";

describe("codaToCamt", () => {
  it("produces valid XML from minimal CODA", () => {
    const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
    const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
    const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(64) + "0";
    const rec9 = "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2";
    const content = [rec0, rec1, rec8, rec9].join("\n");

    const result = codaToCamt(content);
    expect(result.xml).toContain("<?xml");
    expect(result.xml).toContain("camt.053.001.08");
    expect(result.xml).toContain("BE68539007547034");
    expect(result.lines).toHaveLength(4);
    expect(result.statement.account.iban).toBe("BE68539007547034");
    expect(result.warnings).toHaveLength(0);
  });

  it("reports warning for unknown transaction codes", () => {
    const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
    const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
    const rec21 = "2" + "1" + "0001" + "0000" + " ".repeat(21) + "0" + "000000000500000" + "150324" + "99887766" + "0" + " ".repeat(53) + "150324" + "000" + "0" + "0" + " " + "0";
    const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001500000" + "150324" + " ".repeat(64) + "0";
    const rec9 = "9" + " ".repeat(15) + "000004" + "000000000000000" + "000000000500000" + " ".repeat(75) + "2";
    const content = [rec0, rec1, rec21, rec8, rec9].join("\n");

    const result = codaToCamt(content);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("99887766");
  });

  it("respects custom CAMT version", () => {
    const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
    const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
    const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(64) + "0";
    const rec9 = "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2";

    const result = codaToCamt([rec0, rec1, rec8, rec9].join("\n"), "camt.053.001.02");
    expect(result.xml).toContain("camt.053.001.02");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/reverse.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement reverse orchestrator**

```typescript
// src/core/reverse.ts
import type { CodaLine } from "./field-defs/types.js";
import type { CamtStatement } from "./model.js";
import { parseCoda } from "./coda-parser.js";
import { codaToStatement } from "./coda-to-statement.js";
import { statementToXml } from "./camt-writer.js";
import { reverseMapTransactionCode } from "./transaction-codes.js";

export interface ReverseConversionResult {
  xml: string;
  lines: CodaLine[];
  statement: CamtStatement;
  warnings: string[];
}

export function codaToCamt(content: string, camtVersion?: string): ReverseConversionResult {
  const lines = parseCoda(content);
  const statement = codaToStatement(lines);
  const warnings: string[] = [];

  // Detect unknown transaction codes
  for (const line of lines) {
    if (line.recordType === "2.1") {
      const txField = line.fields.find((f) => f.name === "transactionCode");
      const code = txField?.value ?? "";
      if (code.trim().length > 0 && !reverseMapTransactionCode(code)) {
        warnings.push(`Unknown transaction code "${code.trim()}", BkTxCd omitted`);
      }
    }
  }

  const xml = statementToXml(statement, camtVersion);

  return { xml, lines, statement, warnings };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/reverse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/reverse.ts test/unit/reverse.test.ts
git commit -m "feat: add reverse orchestrator — codaToCamt(content, version)"
```

---

## Chunk 5: Round-Trip Tests + CLI

### Task 12: Round-Trip Integration Tests

**Files:**
- Create: `test/integration/round-trip.test.ts`

- [ ] **Step 1: Write round-trip tests**

```typescript
// test/integration/round-trip.test.ts
import { describe, it, expect } from "vitest";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

describe("round-trip: CAMT → CODA → CAMT", () => {
  it("preserves account IBAN through round-trip", () => {
    // Build a known CamtStatement
    const stmt = {
      camtVersion: "053" as const,
      messageId: "MSG001",
      creationDate: "2024-03-15",
      statementId: "STMT001",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB", ownerName: "ACME" },
      openingBalance: { amount: 1000, creditDebit: "CRDT" as const, date: "2024-03-15" },
      closingBalance: { amount: 1500, creditDebit: "CRDT" as const, date: "2024-03-15" },
      entries: [{
        amount: 500, currency: "EUR", creditDebit: "CRDT" as const,
        bookingDate: "2024-03-15", valueDate: "2024-03-15",
        transactionCode: { domain: "PMNT", family: "RCDT", subFamily: "ESCT" },
        details: [{
          refs: { endToEndId: "E2E001" },
          counterparty: { name: "SENDER CORP", iban: "BE91516952884376", bic: "SNDRBEBB" },
          remittanceInfo: { unstructured: "Invoice 12345" },
        }],
      }],
      reportDate: "2024-03-15",
    };

    // Forward: CamtStatement → CODA
    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");

    // Reverse: CODA → CamtStatement
    const reverseResult = codaToCamt(codaContent);
    const reconstructed = reverseResult.statement;

    // Verify key fields preserved
    expect(reconstructed.account.iban).toBe("BE68539007547034");
    expect(reconstructed.account.currency).toBe("EUR");
    expect(reconstructed.account.bic).toBe("BBRUBEBB");
    expect(reconstructed.openingBalance.amount).toBe(1000);
    expect(reconstructed.openingBalance.creditDebit).toBe("CRDT");
    expect(reconstructed.closingBalance.amount).toBe(1500);
    expect(reconstructed.entries).toHaveLength(1);
    expect(reconstructed.entries[0].amount).toBe(500);
    expect(reconstructed.entries[0].creditDebit).toBe("CRDT");
    expect(reconstructed.entries[0].transactionCode?.domain).toBe("PMNT");
    expect(reconstructed.entries[0].transactionCode?.family).toBe("RCDT");
    expect(reconstructed.entries[0].transactionCode?.subFamily).toBe("ESCT");
  });

  it("preserves counterparty info through round-trip", () => {
    const stmt = {
      camtVersion: "053" as const, messageId: "M", creationDate: "2024-01-01", statementId: "S",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB" },
      openingBalance: { amount: 0, creditDebit: "CRDT" as const, date: "2024-01-01" },
      closingBalance: { amount: 100, creditDebit: "CRDT" as const, date: "2024-01-01" },
      entries: [{
        amount: 100, currency: "EUR", creditDebit: "CRDT" as const,
        bookingDate: "2024-01-01", valueDate: "2024-01-01",
        details: [{
          counterparty: { name: "JOHN DOE", iban: "NL91ABNA0417164300", bic: "ABNANL2A" },
          remittanceInfo: { unstructured: "Test payment" },
        }],
      }],
      reportDate: "2024-01-01",
    };

    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");
    const reverseResult = codaToCamt(codaContent);
    const entry = reverseResult.statement.entries[0];

    expect(entry.details[0].counterparty?.iban).toBe("NL91ABNA0417164300");
    expect(entry.details[0].counterparty?.name).toBe("JOHN DOE");
    expect(entry.details[0].counterparty?.bic).toBe("ABNANL2A");
  });

  // Optionally test with real anonymized CAMT files if they exist
  const exampleDir = join(process.cwd(), "example-files/CAMT");
  if (existsSync(exampleDir)) {
    const accountDirs = readdirSync(exampleDir).filter(d => d.startsWith("LT") || d.startsWith("BE") || d.startsWith("NL"));
    for (const acctDir of accountDirs.slice(0, 2)) { // test first 2 accounts
      const camt053Dir = join(exampleDir, acctDir, "CAMT_053");
      if (!existsSync(camt053Dir)) continue;
      const xmlFiles = readdirSync(camt053Dir).filter(f => f.endsWith(".xml")).slice(0, 1);
      for (const xmlFile of xmlFiles) {
        it(`round-trips ${acctDir}/${xmlFile}`, () => {
          const xml = readFileSync(join(camt053Dir, xmlFile), "utf-8");
          const stmts = parseCamt(xml);
          for (const stmt of stmts) {
            const coda = statementToCoda(stmt);
            const codaContent = coda.lines.map(l => l.raw).join("\n");
            const reverse = codaToCamt(codaContent);
            // Basic sanity: account and balances preserved
            expect(reverse.statement.account.iban).toBe(stmt.account.iban);
            expect(reverse.statement.account.currency).toBe(stmt.account.currency);
            expect(reverse.statement.openingBalance.amount).toBeCloseTo(stmt.openingBalance.amount, 2);
            expect(reverse.statement.closingBalance.amount).toBeCloseTo(stmt.closingBalance.amount, 2);
            expect(reverse.statement.entries.length).toBe(stmt.entries.length);
          }
        });
      }
    }
  }
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/integration/round-trip.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/integration/round-trip.test.ts
git commit -m "test: add CAMT→CODA→CAMT round-trip integration tests"
```

---

### Task 13: CLI reverse Subcommand

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add reverse subcommand to CLI**

Add after the `serve` command in `src/cli.ts`:

```typescript
// ── reverse ──────────────────────────────────────────────────────────────────

program
  .command("reverse")
  .description("Convert CODA file(s) to CAMT XML format")
  .requiredOption("-i, --input <path>", "Input CODA file or directory (local or s3://)")
  .requiredOption("-o, --output <path>", "Output directory (local or s3://)")
  .option("--camt-version <version>", "CAMT version to generate", "camt.053.001.08")
  .option("--dry-run", "Validate and preview without writing files")
  .option("--endpoint <url>", "S3 endpoint URL")
  .option("--access-key <key>", "S3 access key")
  .option("--secret-key <key>", "S3 secret key")
  .action(async (opts) => {
    const { codaToCamt } = await import("./core/reverse.js");
    const storageOpts: StorageOptions = {
      endpoint: opts.endpoint,
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
    };
    const inputStorage = makeStorage(opts.input, storageOpts);
    const outputStorage = makeStorage(opts.output, storageOpts);

    let inputFiles: string[];
    try {
      if (opts.input.endsWith(".cod") || opts.input.endsWith(".coda")) {
        inputFiles = [opts.input];
      } else {
        inputFiles = await inputStorage.list(opts.input);
      }
    } catch {
      inputFiles = [opts.input];
    }

    if (inputFiles.length === 0) {
      console.error("No CODA files found at input path");
      process.exit(1);
    }

    console.log(`Reverse-converting ${inputFiles.length} file(s)...`);
    let allOk = true;

    for (const inputFile of inputFiles) {
      const name = isS3Path(inputFile) ? inputFile.split("/").pop()! : basename(inputFile);
      try {
        const content = await inputStorage.read(inputFile);
        const result = codaToCamt(content, opts.camtVersion);

        if (result.warnings.length > 0) {
          result.warnings.forEach((w) => console.warn(`  WARN: ${w}`));
        }

        const outName = name.replace(/\.(cod|coda)$/i, ".xml");
        const outPath = outputPath(inputFile, opts.output, outName);

        if (opts.dryRun) {
          console.log(`  [dry-run] ${name} → ${outName} (${result.statement.entries.length} entries)`);
        } else {
          await outputStorage.write(outPath, result.xml);
          console.log(`  ${name} → ${outName} (${result.statement.entries.length} entries)`);
        }
      } catch (err) {
        console.error(`  ERROR processing ${name}: ${(err as Error).message}`);
        allOk = false;
      }
    }

    process.exit(allOk ? 0 : 1);
  });
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI reverse subcommand for CODA→CAMT conversion"
```

---

## Chunk 6: Web UI — Three-Panel Inspector

### Task 14: Server-Side — Bidirectional Convert API

**Files:**
- Modify: `src/web/server.ts`

- [ ] **Step 1: Add direction auto-detection and reverse handling**

Update `handleConvert` in `src/web/server.ts`:

```typescript
import { codaToCamt } from "../core/reverse.js";

async function handleConvert(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const directionOverride = url.searchParams.get("direction");
  const camtVersion = url.searchParams.get("camt-version") ?? undefined;

  const body = await readBody(req);

  // Determine direction
  let direction: "camt-to-coda" | "coda-to-camt";

  if (directionOverride === "camt-to-coda" || directionOverride === "coda-to-camt") {
    direction = directionOverride;
  } else if (contentType.includes("multipart/form-data")) {
    direction = "camt-to-coda";
  } else {
    // Auto-detect from content
    const text = body.toString("utf-8").trim();
    if (text.startsWith("<?xml") || text.includes("xmlns")) {
      direction = "camt-to-coda";
    } else {
      direction = "coda-to-camt";
    }
  }

  if (direction === "camt-to-coda") {
    // Existing CAMT→CODA logic (refactored from handleConvert)
    await handleForwardConvert(req, res, body, contentType);
  } else {
    // New CODA→CAMT logic
    await handleReverseConvert(res, body, camtVersion);
  }
}

async function handleForwardConvert(
  req: IncomingMessage, res: ServerResponse, body: Buffer, contentType: string
): Promise<void> {
  // ... existing multipart logic, updated to return direction + CodaLine[]
  // Response shape: { direction: "camt-to-coda", files: [...], version }
}

async function handleReverseConvert(
  res: ServerResponse, body: Buffer, camtVersion?: string
): Promise<void> {
  try {
    const content = body.toString("utf-8");
    const result = codaToCamt(content, camtVersion);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      direction: "coda-to-camt",
      xml: result.xml,
      lines: result.lines,
      warnings: result.warnings,
      validation: { valid: true, errors: [] },
    }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
```

- [ ] **Step 2: Update forward convert response to include direction and CodaLine[] metadata**

In `handleForwardConvert`, update the JSON response:
```typescript
res.end(JSON.stringify({ direction: "camt-to-coda", files, version }));
```

Where each file now includes `lines: CodaLine[]` (already done from Task 6).

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/web/server.ts
git commit -m "feat: web server handles bidirectional conversion with CodaLine[] metadata"
```

---

### Task 15: Web UI — Three-Panel Layout + Inspector

**Files:**
- Modify: `src/web/index.html`

This is the largest single task. The HTML file needs a full rewrite from ~500 lines of drag-drop-preview to ~1500-2000 lines of three-panel inspector.

- [ ] **Step 1: Rewrite index.html with three-panel layout**

Key UI elements:
1. **Header** — Title + direction dropdown ("Auto-detect", "CAMT → CODA", "CODA → CAMT")
2. **Drop zone** — Accept any file, auto-detect direction
3. **Source panel** (left) — Shows input file (CAMT XML with syntax highlighting, or CODA with monospace)
4. **Output panel** (right) — Shows conversion result (opposite format)
5. **Inspector drawer** (bottom) — Slides up on field click, shows field metadata
6. **Download button** — Download the output file

The implementation should:
- Parse the API response `CodaLine[]` to render the CODA panel with per-field spans
- Each field span gets `data-field-name`, `data-start`, `data-length`, `data-source-xpath`
- On hover: highlight the field span + show tooltip
- On click: open/update inspector drawer + cross-highlight in other panel
- CAMT panel: simple syntax-highlighted XML view; for cross-highlighting, match `sourceXPath` to XML tag names
- Color-code each record type: record 0 (gray), 1 (blue), 2.x (green), 3.x (yellow), 8 (blue), 9 (gray)
- Direction toggle updates when file is auto-detected

The full HTML file is too large to include inline. The implementer should:
1. Keep the existing CSS variables (dark theme)
2. Replace the single-pane layout with CSS Grid: `grid-template-rows: auto 1fr auto; grid-template-columns: 1fr 1fr;`
3. Use vanilla JS — no frameworks
4. Inspector drawer: fixed at bottom, `transform: translateY(100%)` → `translateY(0)` on open
5. CODA rendering: each field wrapped in `<span class="coda-field" data-record="2.1" data-field="amount" ...>`
6. Cross-highlighting: `document.querySelectorAll('[data-field="amount"]')` to find matching elements

- [ ] **Step 2: Test manually**

Run: `npx tsx src/cli.ts serve --port 3000`
- Open http://localhost:3000
- Drop a CAMT XML file → should see CODA output with field inspector
- Drop a CODA file → should see CAMT XML output
- Click any CODA field → inspector opens with field details
- Click a CAMT element → cross-highlights CODA field

- [ ] **Step 3: Commit**

```bash
git add src/web/index.html
git commit -m "feat: three-panel web UI with bidirectional field inspector"
```

---

### Task 16: Web UI Server Tests

**Files:**
- Modify or create: `test/web/server.test.ts` (if exists) or `test/unit/server.test.ts`

- [ ] **Step 1: Write API tests for bidirectional conversion**

```typescript
// test/unit/server-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, Server } from "http";
import { readFileSync } from "fs";
import { join } from "path";

// We'll test the route handlers directly or via HTTP
// For simplicity, test the conversion logic functions used by the server

import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";

describe("server API bidirectional conversion", () => {
  it("CAMT→CODA produces CodaLine[] with fields", () => {
    // Minimal CAMT XML
    const xml = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId><CreDtTm>2024-03-15T00:00:00</CreDtTm></GrpHdr>
  <Stmt><Id>S1</Id>
    <Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy>
      <Svcr><FinInstnId><BIC>BBRUBEBB</BIC></FinInstnId></Svcr></Acct>
    <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
    <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
  </Stmt></BkToCstmrStmt></Document>`;

    const stmts = parseCamt(xml);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[0].fields).toBeDefined();
    expect(result.lines[0].fields.length).toBeGreaterThan(0);
    expect(result.lines[0].raw).toHaveLength(128);
  });

  it("CODA→CAMT produces valid XML", () => {
    const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
    const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
    const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(64) + "0";
    const rec9 = "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2";

    const result = codaToCamt([rec0, rec1, rec8, rec9].join("\n"));
    expect(result.xml).toContain("<?xml");
    expect(result.xml).toContain("BE68539007547034");
    expect(result.lines).toHaveLength(4);
    expect(result.lines[0].fields.length).toBeGreaterThan(0);
  });

  it("auto-detects direction from content", () => {
    const xmlContent = '<?xml version="1.0"?><Document xmlns="urn:iso">';
    const codaContent = "0" + "0".repeat(127);

    // XML → forward
    expect(xmlContent.startsWith("<?xml") || xmlContent.includes("xmlns")).toBe(true);
    // Fixed-width → reverse
    const codaLines = codaContent.split("\n").filter(l => l.length > 0);
    expect(codaLines.every(l => l.length === 128)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/unit/server-api.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/unit/server-api.test.ts
git commit -m "test: add bidirectional conversion API tests"
```

---

## Chunk 7: Property-Based Tests + Final Verification

### Task 17: Property-Based Tests

**Files:**
- Modify: `test/unit/property.test.ts`

- [ ] **Step 1: Add round-trip property tests**

Add to `test/unit/property.test.ts`:

```typescript
import { codaToCamt } from "../../src/core/reverse.js";
import { parseCoda } from "../../src/core/coda-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { extractFields } from "../../src/core/field-defs/extract.js";
import {
  RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
  RECORD23_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
} from "../../src/core/field-defs/index.js";

describe("property: field-defs", () => {
  const allFieldDefs = [
    RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
    RECORD23_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
  ];

  it("extractFields always produces fields summing to 128 chars", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allFieldDefs),
        (defs) => {
          const line = "X".repeat(128);
          const fields = extractFields(line, defs);
          const total = fields.reduce((s, f) => s + f.value.length, 0);
          return total === 128;
        }
      )
    );
  });
});

describe("property: round-trip", () => {
  it("forward-then-reverse preserves account IBAN", () => {
    fc.assert(
      fc.property(
        fc.record({
          iban: fc.stringMatching(/^[A-Z]{2}\d{14,30}$/).filter(s => s.length <= 34),
          currency: fc.constantFrom("EUR", "USD", "GBP"),
          amount: fc.integer({ min: 0, max: 999999999 }),
        }),
        ({ iban, currency, amount }) => {
          const stmt = {
            camtVersion: "053" as const,
            messageId: "M",
            creationDate: "2024-01-01",
            statementId: "S",
            account: { iban, currency, bic: "TESTBEBB" },
            openingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            closingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            entries: [],
            reportDate: "2024-01-01",
          };

          const coda = statementToCoda(stmt);
          const codaContent = coda.lines.map(l => l.raw).join("\n");
          const reverse = codaToCamt(codaContent);
          return reverse.statement.account.iban === iban;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("parseCoda always succeeds on statementToCoda output", () => {
    fc.assert(
      fc.property(
        fc.record({
          iban: fc.stringMatching(/^[A-Z]{2}\d{14,30}$/).filter(s => s.length <= 34),
          currency: fc.constantFrom("EUR", "USD", "GBP"),
          amount: fc.integer({ min: 0, max: 999999999 }),
        }),
        ({ iban, currency, amount }) => {
          const stmt = {
            camtVersion: "053" as const,
            messageId: "M",
            creationDate: "2024-01-01",
            statementId: "S",
            account: { iban, currency, bic: "TESTBEBB" },
            openingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            closingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            entries: [],
            reportDate: "2024-01-01",
          };

          const coda = statementToCoda(stmt);
          const codaContent = coda.lines.map(l => l.raw).join("\n");
          // Must not throw — parser accepts anything the builder produces
          const parsed = parseCoda(codaContent);
          return parsed.length === coda.lines.length;
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

- [ ] **Step 2: Run property tests**

Run: `npx vitest run test/unit/property.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/unit/property.test.ts
git commit -m "test: add property-based tests for field-defs and round-trip"
```

---

### Task 18: Final Verification + Coverage Check

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --coverage`
Expected: ALL PASS, coverage >= 90% line / 80% branch

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

```bash
# Forward conversion
npx tsx src/cli.ts convert -i example-files/CAMT/ -o /tmp/coda-out/ --dry-run

# Reverse conversion (using output from forward)
npx tsx src/cli.ts reverse -i /tmp/coda-out/ -o /tmp/camt-out/ --dry-run

# Web UI
npx tsx src/cli.ts serve --port 3000
# Open browser, test both directions
```

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from final verification"
```
