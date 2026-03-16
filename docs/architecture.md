# Architecture

## Design Philosophy

The converter is built around **pure functions** and **data transformation**. Each CODA record type is produced by an isolated function that takes a typed model and returns a fixed-width 128-character string. There are no global state, class hierarchies, or XSLT templates.

## Pipeline Overview

```
CAMT XML → Parser → CamtStatement model → Record Builders → CODA lines → Output
```

1. **Parse** — `fast-xml-parser` reads the XML into a raw JS object; a parser function maps it to a `CamtStatement` typed model
2. **Detect** — Namespace regex identifies the CAMT message type (e.g., `camt.053.001.08`)
3. **Convert** — The orchestrator calls each record builder in sequence
4. **Validate** — Post-conversion: every line must be exactly 128 characters
5. **Store** — The storage abstraction writes the output file (filesystem or S3)

## Module Diagram

```
src/
├── cli.ts                    Commander CLI (subcommands: convert, validate, info, serve)
│
├── core/
│   ├── model.ts              Shared TypeScript types (CamtStatement, CamtEntry, ...)
│   ├── parser.ts             CAMT XML → CamtStatement
│   ├── converter.ts          Orchestrator: calls builders, collects lines
│   └── records/
│       ├── record0.ts        Header
│       ├── record1.ts        Opening balance
│       ├── record21.ts       Movement
│       ├── record22.ts       Counterparty BIC
│       ├── record23.ts       Counterparty account/name
│       ├── record3.ts        Information records (3.1, 3.2, 3.3)
│       ├── record8.ts        Closing balance
│       └── record9.ts        Trailer
│
├── holidays/
│   └── calculator.ts         Working-day sequence numbers (BE/LT/NL holiday calendars)
│
├── validation/
│   ├── preflight.ts          CAMT pre-flight checks (schema, business rules)
│   └── postflight.ts         CODA line-length validation
│
├── storage/
│   ├── storage.ts            Storage interface
│   ├── fs.ts                 Filesystem implementation
│   └── s3.ts                 S3/MinIO implementation
│
├── anonymize/
│   ├── anonymizer.ts         CAMT anonymization engine
│   └── generators.ts         Deterministic fake data generators (IBAN, BIC, names)
│
└── web/
    ├── server.ts             HTTP server for the web UI
    └── index.html            Drag-drop interface
```

## Record Builders

Each record builder is a pure function with the signature:

```typescript
function buildRecord0(stmt: CamtStatement): string   // returns exactly 128 chars
function buildRecord1(stmt: CamtStatement): string
function buildRecord21(entry: CamtEntry, seq: number): string
// ...
```

This makes every record independently testable without mocking a conversion pipeline.

## Storage Abstraction

```
StorageProvider interface
├── FsStorage    (reads from / writes to local filesystem)
└── S3Storage    (reads from / writes to S3-compatible bucket; uses @aws-sdk/client-s3)
```

The orchestrator receives a `StorageProvider` instance and calls the same `read()` / `write()` / `archive()` / `error()` methods regardless of backend. MinIO is used as the local S3-compatible store in development and tests.

## Data Flow

```
Input (CAMT XML)
    │
    ├── Namespace regex → version detection (e.g., camt.053.001.08)
    │
    ├── fast-xml-parser → raw JS object → CamtStatement model
    │
    ├── Pre-flight validation (optional):
    │   ├── XSD schema check
    │   └── Business rules (account ID, currency, balances, dates)
    │
    ├── Record builders:
    │   ├── Record 0:  Header (BIC, creation date)
    │   ├── Record 1:  Opening balance
    │   ├── For each entry:
    │   │   ├── Record 2.1: Movement (amount, tx code, communication)
    │   │   ├── Record 2.2: Counterparty BIC (when present)
    │   │   ├── Record 2.3: Counterparty account/name (when present)
    │   │   └── Record 3.1–3.3: Batch details (when >1 TxDtls)
    │   ├── Record 8:  Closing balance
    │   └── Record 9:  Trailer (counts, sums)
    │
    ├── Post-flight validation: each line must be exactly 128 characters
    │
    └── Output: .cod file(s) via StorageProvider
```

## Testing Strategy

- **Unit tests** — Each record builder is tested in isolation with fixture data
- **Integration tests** — Full pipeline tests against real anonymized CAMT files, comparing output to golden `.cod` files
- **Property-based tests** — `fast-check` generates random valid CAMT inputs to verify invariants (e.g., output line length is always 128)
- **Total**: 288+ tests across all layers
