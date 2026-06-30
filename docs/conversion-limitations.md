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
| 2.2 | R-Transaction Type | 113 | Reject/Return/Refund/Reversal/Cancellation indicator | Only partially derivable from ReversalIndicator |
| 2.2 | ISO Reason Code | 114-117 | Reason code for R-transactions | Available in CAMT but not currently mapped |
| 2.2 | CategoryPurpose | 118-121 | SEPA category purpose code | Available in CAMT `Purp` but not currently mapped |
| 2.2 | Purpose | 122-125 | SEPA purpose code | Available in CAMT `Purp` but not currently mapped |

### Sequence Number

The CODA sequence number (Record 1 pos 3-5, Record 8 pos 2-4) represents the bank's running counter for statements on that account. When `ElctrncSeqNb` is present in CAMT, it is used directly. Otherwise, a working-day count from January 1st is computed as an approximation -- this may not match the bank's actual counter.

**Belgian working-day calendar.** The working-day count uses the statutory Belgian public holidays plus Good Friday, Easter Monday, Ascension, and Whit Monday. It does **not** model FEBELFIN's year-specific substitution/"bridge" days (e.g. the day after Ascension, or a weekday substitute when a fixed holiday falls on a weekend), because those are published per year rather than by a fixed rule. In years where such a substitution applies, the computed sequence may be off by one. The authoritative path remains `ElctrncSeqNb` from the CAMT file when present.

### Transaction Codes

When the CAMT XML includes a BBA proprietary code (`BkTxCd/Prtry/Cd` with `Issr=BBA`), it is used directly as the 8-digit CODA transaction code. When only ISO Domain/Family/SubFamily codes are present, a mapping table is used. This table covers common SEPA transaction types but not all 150+ CODA transaction codes. Unmapped ISO codes produce blank transaction codes.

## CODA to CAMT: Fields that cannot be reconstructed

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

When converting CODA to CAMT, the 8-digit CODA transaction code is reverse-mapped to ISO Domain/Family/SubFamily. Only codes present in the mapping table can be converted. Unknown codes are stored as `BkTxCd/Prtry/Cd` with `Issr=BBA`.

### Communication / Remittance Info

- **CAMT to CODA**: Unstructured remittance info is split across communication zones (Record 2.1: 53 chars, Record 2.2: 53 chars, Record 2.3: 43 chars = 149 chars total). Text beyond 149 characters is truncated. Structured Belgian creditor references (OGM/VCS) are encoded as type "101" + 12-digit reference.
- **CODA to CAMT**: Communication zones are concatenated back into a single `RmtInf/Ustrd` string. Structured communications with type "101" are reconstructed as `RmtInf/Strd/CdtrRefInf/Ref`.

### Data Precision

- **Amounts**: CODA uses 15 digits (12 integer + 3 decimal). Amounts with more than 3 decimal places are rounded. Amounts exceeding 999,999,999,999.999 cannot be represented.
- **Dates**: CODA uses DDMMYY format. Years before 1950 or after 2049 cannot be unambiguously represented in the YY to YYYY conversion.
- **Names**: Account holder name is limited to 26 characters in Record 1. Counterparty name is limited to 35 characters in Record 2.3.
- **IBAN**: Limited to 34 characters in CODA (sufficient for all current IBANs).
