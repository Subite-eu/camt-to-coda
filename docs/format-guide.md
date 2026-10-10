# Format Guide: CAMT to CODA Mapping

## CAMT Versions

| Version | Root Element | Description |
|---|---|---|
| camt.052 | `BkToCstmrAcctRpt` | Intraday bank account report |
| camt.053 | `BkToCstmrStmt` | End-of-day bank statement |
| camt.054 | `BkToCstmrDbtCdtNtfctn` | Reference schemas only; conversion unsupported |

### Key Differences: camt.052 vs camt.053

| Aspect | camt.052 | camt.053 |
|---|---|---|
| Granularity | Intraday | End-of-day |
| Balance codes | OPAV/INFO | OPBD/CLBD |
| BIC | Optional in ISO schema | Optional in ISO schema; bank profiles may require it |
| Iteration | Over `Ntry` entries; balances remain balances | Over `Ntry` entries |

## CODA Record Reference

All records are exactly **128 characters** wide.

### Record 0 — Header

| Position | Length | Description |
|---|---|---|
| 1 | 1 | Record ID = `0` |
| 2-5 | 4 | Zeros |
| 6-11 | 6 | Creation date (DDMMYY) |
| 12-14 | 3 | Bank ID or zeros |
| 15-16 | 2 | Application code = `05` |
| 17 | 1 | Duplicate indicator |
| 18-34 | 17 | Blanks |
| 35-60 | 26 | Addressee name |
| 61-71 | 11 | BIC |
| 72-82 | 11 | Company number |
| 83 | 1 | Blank |
| 84-88 | 5 | Separate application code |
| 89-120 | 32 | Transaction/related reference |
| 121-127 | 7 | Blanks |
| 128 | 1 | Version code = `2` |

### Record 1 — Opening Balance

| Position | Length | Description |
|---|---|---|
| 1 | 1 | Record ID = `1` |
| 2 | 1 | Account structure (0=BE BBAN, 1=foreign non-IBAN, 2=BE IBAN, 3=foreign IBAN) |
| 3-5 | 3 | Sequence number |
| 6-39 | 34 | Account number |
| 40-42 | 3 | Currency code |
| 43 | 1 | Balance sign (0=credit, 1=debit) |
| 44-58 | 15 | Balance (12+3 decimals) |
| 59-64 | 6 | Balance date (DDMMYY) |
| 65-90 | 26 | Account holder name |
| 91-125 | 35 | Account description |
| 126-128 | 3 | Sequence number |

### Record 2.1 — Movement

| Position | Length | Description |
|---|---|---|
| 1 | 1 | Record ID = `2` |
| 2 | 1 | Article code = `1` |
| 3-6 | 4 | Sequence number |
| 7-10 | 4 | Detail number |
| 11-31 | 21 | Bank reference |
| 32 | 1 | Movement sign (0=credit, 1=debit) |
| 33-47 | 15 | Amount (12+3 decimals) |
| 48-53 | 6 | Value date (DDMMYY) |
| 54-61 | 8 | Transaction code |
| 62 | 1 | Communication type (0=unstructured, 1=structured) |
| 63-115 | 53 | Communication |
| 116-121 | 6 | Entry date (DDMMYY) |
| 122-124 | 3 | Sequence number |
| 125 | 1 | Globalisation code |
| 126 | 1 | Next code (0=no 2.2/2.3, 1=continues) |
| 127 | 1 | Blank |
| 128 | 1 | Link code (0=no record 3, 1=record 3 follows) |

### Record 8 — Closing Balance

Record 8 has its own positions: sequence 2–4, account 5–38, currency 39–41, sign 42, closing amount 43–57, date 58–63, link 128. For Belgian BBAN (structure 0 in Record 1), account and currency use the packed account zone described in CODA 2.6 §7.5; the generic IBAN positions above do not apply.

### Record 9 — Trailer

| Position | Length | Description |
|---|---|---|
| 1 | 1 | Record ID = `9` |
| 2-16 | 15 | Blanks |
| 17-22 | 6 | Number of records (1,2.x,3.x,8) |
| 23-37 | 15 | Sum of debits |
| 38-52 | 15 | Sum of credits |
| 53-127 | 75 | Blanks |
| 128 | 1 | Multiple file code (2=last) |

## Transaction Code Mapping

| ISO 20022 (Domain/Family/SubFamily) | CODA Code | Description |
|---|---|---|
| PMNT/RCDT/ESCT | 00150000 | Incoming SEPA credit transfer |
| PMNT/ICDT/ESCT | 00101000 | Outgoing SEPA credit transfer |
| PMNT/ICDT/ISCT | 04101000 | Outgoing international transfer |
| PMNT/RCDT/ISCT | 04150000 | Incoming international transfer |
| PMNT/IDDT/ESDD | 00501000 | SEPA direct debit outgoing |
| PMNT/RDDT/ESDD | 00550000 | SEPA direct debit incoming |
| PMNT/RCDT/INST | 00250000 | Instant SEPA credit transfer in |
| PMNT/ICDT/INST | 00201000 | Instant SEPA credit transfer out |
| PMNT/CCRD/* | 00402000 | Card payment |
| CAMT/ACCB/INTR | 03550000 | Interest |
| CAMT/ACCB/CHRG | 03537000 | Bank charges |
| (unknown) | 8 spaces | Fallback |

## Structured Communication

When `RmtInf/Strd/CdtrRefInf/Ref` is present in CAMT:
- Communication type = `1` (structured)
- Format: `101` + valid 12-digit reference, including mod-97 checksum; an invalid checksum is preserved as unstructured communication with a warning

Belgian structured communication format: `+++NNN/NNNN/NNNNN+++`

## Conformance references

Mappings are governed by CODA 2.6 Annexe I, §§5–7 (record sequence/links, monetary detail numbering, account layouts, trailer count and totals), AOS1 OGM-VCS for structured reference checksums, and the checked-in ISO `camt.052/053.001.02` through `.13` XSDs for namespace and version-specific XML choices. See the required public source manifest for independently authored examples and schema/semantic checks. Runtime validation does not claim full XSD compliance.
