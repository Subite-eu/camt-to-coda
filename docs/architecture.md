# Architecture

## Design Philosophy

The converter is built around **pure functions** and **data transformation**. A version-independent `CamtStatement` model sits at the centre; both conversion directions pivot through it. The core pipeline uses pure transformations and fixed-width 128-character CODA records. Dedicated builders handle movement, information, balance and trailer records; Record 4 is assembled in the writer. Storage and HTTP side effects live outside the core.

## Pipeline Overview

```
Forward:  CAMT XML → camt-parser → CamtStatement → coda-writer (record builders) → CODA lines
Reverse:  CODA text → coda-parser → CodaLine[] → coda-to-statement → CamtStatement → camt-writer → CAMT XML
```

1. **Parse** — `fast-xml-parser` reads CAMT XML into a raw object; `camt-parser.ts` maps it to a `CamtStatement`.
2. **Detect** — the parsed namespace identifies the supported CAMT message type (e.g. `camt.053.001.08`).
3. **Convert** — `coda-writer.ts` orchestrates the per-record builders in sequence.
4. **Validate** — modeled business rules, numeric domains, record order, continuations, totals and balance reconciliation are checked; every output line must be exactly 128 characters. Full XSD validation is an independent CI check.
5. **Store** — the storage abstraction writes the `.cod` file (filesystem or S3).

The reverse direction mirrors this: `coda-parser.ts` slices fixed-width fields, `coda-to-statement.ts` rebuilds the model, and `camt-writer.ts` serialises CAMT 053 XML using version-specific BIC, status, party and amount shapes. `codaToCamt` groups all logical files and exposes `statements[]`, retaining the first `statement` for compatibility. Monetary detail records become detail amounts, rather than additional account movements.

## Module Map (actual files)

```
src/
├── cli.ts                         Commander CLI (convert, reverse, validate, info, serve)
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
│   ├── money.ts                   Exact integer-thousandths amount operations
│   ├── ogm-vcs.ts                 Belgian structured-reference checksum validation
│   ├── sdd-reason-codes.ts        Return/reversal reason classification
│   ├── coda-transaction-codes.ts  CODA Annexe II descriptions
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
│   ├── anonymizer.ts              Deterministic CODA-line anonymization
│   ├── statement.ts               Allowlisted statement privacy transform for reverse XML
│   └── sha256.ts                  Browser-safe deterministic hashing
│
└── web/
    ├── server.ts                  Node HTTP server: serves the built dist-web/ (static + SPA) + /api
    ├── browser-entry.ts           Re-exports convertForward/convertReverse for the browser
    └── fs-shim.ts / crypto-shim.ts  Browser shims aliased by Vite so the core has no Node deps

src/web-app/                       React + Vite + Tailwind v4 + shadcn/ui field inspector
├── App.tsx  main.tsx  index.html
├── lib/{convert,fields,samples,download,cn}.ts   artifact conversion + exact field provenance
├── lib/{worker-client,conversion.worker,input}.ts cancellable conversion and input limits
├── components/{Header,FileBar,DropZone,StatementSummary,SourcePanel,OutputPanel,Inspector,ThemeToggle}.tsx
├── components/{DownloadPanel,SampleLibrary}.tsx explicit downloads + searchable original sources
├── components/ui/*                shadcn primitives
└── styles/globals.css             Warm Ink theme tokens (light + dark)
```

The web app is a separate Vite root (`vite.config.ts` → `dist-web/`) that reuses `src/core` directly via the `fs`/`crypto` shims. It builds to a static site (Cloudflare / `camt2coda serve`). The browser worker processes inputs locally (5 MiB cap); explicit uploads to the separate [HTTP API](http-api.md) are processed on the Node server (10 MiB default body cap). The source panel retains the original while the result preview and downloads share one converted/privacy artifact. The download panel displays the artifact filename and format, keeping notes and acknowledgment beside the action. The sample picker reads independently authored `examples/catalog.json` metadata; `import.meta.glob` loads each original as a separate lazy chunk. See the [user guide](user-guide.md) for the workflow.

## Record Builders

The dedicated builders are pure functions returning exactly 128 characters, driven by a `field-defs` table so positions live in one place:

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
└── S3Storage    (S3-compatible bucket; live MinIO test recipe in CONTRIBUTING.md)
```

The CLI selects an implementation by input/output scheme and uses the same `read()`/`write()`/`list()` methods regardless of backend. S3 uses standard AWS SDK credentials and paginated listing. Archive/error moves must stay within the input backend. Output filenames are normalized, and collisions are rejected before writing a prepared input; the batch is not a transactional storage operation.

## Testing Strategy

- **Unit tests** — each record builder, parser, formatter, and holiday calendar in isolation (`test/unit/`).
- **Integration tests** — required independently authored original CAMT and CODA sources with literal expectations (`examples/manifest.json`, `test/integration/public-examples.test.ts`), all supported source/output XSDs, CLI and HTTP failure/privacy/multiple-statement behavior, and live MinIO in CI.
- **Property-based tests** — `fast-check` invariants (output lines always 128 chars, field offsets sum to 128) in `test/unit/property.test.ts`.
- **Browser tests** — built worker bundle in Chromium, Firefox, WebKit and mobile Chromium; actual uploads/downloads, sample search/filter/loading, clear download actions, privacy, multi-statement ZIP, recovery, keyboard, responsive layout and light/dark axe checks (`test/e2e/`). All 104 original-source fixtures are also uploaded and their downloads or expected errors checked. Set `PLAYWRIGHT_BASE_URL` to run the suite against a deployment; `scripts/verify-deployment.mjs` compares deployed asset bytes with a local build. Legacy private golden examples are supplemental; the public source library is required in clean checkouts.

## Specifications

Authoritative references live in `specifications/`: CODA 2.6 (`CODA/standard-coda-2.6-en.pdf`), the Belgian CAMT053 implementation guideline (`CAMT/standard-camt053-statement-v2.1_0.pdf`), AOS1 OGM-VCS (`CAMT/aos.pdf`), ISO 20022 MDR parts, and the full CAMT 052/053/054 XSDs.
