# CAMT ↔ CODA Field-Level Mapping Matrix

Audited against the FEBELFIN specifications in `specifications/`:
- **CODA 2.6** (`CODA/standard-coda-2.6-en.pdf`) — record layouts (Annexe I), transaction codes (Annexe II), structured comms (Annexe III).
- **Belgian CAMT053 v2.1** (`CAMT/standard-camt053-statement-v2.1_0.pdf`) — CAMT element list (§2.x).
- **AOS1 OGM-VCS** (`CAMT/aos.pdf`).

Verdict legend: ✅ correct · ⚠️ approximation/documented loss · ❌ wrong vs spec · ⛔ spec field not populated.

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
| 2 | 1 | Account structure (0/2/3) | derived from IBAN | ✅ | — | ✅ |
| 3–5 | 3 | Paper statement sequence **or zeros** | `Stmt/ElctrncSeqNb` (approx) | ⚠️ | ✅ | ⚠️ see Findings #2 |
| 6–42 | 37 | Account number + currency | `Acct/Id/IBAN` + `Acct/Ccy` | ✅ | ✅ | ✅ |
| 43 | 1 | Old balance sign (0=cr,1=db) | `Bal[OPBD]/CdtDbtInd` | ✅ | ✅ | ✅ |
| 44–58 | 15 | Old balance (12 int + 3 dec) | `Bal[OPBD]/Amt` | ✅ | ✅ | ✅ (3-dec, money.ts) |
| 59–64 | 6 | Balance date DDMMYY | `Bal[OPBD]/Dt/Dt` | ✅ | ✅ | ✅ |
| 65–90 | 26 | Account holder name | `Acct/Ownr/Nm` | ✅ | ✅ | ✅ |
| 91–125 | 35 | Account description | — (bank product name) | blank | — | ⛔ (doc'd) |
| 126–128 | 3 | CODA file sequence (001+/yr) | — | repeats pos 3–5 | — | ⚠️ see Findings #2 |

## Record 2.1 — Movement  (`record21-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Verdict |
|-----|-----|--------------|-------------|---------|
| 11–31 | 21 | Bank reference | `Ntry/AcctSvcrRef` (pref) / `NtryRef` | ✅ |
| 32 | 1 | Movement sign (0=cr,1=db) | `Ntry/CdtDbtInd` | ✅ |
| 33–47 | 15 | Amount (12+3) | `Ntry/Amt` | ✅ |
| 48–53 | 6 | Value date DDMMYY | `Ntry/ValDt/Dt` | ✅ |
| 54–61 | 8 | Transaction code | `Ntry/BkTxCd` (see Findings #3) | ⚠️ |
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
| 113 | 1 | R-transaction type | `Ntry/RvslInd` + R-codes (partial) | ⛔ Findings #4 |
| 114–117 | 4 | ISO reason code | `TxDtls/RtrInf/Rsn` | ⛔ Findings #4 |
| 118–121 | 4 | CategoryPurpose | `TxDtls/Purp` / `CtgyPurp` | ⛔ Findings #4 |
| 122–125 | 4 | Purpose | `TxDtls/Purp/Cd` | ⛔ Findings #4 |

## Record 2.3 — Counterparty  (`record23-fields.ts`) — ✅ aligned

| Pos | Len | CODA meaning | CAMT source | Verdict |
|-----|-----|--------------|-------------|---------|
| 11–47 | 37 | Counterparty account + ccy | `RltdPties/{Cdtr,Dbtr}Acct/Id/IBAN` | ✅ |
| 48–82 | 35 | Counterparty name | `RltdPties/{Cdtr,Dbtr}/Nm` | ✅ |
| 83–125 | 43 | Communication zone 3 | `RmtInf` (cont.) | ✅ |

## Record 3.1 — Information  (`record31-fields.ts`) — ❌ MISALIGNED (Findings #1)

Spec (CODA 2.6 p.22) vs current field-defs:

| Pos (spec) | Len | CODA meaning (spec) | Current `record31-fields.ts` | Verdict |
|-----|-----|--------------|------------------------------|---------|
| 11–31 | 21 | Bank reference | `bankReference` 10/21 (pos 11–31) | ✅ |
| **32–39** | 8 | **Transaction code** | `txCodeType` 31/1 **then** `transactionCode` 32/8 (pos 33–40) | ❌ shifted +1 |
| **40** | 1 | Comm type (0/1) | `communicationType` 40/1 (pos 41) | ❌ |
| **41–113** | 73 | Communication | `communication` 41/73 (pos 42–114) | ❌ |
| **114–125** | 12 | **Blank** | invents `entryDate`/`sequence`/`globalisationCode` | ❌ |
| **126** | 1 | Next code | `nextCode` 124/1 (pos 125) | ❌ |
| **128** | 1 | Link code | `linkCode` 126/1 (pos 127) | ❌ |

An extra `txCodeType` byte at pos 32 shifts the 8-char transaction code and everything after it; the trailing region the spec reserves as blank is filled with movement-style fields. Line length stays 128 so the existing tests pass, but a bank reading pos 32–39 gets a shifted/garbled transaction code. Siblings 3.2/3.3 are correct, confirming 3.1 is the outlier.

## Record 3.2 / 3.3 — Information cont.  — ✅ aligned
`record32-fields.ts` (comm 11–115, blank 116–125, next 126, link 128) and `record33-fields.ts` (comm 11–100, blank 101–125, next 126, link 128) match the spec.

## Record 4 — Free communication  (`record4-fields.ts`) — ❌ header misaligned (latent)
Spec: pos 2 blank, 3–6 sequence, 7–10 detail. Current: `detailNumber` 1/4 (pos 2–5), `sequenceNumber` 5/4 (pos 6–9). Text field (33–112) is correct. **Low impact: Record 4 is never generated** — flag, fix if it is ever emitted.

## Record 8 — New balance  (`record8-fields.ts`) — ✅ aligned
seq 2–4, account+ccy 5–41, sign 42, balance 43–57 (12+3), date 58–63, blank 64–127, link 128. Matches spec; reconciled against Record 1 + movements (see coda-writer).

## Record 9 — Trailer  (`record9-fields.ts`) — ✅ aligned
record count (1,2.x,3.x,8) 17–22, debit sum 23–37 (12+3), credit sum 38–52 (12+3), multiple-file code 128. Matches spec; sums computed in integer thousandths (money.ts).

---

## Findings (actionable)

1. **❌ Record 3.1 field misalignment (HIGH).** Fix `record31-fields.ts` to the spec layout (transaction code 32–39, comm-type 40, communication 41–113, blank 114–125, next 126, link 128), update `record31.ts` builder, the Record 3.1 path in `coda-to-statement.ts`, and tests. Behaviour change to generated Record 3.1 — gate on golden test.
2. **⚠️ Statement sequence (Record 1 pos 3–5 vs 126–128).** Spec allows pos 3–5 to be zeros; the *incrementing* CODA file counter belongs in pos 126–128. The converter puts the working-day approximation in pos 3–5. Acceptable approximation, already noted in `conversion-limitations.md`; revisit if a bank rejects it.
3. **⚠️ Transaction codes.** Forward ISO→CODA map covers ~10 SEPA cases; BBA passthrough handles the rest. Annexe II has the full family/transaction table — see A7 (`coda-transaction-codes.ts`).
4. **⛔ Record 2.2 unmapped slots.** R-transaction type (113), ISO reason (114–117), CategoryPurpose (118–121), Purpose (122–125) are left blank. Data exists in CAMT (`RvslInd`, `RtrInf/Rsn`, `Purp`) — already listed in `conversion-limitations.md`. Map if a downstream consumer needs them.
5. **❌ Record 4 header (LOW, latent).** Misaligned but never generated.

Records 0, 1, 2.1, 2.2, 2.3, 3.2, 3.3, 8, 9 field positions are spec-correct.
