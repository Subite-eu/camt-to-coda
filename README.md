# CAMT-to-CODA Converter

[![Build](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml/badge.svg)](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml)
[![Release](https://img.shields.io/github/v/release/Subite-eu/camt-to-coda?include_prereleases&sort=semver)](https://github.com/Subite-eu/camt-to-coda/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Vibe Coded](https://img.shields.io/badge/vibe--coded-Claude_Code-blueviolet)](https://claude.ai/claude-code)

> Built with a mix of human expertise + AI pair programming (Claude Code).
> The mapping logic, anonymization engine, CLI, and test infrastructure were vibe-coded.
> The core CAMT/CODA domain knowledge is human-driven.

Converts bank statement files from **CAMT** (ISO 20022 XML) format to **CODA** (Belgian structured bank statement, 128 chars/line) format.

## Architecture

```
CAMT XML → Parser → Model → Writer → CODA
```

The converter uses a **pure-function pipeline**:

1. **Parse** — `fast-xml-parser` reads the CAMT XML into a typed model
2. **Detect** — Namespace scan identifies the CAMT version (e.g., `camt.053.001.08`)
3. **Build records** — Individual pure-function builders produce each CODA record (0, 1, 2.1, 2.2, 2.3, 3.x, 8, 9)
4. **Validate** — Each output line must be exactly 128 characters
5. **Store** — Filesystem or S3-compatible storage via a common abstraction

### Supported CAMT Versions

| Version | Description | Status |
|---|---|---|
| camt.052.001.02–13 | Intraday Report | Supported |
| camt.053.001.02–13 | End-of-day Statement | Supported |

### CODA Records Generated

| Record | Description |
|---|---|
| 0 | Header (BIC, creation date) |
| 1 | Opening balance |
| 2.1 | Movement (amount, date, transaction code, communication) |
| 2.2 | Movement continuation (counterparty BIC) |
| 2.3 | Movement continuation (counterparty account, name) |
| 3.1–3.3 | Information records (batch detail entries) |
| 8 | Closing balance |
| 9 | Trailer (record count, debit/credit sums) |

## Quick Start

### Docker

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main

docker run --rm \
  -v /path/to/camt:/in \
  -v /path/to/coda:/out \
  -e MODE=FS -e VERSION=53 -e IN=/in -e OUT=/out \
  ghcr.io/subite-eu/camt-to-coda:main
```

### npx (no install)

```bash
npx camt2coda convert -v 53 -i input/ -o output/
```

### From Source

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm install
npm run build
node dist/cli.js convert -v 53 -i input/ -o output/
```

## CLI Commands

### convert

Convert CAMT files to CODA:

```bash
camt2coda convert -v 53 -i /path/to/camt/ -o /path/to/coda/
camt2coda convert -v 52 -i statement.xml -o output/
camt2coda convert -v 53 -i input/ -o output/ --dry-run
camt2coda convert -v 53 -i input/ -o output/ --anonymize
```

### validate

Check a CAMT file without converting:

```bash
camt2coda validate statement.xml
```

Checks XML well-formedness, XSD schema compliance, account ID, currency, balances, and dates.

### info

Display metadata about a CAMT file:

```bash
camt2coda info statement.xml
```

Shows CAMT version, account IBANs, currency, entry count, statement count, and dates.

### serve

Launch the web UI:

```bash
camt2coda serve
camt2coda serve --port 8080
```

Opens a browser interface with drag-and-drop upload, inline CODA preview, and download.

## S3 Mode

Read from / write to S3-compatible storage (AWS S3, MinIO, etc.):

```bash
camt2coda convert -v 53 \
  -i camt-bucket -o coda-bucket \
  --mode s3 \
  --endpoint http://localhost:9000 \
  --access-key mykey \
  --secret-key mysecret
```

Environment variables also work: `MODE=S3 IN=camt-bucket OUT=coda-bucket EP=... AK=... SK=...`

## Web UI

```bash
camt2coda serve
```

A minimal browser interface at `http://localhost:3000` with:
- Drag-and-drop CAMT file upload
- Inline CODA preview before download
- Single-file and batch conversion

## Features

- **Pure-function record builders** — Each CODA record type is a separate, individually testable function
- **Transaction code mapping** — ISO 20022 Domain/Family/SubFamily to CODA 8-char codes
- **Structured remittance** — Belgian structured communication (type 101) support
- **Record 3 (Information Records)** — Batch detail entries for multi-transaction statements
- **Holiday calculator** — Working-day sequence numbers with country-aware holidays for BE, LT, NL
- **CODA anonymization** — `--anonymize` flag replaces sensitive data with deterministic fakes
- **Storage abstraction** — Filesystem and S3/MinIO backends share the same interface
- **288+ tests** — Unit, integration, and property-based tests (vitest + fast-check)
- **Multi-platform Docker** — `linux/amd64` and `linux/arm64`

## Project Structure

```
src/
├── cli.ts                  # Commander-based CLI entry point
├── core/                   # Conversion pipeline
│   ├── parser.ts           # CAMT XML → typed model
│   ├── converter.ts        # Orchestrates record builders
│   ├── records/            # Pure-function builders per record type
│   └── model.ts            # Shared TypeScript types
├── holidays/               # Working-day calculator (BE/LT/NL)
├── validation/             # Pre-flight CAMT + post-conversion CODA checks
├── storage/                # Filesystem + S3 storage abstraction
├── anonymize/              # CAMT anonymization engine
└── web/                    # Minimal web UI (serve subcommand)
```

## Configuration

### Environment Variables (Docker / S3 mode)

| Variable | Description | Default |
|---|---|---|
| `MODE` | `FS` or `S3` | `FS` |
| `VERSION` | CAMT version (`52` or `53`) | Required |
| `IN` | Input path or bucket name | Required |
| `OUT` | Output path or bucket name | Required |
| `ARCHIVE` | Archive path | `/tmp` |
| `ERROR` | Error path | `/tmp` |
| `EP` | S3 endpoint URL | AWS default |
| `AK` | S3 access key | — |
| `SK` | S3 secret key | — |

## Specifications

- **CAMT**: ISO 20022 — XSD schemas in `specifications/CAMT/`
- **CODA**: Belgian CODA 2.6 — PDF specification in `specifications/CODA/`
- **Format mapping**: See [docs/format-guide.md](docs/format-guide.md)

## License

MIT — see [LICENSE](LICENSE).
