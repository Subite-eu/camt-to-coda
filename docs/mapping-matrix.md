# CAMT ↔ CODA Field-Level Mapping Matrix

Current implementation reference, checked against the code and the specifications in `specifications/`. For dated findings, see the [audit reports](README.md#dated-evidence-and-historical-plans).

Authoritative references:
- **CODA 2.6** (`CODA/standard-coda-2.6-en.pdf`) — record layouts (Annexe I), transaction codes (Annexe II), structured comms (Annexe III).
- **Belgian CAMT053 v2.1** (`CAMT/standard-camt053-statement-v2.1_0.pdf`) — CAMT element list (§2.x).
- **AOS1 OGM-VCS** (`CAMT/aos.pdf`).

Legend: ✅ mapped · ⚠️ approximation/documented loss · ⛔ unavailable from the modeled source. Mapped fields may still be truncated to fixed-width capacity; see [conversion limitations](conversion-limitations.md).

Positions are 1-indexed (as in the CODA spec). `field-defs/*` use 0-indexed `start` = pos − 1.

---

## Record 0 — Header  (`record0-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Fwd | Rev | Verdict |
|-----|-----|--------------|-------------|-----|-----|---------|
| 1 | 1 | Record id = 0 | — | const | — | ✅ |
| 6–11 | 6 | Creation date DDMMYY | `GrpHdr/CreDtTm` | ✅ | ✅ | ✅ |
| 12–14 | 3 | Bank id number or zeros | — (not in CAMT) | zeros | — | ⛔ (doc'd) |
| 15–16 | 2 | Application code = 05 | — | const 05 | — | ✅ |
| 35–60 | 26 | Addressee name | — (client-specific) | blank | — | ⛔ (doc'd) |
| 61–71 | 11 | BIC of the bank | `Acct/Svcr/FinInstnId/BIC(FI)` | ✅ | ✅ | ✅ |
| 72–82 | 11 | BE company number (0+KBO) | — | blank | — | ⛔ (doc'd) |
| 128 | 1 | Version code = 2 | — | const 2 | — | ✅ |

## Record 1 — Old balance  (`record1-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Fwd | Rev | Verdict |
|-----|-----|--------------|-------------|-----|-----|---------|
| 2 | 1 | Account structure (0/1/2/3) | derived from IBAN/Other account identifier | ✅ | ✅ | ✅ |
| 3–5 | 3 | Paper statement sequence **or zeros** | `ElctrncSeqNb`, then `LglSeqNb`, else working-day fallback | ⚠️ | ✅ | ⚠️ see sequence policy below |
| 6–42 | 37 | Account number + currency | `Acct/Id/IBAN` + `Acct/Ccy` | ✅ | ✅ | ✅ |
| 43 | 1 | Old balance sign (0=cr,1=db) | `Bal[OPBD]/CdtDbtInd` | ✅ | ✅ | ✅ |
| 44–58 | 15 | Old balance (12 int + 3 dec) | `Bal[OPBD]/Amt` | ✅ | ✅ | ✅ (3-dec, money.ts) |
| 59–64 | 6 | Balance date DDMMYY | `Bal[OPBD]/Dt/Dt` | ✅ | ✅ | ✅ |
| 65–90 | 26 | Account holder name | `Acct/Ownr/Nm` | ✅ | ✅ | ✅ |
| 91–125 | 35 | Account description | — (bank product name) | blank | — | ⛔ (doc'd) |
| 126–128 | 3 | CODA file sequence (001+/yr) | — | repeats pos 3–5 | — | ⚠️ see sequence policy below |

## Record 2.1 — Movement  (`record21-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Verdict |
|-----|-----|--------------|-------------|---------|
| 11–31 | 21 | Bank reference | `Ntry/AcctSvcrRef` (pref) / `NtryRef` | ✅ |
| 32 | 1 | Movement sign (0=cr,1=db) | `Ntry/CdtDbtInd` | ✅ |
| 33–47 | 15 | Amount (12+3) | `Ntry/Amt` | ✅ |
| 48–53 | 6 | Value date DDMMYY | `Ntry/ValDt/Dt` | ✅ |
| 54–61 | 8 | Transaction code | `Ntry/BkTxCd` (see transaction-code policy below) | ⚠️ |
| 62 | 1 | Comm type (0/1) | derived | ✅ |
| 63–115 | 53 | Communication zone 1 | `RmtInf` (Ustrd/Strd) | ✅ |
| 116–121 | 6 | Entry/booking date DDMMYY | `Ntry/BookgDt/Dt` | ✅ |
| 122–124 | 3 | Statement sequence | computed | ✅ |
| 125 | 1 | Globalisation code | — | ✅ |
| 126 | 1 | Next code (2.2/2.3 follows) | derived | ✅ |
| 128 | 1 | Link code (record 3 follows) | derived | ✅ |

## Record 2.2 — Movement cont.  (`record22-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Verdict |
|-----|-----|--------------|-------------|---------|
| 11–63 | 53 | Communication zone 2 | `RmtInf` (cont.) | ✅ |
| 64–98 | 35 | Customer reference | `TxDtls/Refs/EndToEndId` | ✅ |
| 99–109 | 11 | Counterparty BIC | `RltdAgts/{Cdtr,Dbtr}Agt/FinInstnId/BIC` | ✅ |
| 113 | 1 | R-transaction type | `Ntry/RvslInd` → 4; booked return reason → 2 | ⚠️ other R-types need additional context |
| 114–117 | 4 | ISO reason code | `TxDtls/RtrInf/Rsn/Cd` | ✅ |
| 118–121 | 4 | CategoryPurpose | `TxDtls/PmtTpInf/CtgyPurp/Cd` | ⚠️ reverse XML v10–13 only |
| 122–125 | 4 | Purpose | `TxDtls/Purp/Cd` | ✅ |

## Record 2.3 — Counterparty  (`record23-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Verdict |
|-----|-----|--------------|-------------|---------|
| 11–47 | 37 | Counterparty account + ccy | `RltdPties/{Cdtr,Dbtr}Acct/Id/IBAN` | ✅ |
| 48–82 | 35 | Counterparty name | `RltdPties/{Cdtr,Dbtr}/Nm` | ✅ |
| 83–125 | 43 | Communication zone 3 | `RmtInf` (cont.) | ✅ |

## Record 3.1 — Information (`record31-fields.ts`) — ✅ aligned

CODA 2.6 Annexe I (information record layout, p.22) is implemented without an extra transaction-type byte:

| Pos | Len | Meaning | Implementation |
|---|---|---|---|
| 3–6 | 4 | Movement sequence | Same sequence as the related movement |
| 7–10 | 4 | Detail number | Related information detail |
| 11–31 | 21 | Bank reference | Detail/entry reference |
| 32–39 | 8 | Transaction code | `transactionCode`, zero-based start 31 |
| 40 | 1 | Communication type | `communicationType`, start 39 |
| 41–113 | 73 | Communication | `communication`, start 40 |
| 114–125 | 12 | Blanks | No movement date/sequence/globalisation fields here |
| 126 | 1 | Next code | Record 3.2 continuation |
| 127 | 1 | Blank | Reserved |
| 128 | 1 | Link code | Computed from the complete record sequence |

## Record 3.2 / 3.3 — Information cont.  — ✅ aligned
`record32-fields.ts` (comm 11–115, blank 116–125, next 126, link 128) and `record33-fields.ts` (comm 11–100, blank 101–125, next 126, link 128) match the spec.

## Record 4 — Free communication (`record4-fields.ts`) — ✅ aligned

Generated by `coda-writer.ts` after Record 8, as well as parsed on reverse input. Layout: record ID at 1, blank at 2, sequence at 3–6, detail number at 7–10, blanks at 11–32, 80-character communication at 33–112, blanks at 113–127 and link at 128. Text longer than 80 characters is split across linked records. Record 8 links to the first Record 4 when present.

The model's `freeCommunications` maps to CAMT 053 `Stmt/AddtlStmtInf`. Reverse reconstruction retains Record 4 text separately from movement remittance. Record 4 is excluded from the trailer count. Reverse parsing trims trailing spaces from each chunk, and XML serialization joins physical chunks with newlines. Original whitespace and chunk boundaries therefore do not round-trip exactly.

## Record 8 — New balance  (`record8-fields.ts`) — ✅ aligned
seq 2–4, account+ccy 5–41, sign 42, balance 43–57 (12+3), date 58–63, blank 64–127, link 128. Matches spec; reconciled against Record 1 + movements (see coda-writer).

## Record 9 — Trailer  (`record9-fields.ts`) — ✅ aligned
record count (1,2.x,3.x,8) 17–22, debit sum 23–37 (12+3), credit sum 38–52 (12+3), multiple-file code 128. Matches spec; sums computed in integer thousandths (money.ts).

---

## Current mapping policies and remaining boundaries

- **Account layout:** structures 0/1/2/3 represent Belgian BBAN, foreign non-IBAN, Belgian IBAN and foreign IBAN. Structure 0 uses the packed 37-character account zone (CODA 2.6 §7.5): Record 1 currency is at 19–21 and Record 8 currency at 18–20. Generic IBAN currency positions do not apply to BBAN.
- **Sequence policy:** for CAMT 053, a nonzero `ElctrncSeqNb`, or `LglSeqNb` fallback, is reduced modulo 1000 to fit the three-digit field. Otherwise (also for CAMT 052) the writer approximates a sequence using working days from January 1 and the account prefix's EEA country calendar. Unknown prefixes use weekdays only. Record 1 repeats this value at 3–5 and 126–128; it is not a separately maintained bank file counter.
- **Transaction codes:** an eight-digit BBA proprietary code takes precedence (an issuerless eight-digit proprietary code is also accepted when no domain is present). ISO fallback mappings cover common SEPA, direct debit, international, card and interest/charges cases; some are approximations. Unknown ISO combinations remain blank. Reverse conversion supplies recognized ISO mappings and preserves the CODA code as BBA proprietary data. `coda-transaction-codes.ts` exposes Annexe II descriptions; that catalog is broader than the ISO fallback map.
- **Monetary details:** an aggregate movement has detail number `0000`; independently valued details use nonzero detail numbers on 2.x records with the same movement sequence. They are reconstructed as detail amounts and do not count again in trailer debit/credit totals. Amountless details and extended communications use 3.x information records. Each detail communication has a total capacity of 268 characters, with warnings beyond it. Later amountless sibling details retain communication but cannot independently retain counterparty/reference metadata through 3.x records; their own purpose, category purpose and return fields may also be lost. Independently valued monetary details use separate 2.x records for that metadata.
- **R-transactions and purposes:** Record 2.2 retains reversal/return type, ISO reason, purpose and category purpose. Reasons are associated with their own detail rather than copied to unrelated siblings. Category purpose is serialized to `PmtTpInf/CtgyPurp` only in CAMT 053 v10–13. Reject/refund/cancellation classification cannot be inferred reliably from a booked statement alone.
- **Trailer:** count includes Records 1, 2.x, 3.x and 8; it excludes 0, 4 and 9. Debit/credit sums use integer thousandths and aggregate movements only. The complete emitted sequence determines continuation/link fields.
- **Version boundaries:** CAMT 052/053 v02–13 are accepted; reverse XML is CAMT 053 v02–13, default .08. v02 cannot carry an independent opposite-sign monetary detail; v03–06 require amounts for multiple details. These unsupported combinations are rejected explicitly.

The former Record 3.1 alignment and Record 4 header defects are repaired. Unavailable bank/client-specific fields and unavoidable format losses remain documented in [conversion limitations](conversion-limitations.md). Runtime validation checks modeled rules; independent XSD checks run in the public-source test suite and CI.
