# CAMT-to-CODA Converter

[![Build](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml/badge.svg)](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml)
[![Release](https://img.shields.io/github/v/release/Subite-eu/camt-to-coda?include_prereleases&sort=semver)](https://github.com/Subite-eu/camt-to-coda/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22.12+_or_24-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Vibe Coded](https://img.shields.io/badge/vibe--coded-Claude_Code-blueviolet)](https://claude.ai/claude-code)

> Built with a mix of human expertise + AI pair programming (Claude Code).
> The mapping logic, anonymization engine, CLI, and test infrastructure were vibe-coded.
> The core CAMT/CODA domain knowledge is human-driven.

Converts bank statement files between **CAMT** (ISO 20022 XML) and **CODA** (Belgian structured bank statement, 128 chars/line) formats — in both directions.

**Try it now** — no install needed, runs entirely in your browser:
- **[camt2coda.subite.io](https://camt2coda.subite.io)** — Convert CAMT to CODA
- **[coda2camt.subite.io](https://coda2camt.subite.io)** — Convert CODA to CAMT

Drop a file, review statements, inspect any field and download the result. Bank statement contents are processed locally in a browser worker. The hosted page fetches site assets and may contact Cloudflare analytics; offline reload is not guaranteed.

See the [documentation index](docs/README.md), [user guide](docs/user-guide.md), [HTTP API](docs/http-api.md), [conversion limitations](docs/conversion-limitations.md) and [contributor guide](CONTRIBUTING.md).

## Architecture

```
CAMT XML → Parser → Model → Writer → CODA     (forward)
CODA     → Parser → Model → Writer → CAMT XML  (reverse)
```

The converter uses a **pure-function pipeline**:

1. **Parse** — `fast-xml-parser` reads the CAMT XML into a typed model
2. **Detect** — Namespace scan identifies the CAMT version (e.g., `camt.053.001.08`)
3. **Build records** — Pure conversion functions produce CODA records (0, 1, 2.1, 2.2, 2.3, 3.x, 4, 8, 9)
4. **Validate** — Each output line must be exactly 128 characters
5. **Store** — Filesystem or S3-compatible storage via a common abstraction

### Supported CAMT Versions

| Version | CAMT input → CODA | CODA → CAMT output |
|---|---|---|
| camt.052.001.02–13 | Supported | Unsupported |
| camt.053.001.02–13 | Supported | Supported; default .08 |

CAMT 054 schemas are reference material; 054 conversion is unsupported. Runtime checks do not constitute full XSD validation or bank-profile certification.

### CODA Records Generated

| Record | Description |
|---|---|
| 0 | Header (BIC, creation date) |
| 1 | Opening balance |
| 2.1 | Movement (amount, date, transaction code, communication) |
| 2.2 | Movement continuation (counterparty BIC) |
| 2.3 | Movement continuation (counterparty account, name) |
| 3.1–3.3 | Information records and long detail communications |
| 4 | Free statement communication (`AddtlStmtInf`) |
| 8 | Closing balance |
| 9 | Trailer (record count, debit/credit sums) |

## Quick Start

### From Source (development)

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm ci

# Run conversion commands via tsx without compiling:
npx tsx src/cli.ts convert -i input/ -o output/
# Build browser assets before serving the UI:
npm run build:web
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
  ghcr.io/subite-eu/camt-to-coda:main convert -i /in -o /out

# Serve the bundled web app:
docker run --rm -p 3000:3000 ghcr.io/subite-eu/camt-to-coda:main serve --host 0.0.0.0
```

## CLI Commands

### convert

Convert CAMT files to CODA:

```bash
camt2coda convert -i /path/to/camt/ -o /path/to/coda/
camt2coda convert -i statement.xml -o output/
camt2coda convert -i input/ -o output/ --dry-run
camt2coda convert -i input/ -o output/ --anonymize
camt2coda convert -i input/ -o output/ --archive archive/ --error errors/
```

### validate

Check a CAMT file without converting:

```bash
camt2coda validate statement.xml
```

Checks XML well-formedness, supported namespace/message structure, account ID, currency, numeric values, balances, dates, and reconciliation. Runtime validation does not run the full XSD; CI validates public original CAMT sources and generated XML against every supported bundled schema.

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

Serves the conversion review and field inspector at `http://localhost:3000` — drop a CAMT or CODA file, click any field to see its mapping in the other format.

## S3 Mode

Read from / write to S3-compatible storage (AWS S3, MinIO, etc.):

Credentials use the standard AWS SDK provider chain, including `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and temporary `AWS_SESSION_TOKEN`. Region uses `AWS_REGION`/`AWS_DEFAULT_REGION` with `us-east-1` fallback. Credentials are never CLI flags, which would leak through process listings and shell history.

```bash
export AWS_ACCESS_KEY_ID=mykey
export AWS_SECRET_ACCESS_KEY=mysecret
camt2coda convert \
  -i s3://camt-bucket -o s3://coda-bucket \
  --endpoint http://localhost:9000
```

## Web UI

A **React + shadcn/ui** review and field inspector (Vite build) that converts locally using the same `src/core` engine. Drop a CAMT or CODA file, review statements, then inspect fields to see their cross-format mappings. The optional Node [HTTP API](docs/http-api.md) separately processes explicit uploads on the server.

### Hosted

Available at **[camt2coda.subite.io](https://camt2coda.subite.io)** and **[coda2camt.subite.io](https://coda2camt.subite.io)** — hosted on Cloudflare Pages, auto-deployed on every push to `main`.

### Local development

```bash
npm run dev:app                       # Vite dev server with hot reload → http://localhost:5173
```

### Self-hosting

```bash
npm run build                        # → dist/ (CLI + Node server)
npm run build:web                    # → dist-web/ (static app + worker)
node dist/cli.js serve               # serves both UI assets and the HTTP API
# Or: npm run dev:web                # builds and serves only the static app
```

The `dist-web/` directory is a static site — deploy it anywhere (Cloudflare Pages, Netlify, Nginx, S3, etc.). To deploy to Cloudflare Pages, connect your GitHub repo and set build command to `npm run build:web`, output directory to `dist-web`, and `NODE_VERSION=22`.

### Features

A conversion review workflow with an expert field inspector:
- **Statement review** — opening/closing balances, reconciliation, paginated movements, all-statement selection and ZIP download
- **Bidirectional** — drop CAMT XML or CODA files, auto-detects direction
- **Source panel** (left) — shows your input file
- **Output panel** (right) — shows the conversion result
- **Inspector drawer** (bottom) — click any CODA field or CAMT element to see the mapping: field name, character positions, XPath, and description
- **Cross-highlighting** — clicking a field highlights the corresponding element in the other panel
- **Keyboard accessible** — one tab stop per record, arrow-key field navigation, search, jump-to-record, Enter/Space to inspect, Escape to close
- **Responsive** — source/result tabs on mobile, bounded panels on desktop
- **Local conversion** — conversion runs in a cancellable browser worker; maximum 5 MiB input; offline reload is not guaranteed
- **Explicit download review** — runtime errors block download and conversion notes require acknowledgment
- **Clear download action** — a dedicated panel shows the output filename and Download CODA/CAMT button, plus ZIP for multiple forward results
- **Searchable sample library** — 104 independently authored original files, format filters, scenario descriptions and opt-in invalid examples
- **Worldwide reporting catalog** — 104 bank/brand entries and 58 national, regional and global authority references, with geography filters, official examples/specifications, access labels and explicit reporting scope
- **Privacy exports** — source stays original; result preview and download share the same anonymized artifact. Amounts/dates remain identifiable and deterministic pseudonyms are linkable. Synthetic account identifiers are for review, never bank import.

## Features

- **Pure-function record builders** — Dedicated builders and shared field tables make record layouts independently testable
- **Transaction code mapping** — ISO 20022 Domain/Family/SubFamily to CODA 8-char codes
- **Structured remittance** — Belgian structured communication (type 101) support
- **Transaction details and free communications** — Monetary detail records without double-counting, information records, and Record 4 statement text
- **Holiday calculator** — Fallback statement sequences using all 30 EEA country calendars; explicit CAMT 053 sequences take precedence. This remains an approximation
- **Privacy exports** — Forward CLI `--anonymize`, plus browser/API exports in both directions; financial patterns remain identifiable
- **Storage abstraction** — Filesystem and S3/MinIO backends share the same interface
- **CODA-to-CAMT reverse conversion** — Parse CODA files back to ISO 20022 CAMT XML
- **Three-panel web inspector** — Bidirectional field inspector with cross-highlighting
- **Required public examples and CI** — Unit, integration, property-based, independent XSD, round-trip, real-browser and accessibility checks
- **Multi-platform Docker** — `linux/amd64` and `linux/arm64`

## Project Structure

```
src/
├── cli.ts             # convert, reverse, validate, info, serve
├── core/              # parsers, model, writers, money, transaction codes, record/field tables
├── holidays/          # EEA working-day sequence approximation
├── validation/        # CAMT and CODA runtime checks
├── storage/           # filesystem + S3
├── anonymize/         # CODA and statement privacy transforms + browser-safe SHA-256
├── web/               # Node HTTP server, browser exports and shims
└── web-app/           # React review/inspector UI and cancellable conversion worker
examples/              # independent original CAMT and CODA fixtures + literal manifest
test/                  # unit, integration, supplemental golden and browser tests
specifications/        # authoritative format references and XSDs
```

See [architecture](docs/architecture.md) for the module map.

## Configuration

### CLI and AWS environment

Configure paths and format options with the CLI arguments shown above; the retired `MODE`, `VERSION`, `IN`, `OUT`, `AK` and `SK` environment variables are not supported. For S3 use standard AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`) and region, with `--endpoint` for compatible services. Archive/error moves must use the same storage backend as the input; unsupported cross-backend moves fail before conversion.

## Testing and public examples

Open **Example files** (`/#examples`) for all **252 examples**, searchable by filename and filterable by format, provenance, country/scope and bank/publisher. Each entry distinguishes bank originals, third-party CODA fixtures and synthetic test data, states its country basis, validation status and usage terms, and offers a clear download action. Publisher downloads verify pinned bytes and extract individual files or embedded XML without rewriting them. Direct publisher links remain available when browser access is blocked. Synthetic examples also offer **Try in converter**. See the [download guide](docs/user-guide.md#find-and-download-example-files).

The [public source library](examples/README.md) contains 104 independently authored original CAMT and CODA inputs, with a literal expectation manifest. It includes salaries, card purchases, direct debits, instant and international payments, refunds, fees, interest, busy months, multi-currency accounts, CAMT 052/053 v02–13, multi-statement and empty statements, three-decimal currencies, long/structured communication, modern party wrappers, returns, continuation links, and invalid sources. The browser sample picker searches this same library.

The separate [bank-published corpus](examples/bank-published/README.md) adds 12 official CAMT originals from ING, ABN AMRO and Nordea, covering 61 movements and 84 monetary details. Originals are downloaded directly into an ignored/ephemeral test folder with pinned hashes; publisher terms prevent treating them as MIT-licensed bundled fixtures. The browser links to the official downloads. A complete bank-published CODA original remains an explicit acquisition gap; the bundled CODA examples are synthetic. The separate [Belgian CODA publisher corpus](examples/coda-published/README.md) inventories 29 deduplicated developer/vendor fixtures from 65 downloads, with immutable source pins, license evidence and expected acceptance/rejection checks. These are third-party test fixtures, not verified bank-issued statements.

The [worldwide bank and country reference catalog](examples/bank-catalog/README.md) groups primary sources by geography and bank, including CFONB, Febelfin, Betaalvereniging, SIX, DK, CBA, SBA and references across the Americas, Asia, Africa and Oceania. Its **119 byte-verified bank-published CAMT052/053 originals/payloads** include the twelve compatibility-tested originals above; **22 unchanged Bundesbank files** are committed with permitted attribution, while the other 97 stay external. Source integrity/XSD checks cover all 119. National CAMT profiles, settlement-account reporting and payment-only ISO adoption are distinguished. Open **Bank catalog** in the browser to search banks or country/regional references; returning retains your conversion.

The [North America review](examples/bank-catalog/north-america-review.md) records 38 individual bank/jurisdiction checks across Canada, the US and Mexico, including message versions, reporting channels, public specifications/examples, gated materials and unresolved availability. Announced migrations and payment-network ISO readiness are kept separate from confirmed CAMT reporting.

```sh
npm ci
# Install xmllint first (Ubuntu: apt-get install libxml2-utils).
npm run examples:check
npm run typecheck
npm run build
npm run build:web
npm run test:coverage
npm run catalog:check      # Verify primary-source metadata and geography indexes
npm run test:bank:catalog  # Fetch/check all 119 inventoried bank XML originals
npm run test:coda:published # Fetch/check 29 third-party CODA fixtures
npm run test:bank          # Fetch pinned bank originals; source/XSD/round-trip checks
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run test:bank:e2e -- --project=chromium
npm run test:examples:downloads -- --project=chromium
```

The example-library suite covers all 252 entries, filters, provenance, pagination, accessibility and synthetic downloads in four browsers. Required publisher-download tests acquire fresh direct XML/CODA, ZIP, XLSX and TAR containers and compare actual browser downloads against independent source hashes. Browser-blocked downloads have separate fallback tests. Originals stay ephemeral and are excluded from browser artifacts.

The browser suite also uploads all 104 original fixtures, checks invalid-input blocking and compares actual downloads with the verified converter. To exercise a deployed app instead of starting a local preview:

```sh
PLAYWRIGHT_BASE_URL=https://camt2coda.subite.io npm run test:e2e -- --workers=2
PLAYWRIGHT_BASE_URL=https://coda2camt.subite.io npm run test:e2e -- --workers=2
# Build first, then verify HTML references and exact JS/CSS/worker bytes.
node scripts/verify-deployment.mjs https://camt2coda.subite.io https://coda2camt.subite.io
```

GitHub Actions runs conversion/build/coverage on Node 22 and 24, XSD checks using the bundled specifications, Chromium/Firefox/WebKit/mobile browser workflows with axe accessibility checks and actual downloads, a required bank-original acquisition/integrity/XSD/conversion/Chromium job plus catalog consistency checks, a dependency audit, and a Docker CLI/web smoke test. Main image publication and tagged releases depend on those checks. Bank downloads are never uploaded as CI artifacts or shared caches; acquisition/hash failures fail the job. Live MinIO read/write/list/move checks run in a dedicated required job; they can be enabled locally with `MINIO_ENDPOINT=http://localhost:9000`. Mocked pagination and failure regressions run in every Node test job.

## Specifications

- **CAMT**: ISO 20022 — XSD schemas in `specifications/CAMT/`
- **CODA**: Belgian CODA 2.6 — PDF specification in `specifications/CODA/`
- **Format mapping**: See the [format guide](docs/format-guide.md) and [mapping matrix](docs/mapping-matrix.md)
- **Release history and process**: [Changelog](CHANGELOG.md), [releasing](docs/releasing.md)

## License

MIT — see [LICENSE](LICENSE).
