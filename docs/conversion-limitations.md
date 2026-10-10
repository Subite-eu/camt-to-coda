# CAMT - CODA Conversion Limitations

## Overview

This document describes fields that cannot be faithfully converted between CAMT (ISO 20022 XML) and CODA (Belgian fixed-width bank statement) formats. Some data exists only in one format and is lost during conversion.

## CAMT to CODA: Fields that cannot be populated from XML alone

These CODA fields require data that is not present in standard CAMT 053 XML:

| CODA Record | Field | Positions | Description | Reason |
|-------------|-------|-----------|-------------|--------|
| 0 | Bank ID | 12-14 | 3-digit bank identification number | Bank-internal identifier, not in CAMT |
| 0 | Addressee | 35-60 | Name of the CODA file recipient | Client-specific, not in CAMT |
| 0 | Company Number | 72-82 | Belgian company number (KBO/BCE) | Not part of ISO 20022 |
| 1 | Account Description | 91-125 | Bank product name (e.g., "KBC-Business PRO-rekening") | Commercial name, not in CAMT |

### Return and purpose fields: mapped with limits

| CODA Record | Field | Positions | Description | Mapping boundary |
|---|---|---|---|---|
| 2.2 | R-Transaction Type | 113 | Reject/Return/Refund/Reversal/Cancellation indicator | Mapped: `RvslInd`→Reversal (4), else a booked entry with a return reason→Return (2). Reject/Refund/Cancellation need message-type context absent from a booked camt.053 entry. |
| 2.2 | ISO Reason Code | 114-117 | Reason code for R-transactions (EPC173-14) | Mapped from/to `TxDtls/RtrInf/Rsn/Cd` |
| 2.2 | CategoryPurpose | 118-121 | SEPA category purpose code | Reconstructed as `PmtTpInf/CtgyPurp` in CAMT v10–13; older output versions cannot retain this field |
| 2.2 | Purpose | 122-125 | SEPA purpose code | Mapped from/to `TxDtls/Purp/Cd` |

### Sequence Number

The CODA sequence number (Record 1 pos 3-5, Record 8 pos 2-4) represents the bank's running counter for statements on that account. For CAMT 053, a nonzero `ElctrncSeqNb`, or `LglSeqNb` fallback, is reduced modulo 1000 for the three-digit CODA field. Otherwise (including CAMT 052 inputs), a working-day count from January 1st is computed as an approximation. The account identifier prefix selects one of 30 modeled EEA calendars; an unknown prefix uses weekdays only. This may not match the bank's actual counter. Record 1 repeats the value in positions 126–128 rather than maintaining an independent bank file counter.

**Belgian working-day calendar.** The working-day count uses the statutory Belgian public holidays plus Good Friday, Easter Monday, Ascension, and Whit Monday. It does **not** model FEBELFIN's year-specific substitution/"bridge" days (e.g. the day after Ascension, or a weekday substitute when a fixed holiday falls on a weekend), because those are published per year rather than by a fixed rule. In years where such a substitution applies, the computed sequence may be off by one. The authoritative path remains `ElctrncSeqNb` from the CAMT file when present.

### Transaction Codes

When the CAMT XML includes a BBA proprietary code (`BkTxCd/Prtry/Cd` with `Issr=BBA`), it is used directly as the 8-digit CODA transaction code. When only ISO Domain/Family/SubFamily codes are present, a mapping table is used (see `src/core/transaction-codes.ts`, derived from CODA 2.6 Annexe II and verified against a real `.cod`). This table covers common SEPA/direct-debit/international/card/interest cases; the full Annexe II reference is encoded in `src/core/coda-transaction-codes.ts`. Unmapped ISO codes produce blank transaction codes.

**No `BkTxCd` at all.** Some real bank CAMT files carry no `BkTxCd` element; the bank assigns the CODA transaction code from its own systems. When the element is absent the converter cannot derive a code and leaves the CODA transaction-code field blank.

## CODA to CAMT: Fields that cannot be reconstructed

These CAMT fields cannot be fully reconstructed from a CODA file:

| CAMT Element | Description | Reason |
|--------------|-------------|--------|
| `GrpHdr/CreDtTm` | Creation timestamp with timezone | CODA only stores date (DDMMYY), no time/timezone |
| `Stmt/FrToDt` | Statement period (from/to dates) | Not present in CODA |
| `Ntry/Sts` | Original entry status (BOOK, PDNG, etc.) | Not represented in CODA; reverse output explicitly uses BOOK |
| `TxDtls/RltdPties` | Full party details (address, ID) | CODA only stores name (35 chars) and IBAN (34 chars) |
| `TxDtls/RltdAgts` | Debtor/Creditor agent distinction | CODA stores one BIC (11 chars) without indicating which agent |
| `TxDtls/Refs/InstrId` | Instruction identification | Not preserved in CODA (only EndToEndId in customerRef) |
| `TxDtls/Refs/TxId` | Transaction identification | Lost during CODA conversion (used as fallback comm only) |
| `Ntry/AddtlNtryInf` | Additional entry information | No direct CODA equivalent |
| `TxDtls/Chrgs` | Charges detail | Not mapped to CODA fields |
| `TxDtls/Tax` | Tax information | Not mapped to CODA fields |

### Transaction Code Reverse Mapping

When converting CODA to CAMT, the 8-digit CODA transaction code is reverse-mapped to ISO Domain/Family/SubFamily. Recognized codes receive the corresponding ISO mapping. The original code is also retained as `BkTxCd/Prtry/Cd` with `Issr=BBA`, including unknown codes.

### Communication / Remittance Info

- **CAMT to CODA**: Unstructured remittance info is split across communication zones (Record 2.1: 53 chars, Record 2.2: 53 chars, Record 2.3: 43 chars = 149 chars total). Record 3.1/3.2/3.3 provide a parallel information representation of each detail communication up to 268 characters; text beyond that capacity is truncated with a visible warning. Structured Belgian creditor references (OGM/VCS) with a valid mod-97 checksum and compatible type/issuer are encoded as type "101" + 12-digit reference; RF references or invalid OGM are carried as unstructured text with notes where applicable.
- **CODA to CAMT**: Communication zones are concatenated back into a single `RmtInf/Ustrd` string. Structured communications with type "101" are reconstructed as `RmtInf/Strd/CdtrRefInf/Ref`.

### Amountless transaction details

Information records retain later amountless siblings' communications, but have no independent counterparty/customer-reference slots. Only the first amountless detail contributes that metadata through movement continuations; later siblings lose their own parties and EndToEndIds, with a conversion warning. Their own purpose, category purpose and return fields may also be lost. Independently valued monetary details use separate 2.x records and can carry their own metadata.

### Data Precision

- **Amounts**: CODA uses 15 digits (12 integer + 3 decimal). Values not exactly representable in three decimals are rejected (extra trailing zeros are allowed); mixed entry/account currencies are rejected instead of relabeled. Amounts exceeding 999,999,999,999.999 cannot be represented.
- **Dates**: CODA preserves the calendar-date portion of timestamps, losing time and timezone. Reverse creation timestamps use midnight UTC when only a date is available. CODA uses DDMMYY format. The reverse parser interprets YY 00–50 as 2000–2050 and 51–99 as 1951–1999; dates outside 1951–2050 cannot round-trip their century.
- **Detail dates**: CODA monetary-detail dates remain in the reconstructed model, but CAMT `TxDtls` has no direct booking/value-date equivalent. Reverse XML uses the aggregate entry dates and reports differing detail dates as a warning.
- **Names**: Account holder name is limited to 26 characters in Record 1. Counterparty name is limited to 35 characters in Record 2.3.
- **IBAN**: Limited to 34 characters in CODA (sufficient for all current IBANs).


## Validation, privacy and completeness boundaries

Runtime validation checks XML syntax, supported namespace/message structure, required modeled fields, numeric domains, dates, CODA record order/width/continuations/counts/totals and balance reconciliation. It is deliberately labeled runtime validation and does not claim full XSD validation. CI independently checks public original CAMT documents and generated reverse XML against all supported bundled schemas. Unsupported output versions fail explicitly.

All logical CODA files are reconstructed as statements in a single reverse CAMT document. `codaToCamt` exposes `statements` while retaining `statement` as the first statement for compatibility. Forward browser conversion exposes every generated CODA file. Record 4 free communications are modeled separately and carried through CAMT 053 `AddtlStmtInf`, carrying free text into reverse XML and subsequent conversions. Reverse parsing trims trailing spaces from each Record 4 chunk and XML joins physical chunks with newlines, so original whitespace and chunk boundaries are not preserved exactly. The CAMT 052 parser does not retain statement-level additional text or explicit statement sequences; those inputs use the working-day sequence fallback.

Browser Anonymize applies to the exported artifact and result preview; the source pane intentionally retains the original. Names, accounts, bank identifiers, references and free text are removed or replaced. Amounts, dates, currency and transaction patterns remain, and deterministic pseudonyms can be linked across files. Reverse privacy XML uses synthetic Other account identifiers. Forward CODA privacy identifiers are demonstration data and must not be imported into banking software. Privacy conversion must succeed and produce a meaningful artifact; an empty result is never a successful privacy export.

CODA movement and detail counters are four digits. Conversion rejects statements with more than 9,999 movements or more than 9,999 details in a movement before emitting output; split larger statements explicitly. The browser also rejects input beyond 5 MiB.

CAMT v02 carries detail amounts through `AmtDtls/TxAmt/Amt` and inherits the aggregate direction. Opposite-sign monetary details cannot be emitted faithfully in v02 and are explicitly rejected; choose v03 or newer. v03–06 require an amount for every detail when more than one is present, and reject amountless multiple information details instead of inventing monetary values.

The browser UI processes statement contents locally. The separate [HTTP API](http-api.md) receives original uploads on the server, with a default 10 MiB body cap, and supports privacy results in both directions. The CLI supports privacy output only for forward `convert --anonymize`; there is no standalone anonymization command.
