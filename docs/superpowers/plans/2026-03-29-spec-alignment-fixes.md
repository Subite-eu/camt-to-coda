# CAMT↔CODA Spec Alignment Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the CAMT-to-CODA converter with the Belgian CAMT 053 v2.1 and CODA 2.6 specifications, fixing 12 concrete field-mapping issues discovered by comparing converter output against a real bank CODA file.

**Architecture:** Fix field mappings in record builders and the writer orchestrator, improve the CAMT parser to extract more data, use BBA proprietary codes when available, always generate Record 3.x information records, and document conversion limitations for both directions.

**Tech Stack:** TypeScript, Vitest, fast-xml-parser.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/core/coda-writer.ts` | Forward conversion orchestrator | Modify — pass sequence to record builders, always generate Record 3, fix Record 9 count |
| `src/core/camt-parser.ts` | CAMT XML parser | Modify — fix counterparty direction, handle multiple Ustrd, extract proprietary issuer |
| `src/core/transaction-codes.ts` | ISO↔CODA code mapping | Modify — add BBA proprietary code support |
| `src/core/model.ts` | Type definitions | Modify — add `proprietaryIssuer` to TransactionCode |
| `src/core/records/record0.ts` | Record 0 builder | Modify — use creationDate and fileReference |
| `src/core/records/record21.ts` | Record 2.1 builder | Modify — accept and use sequence, prefer AcctSvcrRef |
| `src/core/records/record22.ts` | Record 2.2 builder | Modify — accept and populate customerRef |
| `src/core/records/record31.ts` | Record 3.1 builder | Modify — accept and use sequence |
| `src/core/records/record9.ts` | Record 9 builder | Modify — accept lastFile parameter |
| `src/core/coda-to-statement.ts` | Reverse: CODA→CamtStatement | Modify — extract customerRef, fix Record 3 handling |
| `src/core/reverse.ts` | Reverse wrapper | No changes needed |
| `docs/conversion-limitations.md` | Conversion limitations doc | Create |
| `test/unit/coda-writer.test.ts` | Writer unit tests | Modify — add/update tests for new behavior |
| `test/unit/records/record21.test.ts` | Record 2.1 tests | Modify — test sequence propagation |
| `test/unit/records/record0.test.ts` | Record 0 tests | Modify — test fileReference |

---

### Task 1: Fix Record 2.1 `statementSequence` and Record 3.1 `sequence`

These fields should repeat the statement sequence from Record 1, not be hardcoded to `"000"`.

**Files:**
- Modify: `src/core/records/record21.ts`
- Modify: `src/core/records/record31.ts`
- Modify: `src/core/coda-writer.ts`
- Test: `test/unit/records/record21.test.ts`

- [ ] **Step 1: Update Record21Params to accept sequence**

In `src/core/records/record21.ts`, add `sequence` to the params and use it:

```typescript
export interface Record21Params {
  entry: CamtEntry;
  seqNum: string;
  comm: string;
  commType: string;
  txCode: string;
  entryDate: string;
  hasMore: boolean;
  needRecord3: boolean;
  sequence: string;       // ADD: 3-char statement sequence from Record 1
}

export function record21(p: Record21Params): CodaLine {
  const { entry, seqNum, comm, commType, txCode, entryDate, hasMore, needRecord3, sequence } = p;
  // ... existing code ...
  const values: Record<string, string> = {
    // ... existing fields ...
    statementSequence: sequence,   // CHANGE: was "000"
    // ...
  };
```

- [ ] **Step 2: Update Record31 to accept and use sequence**

In `src/core/records/record31.ts`, add `sequence` to params:

```typescript
export interface Record31Params {
  seqNum: string;
  detailNum: number;
  bankRef: string;
  txCode: string;
  commType: string;
  comm: string;
  entryDate: string;
  hasRecord32: boolean;
  sequence: string;      // ADD
}
```

Use it in the values: `sequence: p.sequence,` instead of `sequence: "000",`.

- [ ] **Step 3: Pass sequence through coda-writer.ts**

In `src/core/coda-writer.ts`, pass `sequence` to `record21()` and `record31()` calls:

```typescript
// In the record21 call (~line 93):
record21({
  entry,
  seqNum,
  comm,
  commType,
  txCode,
  entryDate,
  hasMore: needRec22 || needRec23,
  needRecord3,
  sequence,      // ADD
})

// In the record31 call (~line 151):
record31({
  seqNum,
  detailNum: d + 1,
  bankRef: txRefs,
  txCode,
  commType: "0",
  comm: txComm.slice(0, 73),
  entryDate,
  hasRecord32,
  sequence,      // ADD
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: Some existing tests may fail because they don't pass `sequence` — fix those by adding the parameter.

- [ ] **Step 5: Fix failing tests**

Update `test/unit/records/record21.test.ts` — every `record21()` call needs `sequence: "000"` (or appropriate value) added to its params. Same for `record31.test.ts`.

Update `test/unit/coda-writer.test.ts` — verify the `statementSequence` field now contains the computed sequence instead of `"000"`.

- [ ] **Step 6: Commit**

```bash
git add src/core/records/record21.ts src/core/records/record31.ts src/core/coda-writer.ts test/
git commit -m "fix: Record 2.1/3.1 statementSequence uses computed sequence instead of 000"
```

---

### Task 2: Use AcctSvcrRef for bank reference in Record 2.1

The CODA bank reference field (pos 11-31) should prefer `AcctSvcrRef` (bank's own reference) over customer refs.

**Files:**
- Modify: `src/core/records/record21.ts`

- [ ] **Step 1: Change bankReference priority**

In `src/core/records/record21.ts`, change the `refs` / `bankReference` logic:

```typescript
// BEFORE (lines 26-32):
const refs = entry.details
  .flatMap((d) =>
    [d.refs?.endToEndId, d.refs?.txId, d.refs?.instrId].filter(
      (r) => r && r !== "NOTPROVIDED"
    )
  )
  .join("/");

const values: Record<string, string> = {
  bankReference: padRight(refs || entry.entryRef || "", 21),

// AFTER:
const refs = entry.details
  .flatMap((d) =>
    [d.refs?.endToEndId, d.refs?.txId, d.refs?.instrId].filter(
      (r) => r && r !== "NOTPROVIDED"
    )
  )
  .join("/");

const values: Record<string, string> = {
  bankReference: padRight(entry.accountServicerRef || entry.entryRef || refs || "", 21),
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS (AcctSvcrRef is typically undefined in test fixtures, so existing tests still fall through to entryRef/refs)

- [ ] **Step 3: Commit**

```bash
git add src/core/records/record21.ts
git commit -m "fix: Record 2.1 bank reference prefers AcctSvcrRef per CODA spec"
```

---

### Task 3: Use BBA proprietary transaction code when available

When `BkTxCd.Prtry.Cd` contains a BBA code (8 digits, `Issr=BBA`), use it directly as the CODA transaction code.

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/core/camt-parser.ts`
- Modify: `src/core/transaction-codes.ts`
- Modify: `src/core/coda-to-statement.ts`
- Test: `test/unit/coda-writer.test.ts`

- [ ] **Step 1: Add proprietaryIssuer to model**

In `src/core/model.ts`:

```typescript
export interface TransactionCode {
  domain?: string;
  family?: string;
  subFamily?: string;
  proprietary?: string;
  proprietaryIssuer?: string;  // ADD: "BBA", "ISO", etc.
}
```

- [ ] **Step 2: Parse proprietaryIssuer in camt-parser.ts**

In `src/core/camt-parser.ts`, in the `parseEntry` function (~line 201):

```typescript
transactionCode: txCode
  ? {
      domain: str(get(txCode, "Domn.Cd")) || undefined,
      family: str(get(txCode, "Domn.Fmly.Cd")) || undefined,
      subFamily: str(get(txCode, "Domn.Fmly.SubFmlyCd")) || undefined,
      proprietary: str(get(txCode, "Prtry.Cd")) || undefined,
      proprietaryIssuer: str(get(txCode, "Prtry.Issr")) || undefined,  // ADD
    }
  : undefined,
```

- [ ] **Step 3: Update mapTransactionCode to accept proprietary**

In `src/core/transaction-codes.ts`:

```typescript
export function mapTransactionCode(
  domain?: string,
  family?: string,
  subFamily?: string,
  proprietary?: string,
  proprietaryIssuer?: string,
): string {
  // BBA proprietary code IS the CODA transaction code
  if (proprietary && proprietaryIssuer === "BBA" && /^\d{8}$/.test(proprietary)) {
    return proprietary;
  }
  // Also accept raw 8-digit proprietary without issuer (common pattern)
  if (proprietary && !domain && /^\d{8}$/.test(proprietary)) {
    return proprietary;
  }

  if (!domain || !family) return "        ";

  // Check card payments first (wildcard SubFamily)
  if (`${domain}/${family}` === CARD_FAMILY) return CARD_CODE;

  const key = `${domain}/${family}/${subFamily || ""}`;
  return TRANSACTION_CODE_MAP[key] || "        ";
}
```

- [ ] **Step 4: Update call site in coda-writer.ts**

In `src/core/coda-writer.ts` (~line 66):

```typescript
const txCode = entry.transactionCode
  ? mapTransactionCode(
      entry.transactionCode.domain,
      entry.transactionCode.family,
      entry.transactionCode.subFamily,
      entry.transactionCode.proprietary,        // ADD
      entry.transactionCode.proprietaryIssuer,   // ADD
    )
  : "        ";
```

- [ ] **Step 5: Update reverse mapping for BBA codes**

In `src/core/coda-to-statement.ts`, when reconstructing the transaction code from a CODA file, if the code doesn't match a known ISO reverse mapping, store it as proprietary:

In function `codaToStatement`, in the `case "2.1"` block (~line 158):

```typescript
const mappedCode = reverseMapTransactionCode(transactionCode);
currentEntry = {
  // ...
  transactionCode: mappedCode ?? (transactionCode.trim().length > 0
    ? { proprietary: transactionCode.trim(), proprietaryIssuer: "BBA" }
    : undefined),
  // ...
};
```

- [ ] **Step 6: Run tests, fix any failures**

Run: `npx vitest run`
Expected: PASS — the new `proprietary`/`proprietaryIssuer` params are optional.

- [ ] **Step 7: Commit**

```bash
git add src/core/model.ts src/core/camt-parser.ts src/core/transaction-codes.ts src/core/coda-writer.ts src/core/coda-to-statement.ts
git commit -m "feat: use BBA proprietary transaction code directly as CODA code when available"
```

---

### Task 4: Fix counterparty direction logic in parser

For DBIT entries the counterparty is the Creditor, for CRDT entries the counterparty is the Debtor.

**Files:**
- Modify: `src/core/camt-parser.ts`

- [ ] **Step 1: Fix parseTxDetail to be direction-aware**

The function needs access to the entry's `CdtDbtInd`. Change `parseTxDetail` to accept it:

In `src/core/camt-parser.ts`, change the call at ~line 209:

```typescript
details: detailsArr.map((d) => parseTxDetail(d, str(ntry.CdtDbtInd) as "CRDT" | "DBIT")),
```

Then update `parseTxDetail`:

```typescript
function parseTxDetail(tx: any, direction: "CRDT" | "DBIT"): TransactionDetail {
  const refs = tx.Refs;
  const cdtr = tx.RltdPties?.Cdtr;
  const dbtr = tx.RltdPties?.Dbtr;
  const cdtrAcct = get(tx, "RltdPties.CdtrAcct.Id.IBAN");
  const dbtrAcct = get(tx, "RltdPties.DbtrAcct.Id.IBAN");
  const cdtrBic = get(tx, "RltdAgts.CdtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.CdtrAgt.FinInstnId.BICFI");
  const dbtrBic = get(tx, "RltdAgts.DbtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.DbtrAgt.FinInstnId.BICFI");

  // Counterparty depends on direction:
  // DBIT (money left our account) → counterparty is Creditor (receiver)
  // CRDT (money came in) → counterparty is Debtor (sender)
  const counterpartyName = direction === "DBIT"
    ? str(cdtr?.Nm || dbtr?.Nm)
    : str(dbtr?.Nm || cdtr?.Nm);
  const counterpartyIban = direction === "DBIT"
    ? str(cdtrAcct || dbtrAcct)
    : str(dbtrAcct || cdtrAcct);
  const counterpartyBic = direction === "DBIT"
    ? str(cdtrBic || dbtrBic)
    : str(dbtrBic || cdtrBic);

  return {
    refs: refs
      ? {
          endToEndId: str(refs.EndToEndId) || undefined,
          txId: str(refs.TxId) || undefined,
          instrId: str(refs.InstrId) || undefined,
        }
      : undefined,
    counterparty: {
      name: counterpartyName || undefined,
      iban: counterpartyIban || undefined,
      bic: counterpartyBic || undefined,
    },
    remittanceInfo: {
      unstructured: str(get(tx, "RmtInf.Ustrd")) || undefined,
      structured: get(tx, "RmtInf.Strd.CdtrRefInf.Ref")
        ? { creditorRef: str(get(tx, "RmtInf.Strd.CdtrRefInf.Ref")) }
        : undefined,
    },
  };
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/camt-parser.ts
git commit -m "fix: counterparty resolution respects CRDT/DBIT direction per ISO 20022"
```

---

### Task 5: Fix Record 9 count and Record 0 fields

Record 9's count must include 3.2 and 3.3 sub-records. Record 0 should use `creationDate` and `fileReference`.

**Files:**
- Modify: `src/core/coda-writer.ts`
- Modify: `src/core/records/record0.ts`
- Modify: `src/core/records/record9.ts`

- [ ] **Step 1: Fix Record 9 count in coda-writer.ts**

In `src/core/coda-writer.ts`, add counting for Record 3.2 and 3.3:

```typescript
// Inside the Record 3 loop (~line 164), after the existing Record 3.2 block:
if (hasRecord32) {
  lines.push(record32({ ... }));
  recordCount++;    // ADD
}

if (hasRecord33) {
  lines.push(record33({ ... }));
  recordCount++;    // ADD
}
```

- [ ] **Step 2: Update Record 0 to use creationDate and populate fileReference**

In `src/core/records/record0.ts`:

```typescript
export function record0(stmt: CamtStatement): CodaLine {
  const date = formatDate(stmt.creationDate);   // CHANGE: was stmt.reportDate
  const bic = stmt.account.bic || "";

  const values: Record<string, string> = {
    // ...
    creationDate: date,
    // ...
    fileReference: padRight(stmt.statementId || stmt.messageId || "", 10),  // CHANGE: was ""
    // ...
  };
```

- [ ] **Step 3: Add lastFile parameter to Record 9**

In `src/core/records/record9.ts`:

```typescript
export interface Record9Params {
  recordCount: number;
  sumDebits: number;
  sumCredits: number;
  lastFile?: string;     // ADD: "1" = another file follows, "2" = last file (default)
}

export function record9(p: Record9Params): CodaLine {
  const { recordCount, sumDebits, sumCredits, lastFile = "2" } = p;
  const values: Record<string, string> = {
    // ...
    lastFile,     // CHANGE: was hardcoded "2"
  };
```

- [ ] **Step 4: Run tests, fix failures**

Run: `npx vitest run`
Fix any tests that assert on Record 0's creationDate position or Record 9 field values.

- [ ] **Step 5: Commit**

```bash
git add src/core/coda-writer.ts src/core/records/record0.ts src/core/records/record9.ts test/
git commit -m "fix: Record 9 counts 3.2/3.3 records, Record 0 uses creationDate and fileReference"
```

---

### Task 6: Always generate Record 3.x information records

The real bank always generates Record 3.1 for each entry (even single-detail entries). This carries the remittance info separately from the Record 2.x communication zones.

**Files:**
- Modify: `src/core/coda-writer.ts`

- [ ] **Step 1: Change needRecord3 logic and always generate at least one Record 3.1**

In `src/core/coda-writer.ts`, the key change is: always generate Record 3.1 (not just when `entry.details.length > 1`), and set the link code on Records 2.1/2.3 accordingly.

Replace the Record 3 generation section (~lines 134-185):

```typescript
// Records 3.x: always generate at least one 3.1 for information
// For batch entries (details.length > 1), generate one 3.1 per detail
const detailsToEmit = entry.details.length > 1
  ? entry.details
  : entry.details.length === 1
  ? [entry.details[0]]
  : [{ remittanceInfo: { unstructured: comm } } as TransactionDetail];

const alwaysRecord3 = true; // Bank always generates 3.x

for (let d = 0; d < detailsToEmit.length; d++) {
  const detailEntry = detailsToEmit[d];
  const txRefs = [detailEntry.refs?.endToEndId, detailEntry.refs?.txId]
    .filter((r) => r && r !== "NOTPROVIDED")
    .join("/");
  const txComm =
    detailEntry.remittanceInfo?.unstructured &&
    detailEntry.remittanceInfo.unstructured !== "NOTPROVIDED"
      ? detailEntry.remittanceInfo.unstructured
      : txRefs || "";

  const hasRecord32 = txComm.length > 73;
  const hasRecord33 = txComm.length > 178;

  lines.push(
    record31({
      seqNum,
      detailNum: d + 1,
      bankRef: entry.accountServicerRef || entry.entryRef || txRefs || "",
      txCode,
      commType: "0",
      comm: txComm.slice(0, 73),
      entryDate,
      hasRecord32,
      sequence,
    })
  );
  recordCount++;

  if (hasRecord32) {
    lines.push(
      record32({
        seqNum,
        detailNum: d + 1,
        comm: txComm.slice(73, 178),
        hasRecord33,
      })
    );
    recordCount++;
  }

  if (hasRecord33) {
    lines.push(
      record33({
        seqNum,
        detailNum: d + 1,
        comm: txComm.slice(178, 268),
      })
    );
    recordCount++;
  }
}
```

Also update the `needRecord3` flag used for link codes on Record 2.1 and 2.3:

```typescript
const needRecord3 = true;  // Always generate Record 3
```

- [ ] **Step 2: Run tests, fix failures**

Run: `npx vitest run`
Many tests will fail because they didn't expect Record 3.x lines. Update assertions to account for the new records. The record count and line count will increase.

- [ ] **Step 3: Commit**

```bash
git add src/core/coda-writer.ts test/
git commit -m "feat: always generate Record 3.x information records per bank convention"
```

---

### Task 7: Populate customerRef in Record 2.2 and handle multiple Ustrd

**Files:**
- Modify: `src/core/coda-writer.ts`
- Modify: `src/core/records/record22.ts`
- Modify: `src/core/camt-parser.ts`

- [ ] **Step 1: Add customerRef to Record22Params**

In `src/core/records/record22.ts`:

```typescript
export interface Record22Params {
  seqNum: string;
  comm: string;
  counterpartBic: string;
  hasMore: boolean;
  customerRef?: string;   // ADD
}

export function record22(p: Record22Params): CodaLine {
  const { seqNum, comm, counterpartBic, hasMore, customerRef } = p;

  const values: Record<string, string> = {
    // ...
    customerRef: padRight(customerRef || "", 35),   // CHANGE: was padRight("", 35)
    // ...
  };
```

- [ ] **Step 2: Pass customerRef from coda-writer.ts**

In `src/core/coda-writer.ts`, in the Record 2.2 generation:

```typescript
const endToEndId = detail?.refs?.endToEndId;
const customerRef = endToEndId && endToEndId !== "NOTPROVIDED" ? endToEndId : "";

if (needRec22) {
  lines.push(
    record22({
      seqNum,
      comm: comm.slice(53, 106),
      counterpartBic,
      hasMore: needRec23,
      customerRef,        // ADD
    })
  );
  recordCount++;
}
```

- [ ] **Step 3: Handle multiple Ustrd in camt-parser.ts**

In `src/core/camt-parser.ts`, in `parseTxDetail`:

```typescript
// BEFORE:
unstructured: str(get(tx, "RmtInf.Ustrd")) || undefined,

// AFTER:
unstructured: (() => {
  const ustrd = get(tx, "RmtInf.Ustrd");
  if (Array.isArray(ustrd)) return ustrd.map(String).join(" ") || undefined;
  return str(ustrd) || undefined;
})(),
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/records/record22.ts src/core/coda-writer.ts src/core/camt-parser.ts
git commit -m "fix: populate Record 2.2 customerRef with EndToEndId, handle multiple Ustrd"
```

---

### Task 8: Swap ElctrncSeqNb/LglSeqNb priority

**Files:**
- Modify: `src/core/camt-parser.ts`

- [ ] **Step 1: Change priority**

In `src/core/camt-parser.ts`, in `parseStatement` (~line 109):

```typescript
// BEFORE:
sequence: num(get(stmt, "LglSeqNb")) || num(get(stmt, "ElctrncSeqNb")) || undefined,

// AFTER:
sequence: num(get(stmt, "ElctrncSeqNb")) || num(get(stmt, "LglSeqNb")) || undefined,
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/camt-parser.ts
git commit -m "fix: prefer ElctrncSeqNb over LglSeqNb for CODA sequence number"
```

---

### Task 9: Fix dead code in coda-writer counterparty BIC resolution

**Files:**
- Modify: `src/core/coda-writer.ts`

- [ ] **Step 1: Remove dead ternary**

In `src/core/coda-writer.ts` (~line 80):

```typescript
// BEFORE:
const counterpartBic =
  (entry.creditDebit === "DBIT"
    ? detail?.counterparty?.bic
    : detail?.counterparty?.bic) || "";

// AFTER:
const counterpartBic = detail?.counterparty?.bic || "";
```

- [ ] **Step 2: Run tests, commit**

```bash
git add src/core/coda-writer.ts
git commit -m "fix: remove dead ternary in counterparty BIC resolution"
```

---

### Task 10: Update reverse conversion to handle new fields

Ensure the CODA→CAMT reverse conversion correctly handles `customerRef` from Record 2.2, `AcctSvcrRef` from Record 2.1, and proprietary transaction codes.

**Files:**
- Modify: `src/core/coda-to-statement.ts`

- [ ] **Step 1: Extract customerRef from Record 2.2**

In `src/core/coda-to-statement.ts`, in the `case "2.2"` handler:

```typescript
case "2.2": {
  commZone2 = getRawField(line, "communication");
  const counterpartBic = getField(line, "counterpartBic");
  const customerRef = getField(line, "customerRef");   // ADD

  if (currentDetail && counterpartBic) {
    if (!currentDetail.counterparty) {
      currentDetail.counterparty = {};
    }
    currentDetail.counterparty.bic = counterpartBic;
  }

  // Store customerRef as endToEndId
  if (currentDetail && customerRef) {                   // ADD
    if (!currentDetail.refs) currentDetail.refs = {};
    currentDetail.refs.endToEndId = customerRef;
  }
  break;
}
```

- [ ] **Step 2: Store bankReference as accountServicerRef**

In `src/core/coda-to-statement.ts`, in the `case "2.1"` handler, add:

```typescript
currentEntry = {
  // ...
  entryRef: bankReference || undefined,
  accountServicerRef: bankReference || undefined,   // ADD
  // ...
};
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/coda-to-statement.ts
git commit -m "fix: reverse conversion extracts customerRef and accountServicerRef"
```

---

### Task 11: Write conversion limitations documentation

**Files:**
- Create: `docs/conversion-limitations.md`

- [ ] **Step 1: Create the document**

Write `docs/conversion-limitations.md`:

```markdown
# CAMT ↔ CODA Conversion Limitations

## Overview

This document describes fields that cannot be faithfully converted between CAMT (ISO 20022 XML) and CODA (Belgian fixed-width bank statement) formats. Some data exists only in one format and is lost during conversion.

## CAMT → CODA: Fields that cannot be populated from XML alone

These CODA fields require data that is not present in standard CAMT 053 XML:

| CODA Record | Field | Positions | Description | Reason |
|-------------|-------|-----------|-------------|--------|
| 0 | Bank ID | 12-14 | 3-digit bank identification number | Bank-internal identifier, not in CAMT |
| 0 | Addressee | 35-60 | Name of the CODA file recipient | Client-specific, not in CAMT |
| 0 | Company Number | 72-82 | Belgian company number (KBO/BCE) | Not part of ISO 20022 |
| 1 | Account Description | 91-125 | Bank product name (e.g., "KBC-Business PRO-rekening") | Commercial name, not in CAMT |
| 2.2 | R-Transaction Type | 113 | Reject/Return/Refund/Reversal/Cancellation indicator | Only partially derivable from ReversalIndicator |
| 2.2 | ISO Reason Code | 114-117 | Reason code for R-transactions | Available in CAMT but not currently mapped |
| 2.2 | CategoryPurpose | 118-121 | SEPA category purpose code | Available in CAMT `Purp` but not currently mapped |
| 2.2 | Purpose | 122-125 | SEPA purpose code | Available in CAMT `Purp` but not currently mapped |

### Sequence Number

The CODA sequence number (Record 1 pos 3-5, Record 8 pos 2-4) represents the bank's running counter for statements on that account. When `ElctrncSeqNb` is present in CAMT, it is used directly. Otherwise, a working-day count from January 1st is computed as an approximation — this may not match the bank's actual counter.

### Transaction Codes

When the CAMT XML includes a BBA proprietary code (`BkTxCd/Prtry/Cd` with `Issr=BBA`), it is used directly as the 8-digit CODA transaction code. When only ISO Domain/Family/SubFamily codes are present, a mapping table is used. This table covers common SEPA transaction types but not all 150+ CODA transaction codes. Unmapped ISO codes produce blank transaction codes.

## CODA → CAMT: Fields that cannot be reconstructed

These CAMT fields cannot be fully reconstructed from a CODA file:

| CAMT Element | Description | Reason |
|--------------|-------------|--------|
| `GrpHdr/CreDtTm` | Creation timestamp with timezone | CODA only stores date (DDMMYY), no time/timezone |
| `Stmt/FrToDt` | Statement period (from/to dates) | Not present in CODA |
| `Ntry/Sts` | Entry status (BOOK, PDNG, etc.) | Not represented in CODA |
| `TxDtls/RltdPties` | Full party details (address, ID) | CODA only stores name (35 chars) and IBAN (34 chars) |
| `TxDtls/RltdAgts` | Debtor/Creditor agent distinction | CODA stores one BIC (11 chars) without indicating which agent |
| `TxDtls/Refs/InstrId` | Instruction identification | Not preserved in CODA (only EndToEndId in customerRef) |
| `TxDtls/Refs/TxId` | Transaction identification | Lost during CODA conversion (used as fallback comm only) |
| `Ntry/AddtlNtryInf` | Additional entry information | No direct CODA equivalent |
| `TxDtls/Chrgs` | Charges detail | Not mapped to CODA fields |
| `TxDtls/Tax` | Tax information | Not mapped to CODA fields |

### Transaction Code Reverse Mapping

When converting CODA → CAMT, the 8-digit CODA transaction code is reverse-mapped to ISO Domain/Family/SubFamily. Only codes present in the mapping table can be converted. Unknown codes are stored as `BkTxCd/Prtry/Cd` with `Issr=BBA`.

### Communication / Remittance Info

- **CAMT → CODA**: Unstructured remittance info is split across communication zones (Record 2.1: 53 chars, Record 2.2: 53 chars, Record 2.3: 43 chars = 149 chars total). Text beyond 149 characters is truncated. Structured Belgian creditor references (OGM/VCS) are encoded as type "101" + 12-digit reference.
- **CODA → CAMT**: Communication zones are concatenated back into a single `RmtInf/Ustrd` string. Structured communications with type "101" are reconstructed as `RmtInf/Strd/CdtrRefInf/Ref`.

### Data Precision

- **Amounts**: CODA uses 15 digits (12 integer + 3 decimal). Amounts with more than 3 decimal places are rounded. Amounts exceeding 999,999,999,999.999 cannot be represented.
- **Dates**: CODA uses DDMMYY format. Years before 1950 or after 2049 cannot be unambiguously represented in the YY → YYYY conversion.
- **Names**: Account holder name is limited to 26 characters in Record 1. Counterparty name is limited to 35 characters in Record 2.3.
- **IBAN**: Limited to 34 characters in CODA (sufficient for all current IBANs).
```

- [ ] **Step 2: Commit**

```bash
git add docs/conversion-limitations.md
git commit -m "docs: add CAMT↔CODA conversion limitations document"
```

---

### Task 12: Run full test suite and validate against private example

**Files:**
- Test: all existing tests

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Validate converter output against private example**

Run manually:
```bash
npx tsx -e "
import { parseCamt } from './src/core/camt-parser.ts';
import { statementToCoda } from './src/core/coda-writer.ts';
import { readFileSync } from 'fs';

const xml = readFileSync('specifications/private-examples/coda_BE21737051687303_EUR_2026_03_16_44_44.xml', 'utf-8');
const stmts = parseCamt(xml);
const result = statementToCoda(stmts[0]);
result.lines.forEach(l => console.log(l.raw));
"
```

Verify: Record 0 has `creationDate` from GrpHdr, `fileReference` = `00541790`. Record 2.1 has `statementSequence` matching Record 1. Record 9 count matches actual record count. Record 3.1 lines are present for each entry.

Fields that will still differ from the bank CODA (because data is not in the XML):
- Record 0: bankId (`725`), addressee (`OCTOPUS NV`), companyNumber (`00741488883`)
- Record 1: sequence (`044` — bank's counter vs our working-day calc), description
- Record 2.1: txCode (`00150000` — no BkTxCd in this XML)
- Record 2.2: customerRef, counterpartBic (not in this XML)
- Record 2.3: counterpartIBAN, counterpartName (not in this XML)

- [ ] **Step 3: Validate reverse conversion**

```bash
npx tsx -e "
import { codaToCamt } from './src/core/reverse.ts';
import { readFileSync } from 'fs';

const coda = readFileSync('specifications/private-examples/coda_BE21737051687303_EUR_2026_03_16_44_44.cod', 'utf-8');
const result = codaToCamt(coda);
console.log('Warnings:', result.warnings);
console.log('Account:', result.statement.account);
console.log('Entries:', result.statement.entries.length);
result.statement.entries.forEach((e, i) => {
  console.log('Entry', i, ':', e.amount, e.creditDebit, 'txCode:', JSON.stringify(e.transactionCode));
  e.details.forEach((d, j) => {
    console.log('  Detail', j, ':', d.counterparty, d.remittanceInfo, d.refs);
  });
});
"
```

Verify: transaction codes are stored as proprietary BBA codes (since they're not in our reverse map), counterparty data is preserved, customer refs are extracted.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test failures from spec alignment changes"
```
