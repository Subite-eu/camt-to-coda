# CAMT-to-CODA: TypeScript Replacement Design

## Overview

Replace the Java/XSLT CAMT-to-CODA converter (~5000 lines across 51 files) with a TypeScript implementation. A working proof-of-concept (880 lines, 4 files) already converts all CAMT 052/053 files correctly with valid 128-char CODA output.

The TypeScript version achieves the same functionality with significantly less code, faster execution (~23x), simpler dependencies (2 vs 15), and individually testable field mappings.

## Goals

- Feature parity with the Java/XSLT version (except CAMT 054)
- Cleaner architecture: pure functions, typed model, pluggable storage
- Comprehensive testing: unit, integration, golden files, property-based (90%+ coverage)
- Modern CI/CD: GitHub Actions, Docker, standalone binaries
- Minimal web UI for non-technical users
- On-the-fly CODA output anonymization via `--anonymize` flag

## Non-Goals

- CAMT 054 support (not needed, can be added later)
- Full web application with field inspector (documented in future-web-ui.md for v2)
- Backward compatibility with Java CLI flags (clean break)
- CAMT-to-CAMT anonymization (Python script already handles this)

## Migration Strategy

1. Tag current state as `v1.0-java-final`
2. Remove `java/` and `go/` directories from main
3. TypeScript becomes the root project
4. Python anonymizer (`example-files/anonymization/anonymize.py`) stays as-is

---

## Architecture

### Project Structure

```
camt-to-coda/
├── src/
│   ├── core/
│   │   ├── camt-parser.ts          # XML → CamtStatement model
│   │   ├── coda-writer.ts          # CamtStatement → CODA lines (orchestrator)
│   │   ├── records/
│   │   │   ├── record0.ts          # Header
│   │   │   ├── record1.ts          # Opening balance
│   │   │   ├── record21.ts         # Movement
│   │   │   ├── record22.ts         # Movement continuation (BIC)
│   │   │   ├── record23.ts         # Movement continuation (counterparty)
│   │   │   ├── record31.ts         # Batch detail
│   │   │   ├── record32.ts         # Batch detail continuation
│   │   │   ├── record33.ts         # Batch detail counterparty
│   │   │   ├── record8.ts          # Closing balance
│   │   │   └── record9.ts          # Trailer
│   │   ├── model.ts                # TypeScript interfaces
│   │   ├── formatting.ts           # padLeft, padRight, formatBalance, formatDate
│   │   └── transaction-codes.ts    # ISO 20022 → CODA mapping
│   │
│   ├── validation/
│   │   ├── camt-validator.ts       # Pre-flight checks
│   │   ├── coda-validator.ts       # Post-conversion checks
│   │   └── result.ts               # ValidationResult type
│   │
│   ├── storage/
│   │   ├── storage.ts              # Interface: list, read, write, move, exists
│   │   ├── fs-storage.ts           # Filesystem implementation
│   │   └── s3-storage.ts           # S3/MinIO implementation
│   │
│   ├── holidays/
│   │   ├── holidays.ts             # Working-day sequence calculator
│   │   ├── belgium.ts              # BE holidays
│   │   ├── lithuania.ts            # LT holidays
│   │   └── netherlands.ts          # NL holidays
│   │
│   ├── anonymize/
│   │   └── anonymizer.ts           # CODA output anonymization
│   │
│   ├── web/
│   │   ├── server.ts               # HTTP server (serve command)
│   │   └── index.html              # Single-page UI (drag-drop, preview, download)
│   │
│   └── cli.ts                      # Entry point, commander-based
│
├── test/
│   ├── unit/                       # Pure function tests
│   ├── integration/                # Full pipeline tests
│   ├── golden/                     # Java output baseline comparisons
│   │   ├── *.cod                   # Expected CODA outputs
│   │   └── DIFFERENCES.md          # Documented intentional differences
│   └── fixtures/                   # Synthetic CAMT XML snippets
│
├── example-files/                  # Anonymized CAMT examples (existing)
├── specifications/                 # ISO 20022 XSDs, CODA 2.6 PDF (existing)
├── docs/
│   ├── architecture.md
│   ├── format-guide.md
│   ├── user-guide.md
│   ├── releasing.md
│   └── superpowers/specs/
│       └── future-web-ui.md        # V2 web UI design (field inspector, etc.)
│
├── Dockerfile                      # Multi-stage Node build
├── docker-compose.yml              # MinIO + converter
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE                         # MIT
├── README.md
├── CONTRIBUTING.md
└── CHANGELOG.md
```

### Core Principle

Every record builder is a **pure function**: typed inputs in, 128-char string out. No side effects, no XML parsing, no state. This makes each one trivially testable in isolation.

**v2 compatibility note:** The future web UI (v2) will need record builders to return field metadata alongside the string. The v1 builders return `string`. For v2, a wrapper/decorator approach will add metadata without changing the v1 function signatures — the core builder stays `(...) => string`, and a `withMetadata(builder)` wrapper captures field positions for the inspector UI.

**Amount constraints:** `formatBalance(n)` produces a 15-character string (12 integer digits + 3 decimal digits). Maximum representable amount: `999,999,999,999.999`. Amounts exceeding this are truncated with a validation warning. This matches the CODA 2.6 specification's field width.

### Data Model

```typescript
interface CamtStatement {
  messageId: string
  creationDate: string                  // GrpHdr/CreDtTm — informational
  statementId: string
  reportDate: string                    // Statement-level date (FrToDt/ToDtTm or CreDtTm fallback) — used in Record 0
  camtVersion: "052" | "053"            // Used for output filename
  account: {
    iban?: string
    otherId?: string
    currency: string
    ownerName?: string
    bic?: string
  }
  openingBalance: {
    amount: number
    creditDebit: "CRDT" | "DBIT"
    date: string
  }
  closingBalance: {
    amount: number
    creditDebit: "CRDT" | "DBIT"
    date: string
  }
  entries: CamtEntry[]
  sequence?: number
}

interface CamtEntry {
  amount: number
  currency: string
  creditDebit: "CRDT" | "DBIT"
  bookingDate?: string
  valueDate?: string
  entryRef?: string
  accountServicerRef?: string
  transactionCode?: {
    domain?: string
    family?: string
    subFamily?: string
    proprietary?: string
  }
  details: TransactionDetail[]          // length > 1 triggers Record 3
  batchCount?: number
}

interface TransactionDetail {
  refs?: { endToEndId?: string; txId?: string; instrId?: string }
  counterparty?: { name?: string; iban?: string; bic?: string }
  remittanceInfo?: {
    unstructured?: string
    structured?: { creditorRef?: string }
  }
}
```

### Conversion Pipeline

```
Storage.read(source) → raw XML
  → detectVersion() → "camt.053.001.08"
  → camtValidator.validate() → bail on errors
  → parseCamt() → CamtStatement[]
  → for each statement:
      → statementToCoda(stmt) → { fileName, lines[] }
          → record0(stmt)             uses stmt.reportDate (statement-level, not GrpHdr)
          → record1(stmt, sequence)
          → for each entry:
              → record21(entry, ...) always
              → record22(...) if counterparty BIC or long communication (>53 chars)
              → record23(...) if counterparty IBAN or long communication (>106 chars)
                  record23.linkCode = 1 if batch details follow
              → for each batch detail (if entry.details.length > 1):
                  → record31(detail, seqNum, detailNum, ...) — always emitted per detail
                  → record32(...) if detail communication > 73 chars — communication overflow
                  → record33(...) if detail communication > 126 chars — further overflow
          → record8(stmt, sequence)
          → record9(counts, sums)     counts all emitted records (1 + 2.x + 3.x + 8)
      → codaValidator.validate(lines)
      → if --anonymize: anonymizer.process(lines)
      → if --dry-run: log summary, skip write/move
      → else: Storage.write(fileName, content)
  → if --dry-run: exit (no file moves)
  → Storage.move(source → archive) on success
  → Storage.move(source → error) on failure
```

**Record 3 field specification:** Records 3.1, 3.2, 3.3 mirror the layout of Records 2.1, 2.2, 2.3 respectively but operate at the transaction detail level within a batch entry. Key differences from Record 2:
- Record 3.1 position 30: transaction code type = `1` (detail of globalisation)
- Record 3.1 position 125: globalisation code = `0` (detail, not global)
- Record 3.1 communication zone is 73 chars (vs 53 in Record 2.1)
- Record 3.2 and 3.3 are **communication overflow records**, not counterparty records. They carry continuation text when the detail's communication exceeds 73 chars (3.2) or 126 chars (3.3). Counterparty IBAN/BIC/name from `TransactionDetail.counterparty` are available in the model but not written to Record 3 — they appear only in Record 2.2/2.3 at the entry level.
- Detail number increments per TxDtls within the entry (starting at 1)
- Sequence number matches the parent entry's sequence number
- Link code on all Record 3 lines is always `0` (no further information records)

**Record 9 count:** Counts one unit per TxDtls detail entry (not per individual 3.x line emitted). Formula: `1 (rec1) + per-entry(1 for 2.1 + optional 2.2 + optional 2.3) + per-batch-entry(count of TxDtls if > 1) + 1 (rec8)`. This matches the Java implementation's counting approach.

**Output filename convention:** `{date}-{account}-{currency}-{statementId}-CAMT-{version}.cod` where `{version}` is derived from `stmt.camtVersion` (e.g., `052` or `053`).

### Sequence Number Calculation

The PoC currently falls back to `"001"` when no sequence is present. The full implementation must use the working-day calculator:


1. Use `statement.sequence` (legal or electronic) if present
2. Fall back to working-day count from January 1st
3. Country detected from IBAN prefix (BE, LT, NL)
4. Holiday calendars define national + bank holidays as date predicates
5. Easter calculated via Computus algorithm (same as Java version)

---

## Storage Abstraction

```typescript
interface Storage {
  list(path: string): Promise<string[]>
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  move(from: string, to: string): Promise<void>
  exists(path: string): Promise<boolean>
}
```

**Path convention:**
- Local: `./input/file.xml`, `/absolute/path/`
- S3: `s3://bucket-name/prefix/path/file.xml`

S3 paths are parsed as: `s3://<bucket>/<key>`. The `list()` operation uses `ListObjectsV2` with the key as prefix. Supports different buckets for input/output/archive/error, or same bucket with different prefixes.

**S3 dependency:** `@aws-sdk/client-s3` only. Lazy-imported — filesystem-only users don't load it.

**MinIO support:** Custom endpoint via `--endpoint` CLI flag, passed to S3 client configuration.

**Credential resolution order:**
1. CLI flags: `--access-key` / `--secret-key` (highest priority)
2. Environment variables: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
3. AWS default credential chain (instance profile, SSO, etc.)

---

## CLI

```bash
# Core conversion
camt2coda convert -i <input> -o <output> [options]
  --archive <path>         Archive directory/prefix for processed files
  --error <path>           Error directory/prefix for failed files
  --anonymize              Anonymize sensitive data in CODA output
  --dry-run                Validate and convert but don't write output
  --endpoint <url>         S3 endpoint (for MinIO/custom S3)
  --access-key <key>       S3 access key
  --secret-key <key>       S3 secret key

# Utilities
camt2coda validate <file>  Validate CAMT file without converting
camt2coda info <file>      Show CAMT file metadata
camt2coda serve [--port N] Start web UI (default: 8080)
camt2coda --version        Show version
camt2coda --help           Show help
```

Storage type auto-detected from path prefix (`s3://` → S3, otherwise filesystem).

Argument parsing via `commander` package.

---

## Anonymization (--anonymize flag)

Post-processing step on CODA output lines. Replaces sensitive data in known field positions:

| Record | Positions | Field | Replacement |
|--------|-----------|-------|-------------|
| 0 | 61-71 | BIC | Fake BIC |
| 1 | 6-39 | Account number | Fake IBAN |
| 1 | 65-90 | Holder name | Fake name |
| 2.2 | 99-109 | Counterparty BIC | Fake BIC |
| 2.3 | 11-44 | Counterparty IBAN | Fake IBAN |
| 2.3 | 48-82 | Counterparty name | Fake name |
| 3.2 | Similar | Counterparty BIC | Fake BIC |
| 3.3 | Similar | Counterparty IBAN/name | Fake IBAN/name |
| 8 | 5-38 | Account number | Fake IBAN |

Uses deterministic seed (SHA-256 of original value + fixed seed) for reproducible output. Referential integrity maintained — same IBAN always maps to same fake.

---

## Web UI (Minimal — v1.0)

Single `camt2coda serve --port 8080` command starts an HTTP server. No build step, no framework.

**Single HTML page** (`src/web/index.html`) with:
- Drag-and-drop zone for CAMT files
- Conversion happens server-side via the same `parseCamt()` → `statementToCoda()` pipeline
- CODA output displayed in a monospace preview pane
- Download button for the .cod file
- Validation results shown inline (errors/warnings)
- Optional `--anonymize` checkbox

**HTTP API** (used by the HTML page, also usable directly):
- `POST /api/convert` — multipart file upload → JSON response
- `GET /api/health` — health check

**v1.0 API response schema** (pinned for v2 backward compatibility):
```json
{
  "files": [
    {
      "fileName": "2024-03-07-BE68...-EUR-STMT001-CAMT-053.cod",
      "lines": ["0000015032400005...", "12001BE6879..."],
      "recordCount": 7,
      "validation": {
        "valid": true,
        "errors": [],
        "warnings": ["No BIC found, left blank"]
      }
    }
  ],
  "version": "camt.053.001.08"
}
```
The v2 web UI will extend this with `?detail=true` adding a `fields` array per line. The v1 shape above is the baseline contract.

**Implementation:** Node's built-in `http` module (or `Bun.serve` when compiled). No Express, no framework. The server file is <200 lines.

---

## Testing Strategy

### Layer 1: Unit Tests (~80 tests)

Pure function tests, no I/O, no XML parsing.

- **Records (10 files × ~5 tests each):** Verify 128-char output, correct field positions, boundary values (max amounts, empty fields, special character truncation, non-ASCII)
- **Formatting (~15 tests):** `formatBalance` (zero, decimals, large), `formatDate` (ISO, datetime, empty), `padLeft`/`padRight` (truncation, exact fit, overflow)
- **Transaction codes (~10 tests):** All 14 mapped codes, card wildcard, unknown fallback, missing fields
- **Holidays (~15 tests):** Per-country known dates (Easter 2024/2025, Jan 1, national days), leap years, working-day count for known dates
- **Anonymizer (~5 tests):** Deterministic output, referential integrity, all record types

### Layer 2: Integration Tests (~30 tests)

Full pipeline: XML string → CODA lines.

- Per CAMT version: 052.001.06, 053.001.02, 053.001.08
- Empty statement (no entries) → records 0, 1, 8, 9
- Batch entries with multiple TxDtls → Record 3 emitted
- Structured remittance → communication type `1`
- Long communication spanning records 2.1 + 2.2 + 2.3
- Missing optional fields (no BIC, no counterparty, no value date)
- Multi-statement CAMT → multiple CODA files
- Balance validation: open + movements = close
- Storage tests: FsStorage with temp directories
- Anonymize flag: verify output has no original IBANs/names
- Dry-run: verify no files written
- Web API: POST /api/convert returns valid response

### Layer 3: Golden File Tests (~10 tests)

- Generate Java CODA output once, commit as `test/golden/*.cod`
- TS tests compare line-by-line against golden files
- Intentional differences documented in `test/golden/DIFFERENCES.md`
- Parameterized: one test function iterates all golden file pairs

### Property-Based Tests (via fast-check)

- `formatBalance(n)` → always 15 characters
- `formatDate(d)` → always 6 characters
- `padLeft(s, n)` / `padRight(s, n)` → always n characters
- Every record builder → always 128 characters

### Coverage

- Target: 90%+ line coverage
- Measured by vitest's built-in v8 coverage
- Enforced in CI: build fails below threshold

---

## CI/CD

### GitHub Actions Workflows

**build.yml** (triggers: push to main, PRs to main)
```
test job:
  - checkout
  - setup Node 22
  - npm ci
  - npm test (vitest)
  - npm run coverage (fail if <90%)
  - upload coverage report

quality job (depends on test):
  - npm run lint (eslint)
  - npm audit (dependency vulnerabilities)

deploy job (main only):
  - build Docker image
  - push to ghcr.io/subite-eu/camt-to-coda:main
```

**release.yml** (triggers: tags v*)
```
release job:
  - npm ci && npm run build
  - npm test
  - build Docker image with version tag + latest
  - push to ghcr.io
  - compile standalone binaries (bun):
      - camt2coda-linux-x64
      - camt2coda-darwin-arm64
      - camt2coda-windows-x64.exe
  - create GitHub Release with:
      - binaries as assets
      - installation instructions in body
      - auto-generated release notes
```

**security-scan.yml** (triggers: weekly Monday, tags, manual)
```
  - npm audit
  - OWASP dependency check (with NVD API key)
  - upload report
```

### Docker

**Dockerfile** (multi-stage):
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENTRYPOINT ["node", "dist/cli.js"]
```

Image size: ~50MB (vs ~300MB for Java/Corretto).

**docker-compose.yml** (local dev):
```yaml
services:
  s3:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  s3-init:
    image: quay.io/minio/mc:latest
    depends_on:
      s3: { condition: service_healthy }
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://s3:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/camt local/coda local/archive local/error;
      "
```

---

## Packaging & Distribution

### npm package
```bash
npm install -g camt2coda   # global install
camt2coda convert -i ...   # use directly
```

### Docker
```bash
docker pull ghcr.io/subite-eu/camt-to-coda:latest
docker run --rm -v ./data:/data ghcr.io/subite-eu/camt-to-coda convert -i /data/in -o /data/out
```

### Standalone binaries (GitHub Release assets)
```
camt2coda-linux-x64          # ~50MB, no runtime needed
camt2coda-darwin-arm64       # macOS Apple Silicon
camt2coda-windows-x64.exe    # Windows
```

Compiled with Bun. Bun is a build-time CI dependency only — not required for development or users.

---

## Documentation

All docs rewritten for the TypeScript version:

- **README.md** — Badges, overview, quick start (Docker/binary/npm/source), architecture diagram, feature list
- **docs/architecture.md** — Module diagram, data flow, storage abstraction, record builders
- **docs/format-guide.md** — CAMT→CODA field mapping tables, transaction codes, record layouts (reuse existing, it's format-specific not implementation-specific)
- **docs/user-guide.md** — Installation, CLI usage, S3 mode, web UI, anonymization, troubleshooting
- **docs/releasing.md** — Version bump, tagging, release workflow
- **CONTRIBUTING.md** — Dev setup (Node 22, npm), running tests, PR process
- **CHANGELOG.md** — v2.0.0 entry documenting the TypeScript rewrite
