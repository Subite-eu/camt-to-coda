# Architecture

## Design Philosophy

The converter is built around **pure functions** and **data transformation**. A version-independent `CamtStatement` model sits at the centre; both conversion directions pivot through it. Each CODA record type is produced by an isolated function that takes typed data and returns a fixed-width 128-character string. There is no global state, no class hierarchy, and no XSLT.

## Pipeline Overview

```
Forward:  CAMT XML → camt-parser → CamtStatement → coda-writer (record builders) → CODA lines
Reverse:  CODA text → coda-parser → CodaLine[] → coda-to-statement → CamtStatement → camt-writer → CAMT XML
```

1. **Parse** — `fast-xml-parser` reads CAMT XML into a raw object; `camt-parser.ts` maps it to a `CamtStatement`.
2. **Detect** — a namespace regex identifies the CAMT message type (e.g. `camt.053.001.08`).
3. **Convert** — `coda-writer.ts` orchestrates the per-record builders in sequence.
4. **Validate** — every output line must be exactly 128 characters.
5. **Store** — the storage abstraction writes the `.cod` file (filesystem or S3).

The reverse direction mirrors this: `coda-parser.ts` slices fixed-width fields, `coda-to-statement.ts` rebuilds the model, and `camt-writer.ts` serialises CAMT 053 XML.

## Module Map (actual files)

```
src/
├── cli.ts                         Commander CLI (convert, reverse, validate, info, serve, anonymize)
│
├── core/
│   ├── model.ts                   Shared types (CamtStatement, CamtEntry, TransactionDetail, ...)
│   ├── camt-parser.ts             CAMT XML → CamtStatement
│   ├── coda-writer.ts             CamtStatement → CODA lines (orchestrator + resolveCommunication)
│   ├── coda-parser.ts             CODA text → CodaLine[] (fixed-width slicing)
│   ├── coda-to-statement.ts       CodaLine[] → CamtStatement
│   ├── camt-writer.ts             CamtStatement → CAMT 053 XML
│   ├── reverse.ts                 CODA → CAMT pipeline wrapper (+ warnings)
│   ├── transaction-codes.ts       ISO Domain/Family/SubFamily ↔ 8-char CODA code
│   ├── formatting.ts              padLeft/padRight, date, balance, sign helpers
│   ├── field-defs/               Fixed-width field tables per record (record{0,1,21,22,23,31,32,33,4,8,9}-fields.ts)
│   │   ├── types.ts               FieldDef, CodaField, CodaLine, AnnotatedCodaOutput
│   │   ├── extract.ts             Slice a line into fields from a FieldDef table
│   │   └── index.ts               Barrel re-export
│   └── records/                   Record builders (record{0,1,21,22,23,31,32,33,8,9}.ts)
│
├── holidays/
│   ├── holidays.ts                workingDaysFromJan1 (statement-sequence approximation)
│   ├── eea.ts                     All 30 EEA country holiday calendars (single source of truth)
│   └── orthodox-easter.ts         Orthodox computus for GR/BG/RO/CY
│
├── validation/
│   ├── camt-validator.ts          CAMT business-rule checks
│   ├── coda-validator.ts          CODA line-length + structure checks
│   └── result.ts                  ValidationResult type
│
├── storage/
│   ├── storage.ts                 Storage interface
│   ├── fs-storage.ts              Filesystem implementation
│   └── s3-storage.ts              S3/MinIO implementation (@aws-sdk/client-s3, optional dep)
│
├── anonymize/
│   └── anonymizer.ts              Deterministic CAMT anonymisation (SHA-256 derived fake data)
│
└── web/
    ├── server.ts                  Node HTTP server for the web UI
    ├── browser-entry.ts           Browser bundle entry (esbuild, IIFE)
    ├── fs-shim.ts / crypto-shim.ts  Browser shims injected via esbuild --alias in build:web
    └── index.html                 Drag-drop interface
```

## Record Builders

Each builder is a pure function returning exactly 128 characters, driven by a `field-defs` table so positions live in one place:

```typescript
record0(stmt): CodaLine
record1(stmt, sequence): CodaLine
record21({ entry, seqNum, sequence, comm, ... }): CodaLine
// ...
```

This makes every record independently testable without mocking the pipeline (see `test/unit/records/`).

## Storage Abstraction

```
Storage interface
├── FsStorage    (local filesystem)
└── S3Storage    (S3-compatible bucket; MinIO locally via docker-compose)
```

The CLI selects an implementation by input/output scheme and uses the same `read()`/`write()`/`list()` methods regardless of backend.

## Testing Strategy

- **Unit tests** — each record builder, parser, formatter, and holiday calendar in isolation (`test/unit/`).
- **Integration tests** — full forward pipeline against real anonymised CAMT files (`test/integration/convert.test.ts`); reverse + round-trip in `round-trip.test.ts`.
- **Property-based tests** — `fast-check` invariants (output lines always 128 chars, field offsets sum to 128) in `test/unit/property.test.ts`.
- **Golden tests** — *planned* (`test/golden/` currently holds only `DIFFERENCES.md`): byte-level cross-validation against a reference `.cod`. See `docs/superpowers/plans/2026-06-30-spec-conformance-and-cleanup.md`.

## Specifications

Authoritative references live in `specifications/`: CODA 2.6 (`CODA/standard-coda-2.6-en.pdf`), the Belgian CAMT053 implementation guideline (`CAMT/standard-camt053-statement-v2.1_0.pdf`), AOS1 OGM-VCS (`CAMT/aos.pdf`), ISO 20022 MDR parts, and the full CAMT 052/053/054 XSDs.
