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

Converts bank statement files between **CAMT** (ISO 20022 XML) and **CODA** (Belgian structured bank statement, 128 chars/line) formats — in both directions.

## Architecture

```
CAMT XML → Parser → Model → Writer → CODA     (forward)
CODA     → Parser → Model → Writer → CAMT XML  (reverse)
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

### From Source (development)

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm install

# Run any command via npx tsx (no build step needed):
npx tsx src/cli.ts convert -i input/ -o output/
npx tsx src/cli.ts serve --port 8080
npx tsx src/cli.ts reverse -i input.cod -o output/
```

### Build + Install (production)

```bash
npm run build                     # Compiles TypeScript to dist/ (CLI + server)
npm run build:web                 # Builds static site to dist-web/ (browser-only)

node dist/cli.js convert -i input/ -o output/

# Or install globally:
npm link                          # Creates 'camt2coda' command
camt2coda convert -i input/ -o output/
```

### Docker

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main

docker run --rm \
  -v /path/to/camt:/in \
  -v /path/to/coda:/out \
  -e MODE=FS -e VERSION=53 -e IN=/in -e OUT=/out \
  ghcr.io/subite-eu/camt-to-coda:main
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

### reverse

Convert CODA files back to CAMT XML (best-effort reconstruction):

```bash
camt2coda reverse -i statement.cod -o output/
camt2coda reverse -i coda-dir/ -o camt-output/
camt2coda reverse -i input.cod -o output/ --camt-version camt.053.001.02
camt2coda reverse -i input/ -o output/ --dry-run
```

### serve

Launch the web UI:

```bash
camt2coda serve
camt2coda serve --port 8080
```

Opens a three-panel field inspector at `http://localhost:3000` — drop a CAMT or CODA file, click any field to see its mapping in the other format.

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

The web UI runs **entirely in the browser** — no server required. All CAMT/CODA conversion happens client-side via a 67KB JavaScript bundle.

### Local development

```bash
npx tsx src/cli.ts serve              # dev server with hot HTML reload
camt2coda serve                       # after npm run build + npm link
```

### Static build (for hosting)

```bash
npm run build:web                     # → dist-web/index.html + dist-web/camt2coda.js
npx serve dist-web                    # preview locally
```

### Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**
2. Select **Pages** → **Connect to Git**
3. Pick your repository and configure:

   | Setting | Value |
   |---|---|
   | Build command | `npm run build:web` |
   | Build output directory | `dist-web` |
   | Node.js version | `22` (set via environment variable `NODE_VERSION=22`) |

4. Click **Save and Deploy**

Every push to `main` will auto-deploy. PR branches get automatic preview URLs.

Optionally, enable **Web Analytics** in the Cloudflare dashboard (Web Analytics → Add site) for free, privacy-friendly, cookie-less analytics — auto-injected at the edge, no code changes needed.

### Features

A three-panel field inspector at `http://localhost:3000` (or your Cloudflare Pages URL):
- **Bidirectional** — drop CAMT XML or CODA files, auto-detects direction
- **Source panel** (left) — shows your input file
- **Output panel** (right) — shows the conversion result
- **Inspector drawer** (bottom) — click any CODA field or CAMT element to see the mapping: field name, character positions, XPath, and description
- **Cross-highlighting** — clicking a field highlights the corresponding element in the other panel
- **Keyboard accessible** — Tab through fields, Enter/Space to inspect, Escape to close
- **Responsive** — stacks vertically on tablets/mobile
- **Zero server dependency** — all conversion runs in-browser, works offline after first load

## Features

- **Pure-function record builders** — Each CODA record type is a separate, individually testable function
- **Transaction code mapping** — ISO 20022 Domain/Family/SubFamily to CODA 8-char codes
- **Structured remittance** — Belgian structured communication (type 101) support
- **Record 3 (Information Records)** — Batch detail entries for multi-transaction statements
- **Holiday calculator** — Working-day sequence numbers with country-aware holidays for BE, LT, NL
- **CODA anonymization** — `--anonymize` flag replaces sensitive data with deterministic fakes
- **Storage abstraction** — Filesystem and S3/MinIO backends share the same interface
- **CODA-to-CAMT reverse conversion** — Parse CODA files back to ISO 20022 CAMT XML
- **Three-panel web inspector** — Bidirectional field inspector with cross-highlighting
- **490+ tests** — Unit, integration, property-based, and round-trip tests (vitest + fast-check)
- **Multi-platform Docker** — `linux/amd64` and `linux/arm64`

## Project Structure

```
src/
├── cli.ts                  # Commander-based CLI entry point
├── core/
│   ├── camt-parser.ts      # CAMT XML → CamtStatement model
│   ├── coda-writer.ts      # CamtStatement → CodaLine[] (forward)
│   ├── coda-parser.ts      # CODA text → CodaLine[] (reverse)
│   ├── coda-to-statement.ts# CodaLine[] → CamtStatement (reverse)
│   ├── camt-writer.ts      # CamtStatement → CAMT XML (reverse)
│   ├── reverse.ts          # Orchestrates CODA→CAMT pipeline
│   ├── records/            # Pure-function builders per record type
│   ├── field-defs/         # FieldDef arrays (shared by builder, parser, inspector)
│   └── model.ts            # Shared TypeScript types
├── holidays/               # Working-day calculator (BE/LT/NL)
├── validation/             # Pre-flight CAMT + post-conversion CODA checks
├── storage/                # Filesystem + S3 storage abstraction
├── anonymize/              # CODA anonymization engine
└── web/
    ├── index.html          # Single-file three-panel UI
    ├── browser-entry.ts    # Browser bundle entry point
    ├── server.ts           # Dev server (CLI 'serve' command)
    └── fs-shim.ts          # Node.js shim for browser bundle
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
