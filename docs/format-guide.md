# Format Guide: CAMT to CODA Mapping

## CAMT Versions

| Version | Root Element | Description |
|---|---|---|
| camt.052 | `BkToCstmrAcctRpt` | Intraday bank account report |
| camt.053 | `BkToCstmrStmt` | End-of-day bank statement |
| camt.054 | `BkToCstmrDbtCdtNtfctn` | Debit/credit notification |

### Key Differences: camt.052 vs camt.053

| Aspect | camt.052 | camt.053 |
|---|---|---|
| Granularity | Intraday | End-of-day |
| Balance codes | OPAV/INFO | OPBD/CLBD |
| BIC | Optional | Mandatory |
| Iteration | Over `Bal` entries | Over `Ntry` entries |

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
| 2 | 1 | Account structure (2=BE IBAN, 3=foreign IBAN) |
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

Same structure as Record 1 but with closing balance values.

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
| PMNT/RCDT/ESCT | 04500001 | Incoming SEPA credit transfer |
| PMNT/ICDT/ESCT | 13010001 | Outgoing SEPA credit transfer |
| PMNT/ICDT/ISCT | 41010000 | Outgoing international transfer |
| PMNT/RCDT/ISCT | 41500000 | Incoming international transfer |
| PMNT/IDDT/ESDD | 05010000 | SEPA direct debit outgoing |
| PMNT/RDDT/ESDD | 05500000 | SEPA direct debit incoming |
| PMNT/RCDT/INST | 02500001 | Instant SEPA credit transfer in |
| PMNT/ICDT/INST | 02010001 | Instant SEPA credit transfer out |
| PMNT/CCRD/* | 04370000 | Card payment |
| CAMT/ACCB/INTR | 35010000 | Interest |
| CAMT/ACCB/CHRG | 80370000 | Bank charges |
| (unknown) | 8 spaces | Fallback |

## Structured Communication

When `RmtInf/Strd/CdtrRefInf/Ref` is present in CAMT:
- Communication type = `1` (structured)
- Format: `101` + 12-digit reference (padded with zeros)

Belgian structured communication format: `+++NNN/NNNN/NNNNN+++`
