# Architecture

## Design Patterns

### Template Method Pattern

The core converter uses an abstract base class with generic type parameters:

```
CamtToCoda<T, P extends Params<T>>
├── CamtToCodaFs    (T=File, P=FsParams)     — Filesystem implementation
└── CamtToCodaS3    (T=String, P=S3Params)   — S3 implementation
```

The abstract base defines the conversion algorithm:
1. Parse CLI arguments
2. Detect CAMT version from XML namespace
3. Select matching XSLT file
4. Transform with Saxon
5. Validate output (128-char lines)
6. Store/archive/error

Subclasses implement I/O operations: `sourceExist()`, `toStreamSource()`, `store()`, `putFileInArchive()`, etc.

### XSLT Pipeline

```
                      ┌─────────────────────┐
                      │ Version-specific     │
                      │ (camt.053.001.08)    │
                      │ - Document structure │
                      │ - Field extraction   │
                      │ - Record emission    │
                      └────────┬────────────┘
                               │ includes
                      ┌────────▼────────────┐
                      │ Generic             │
                      │ (camt.053.001.XX)   │
                      │ - Record templates  │
                      │ - Utility functions │
                      └────────┬────────────┘
                               │ includes
                      ┌────────▼────────────┐
                      │ Shared              │
                      │ (camt.05X.001.XX)   │
                      │ - Common functions  │
                      │ - Debug support     │
                      └────────┬────────────┘
                               │ includes
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼──────────────┐
    │ DateUtils.xslt │ │AmountUtils   │ │TransactionCodeUtils │
    │ - date format  │ │- balance fmt │ │- ISO→CODA mapping   │
    └────────────────┘ │- sign codes  │ └─────────────────────┘
                       └──────┬───────┘
                              │ includes
                       ┌──────▼───────┐
                       │StringUtils   │
                       │- pad left    │
                       │- pad right   │
                       └──────────────┘
```

### Saxon Extension Functions

Custom Java functions registered with the Saxon processor:

- **`cf:nb-working-days-this-year(iban, date)`** — Computes working-day sequence number from January 1st. Country-aware: uses holiday calendars for BE, LT, NL.
- **`cf:throwError(message)`** — Throws `CustomXsltException` with a descriptive message from within XSLT.

## Module Dependencies

```
CamtToCoda ──depends-on──> FileManager (S3 operations)
CamtToCoda ──depends-on──> TestTools (Docker detection, test scope)
```

## Data Flow

```
Input (CAMT XML)
    │
    ├── Namespace regex scan → version detection (e.g., camt.053.001.08)
    │
    ├── XSLT file lookup: exact match → fallback to XX
    │
    ├── Saxon transformation:
    │   ├── Record 0: Header (BIC, date)
    │   ├── Record 1: Opening balance
    │   ├── For each Ntry:
    │   │   ├── Record 2.1: Movement (amount, tx code, communication)
    │   │   ├── Record 2.2: Counterparty BIC (optional)
    │   │   ├── Record 2.3: Counterparty account/name (optional)
    │   │   └── Record 3.1-3.3: Batch details (optional, if >1 TxDtls)
    │   ├── Record 8: Closing balance
    │   └── Record 9: Trailer (counts, sums)
    │
    ├── Validation: each line must be exactly 128 characters
    │
    └── Output: .cod file(s) in target directory
```

## Validation Pipeline

```
Pre-flight (optional):
    ├── XSD Schema Validation (structural correctness)
    └── Business Rule Validation (semantic correctness)

Post-transformation:
    └── Line length validation (128 chars per line)
```
