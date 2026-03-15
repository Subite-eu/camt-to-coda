# CAMT-to-CODA Converter

[![Build](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml/badge.svg)](https://github.com/Subite-eu/camt-to-coda/actions/workflows/build-push-action.yml)
[![Release](https://img.shields.io/github/v/release/Subite-eu/camt-to-coda?include_prereleases&sort=semver)](https://github.com/Subite-eu/camt-to-coda/releases)
[![Java](https://img.shields.io/badge/Java-23-orange)](https://openjdk.org/projects/jdk/23/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Vibe Coded](https://img.shields.io/badge/vibe--coded-Claude_Code-blueviolet)](https://claude.ai/claude-code)

> Built with a mix of human expertise + AI pair programming (Claude Code).
> The XSLT mapping logic, anonymization engine, CLI, and test infrastructure were vibe-coded.
> The core CAMT/CODA domain knowledge is human-driven.

Converts bank statement files from **CAMT** (ISO 20022 XML) format to **CODA** (Belgian structured bank statement, 128 chars/line) format.

## Architecture

```
CAMT XML ──> Namespace Detection ──> XSLT Selection ──> Saxon Transform ──> CODA Validation ──> Output
              (camt.053.001.08)     (matching .xslt)    (128-char lines)    (line length)
```

The converter uses an XSLT-based pipeline with **Saxon-HE** as the transformation engine:

1. **Namespace detection** — Regex scan for `xmlns="urn:iso:std:iso:20022:tech:xsd:camt.0XX..."` to determine the CAMT version
2. **XSLT selection** — Exact version match (e.g., `camt.053.001.08-to-coda.xslt`) with fallback to generic (`camt.053.001.XX-to-coda.xslt`)
3. **Transformation** — Saxon processes the XSLT with custom extension functions for date sequences and error handling
4. **Validation** — Output lines must be exactly 128 characters (CODA specification)

### Supported Formats

| CAMT Version | Description | Status |
|---|---|---|
| camt.052.001.06 | Intraday Report | Supported |
| camt.053.001.02 | End-of-day Statement (v2) | Supported |
| camt.053.001.08 | End-of-day Statement (v8) | Supported |

### CODA Records Generated

| Record | Description |
|---|---|
| 0 | Header (BIC, creation date) |
| 1 | Opening balance |
| 2.1 | Movement (amount, date, transaction code, communication) |
| 2.2 | Movement continuation (counterparty BIC) |
| 2.3 | Movement continuation (counterparty account, name) |
| 3.1-3.3 | Information records (batch detail entries) |
| 8 | Closing balance |
| 9 | Trailer (record count, debit/credit sums) |

## Quick Start

### Docker

```bash
docker compose up java-run
```

### CLI

```bash
# Convert CAMT files to CODA
camt2coda convert -v 53 -i input/ -o output/

# Validate a CAMT file
camt2coda validate input.xml

# Show file metadata
camt2coda info input.xml

# Dry-run (validate + transform, but don't write output)
camt2coda convert -v 53 -i input/ -o output/ --dry-run

# Anonymize sensitive data
camt2coda anonymize -i private/ -o examples/ --config anonymize-config.yaml
```

### From Source

```bash
cd java/BankFileConverter
sh build.sh         # Build with Docker (includes tests)
mvn test             # Run tests (requires JDK 23)
```

## Features

- **XSLT-based transformation** — Declarative mapping from CAMT to CODA using XSLT 2.0
- **Transaction code mapping** — ISO 20022 Domain/Family/SubFamily to CODA 8-char codes
- **Structured remittance** — Belgian structured communication (type 101) support
- **Record 3 (Information Records)** — Batch detail entries for multi-transaction statements
- **Dry-run mode** — Validate and preview without writing output
- **Pre-flight validation** — XSD schema + business rule checks before conversion
- **CAMT anonymization** — Replace sensitive data with deterministic fakes for testing
- **S3 support** — Read from / write to S3-compatible storage (MinIO for local dev)
- **Multi-platform Docker** — `linux/amd64` and `linux/arm64`

## Project Structure

```
java/BankFileConverter/
├── CamtToCoda/          # Core conversion module
│   ├── src/main/
│   │   ├── java/eu/subite/
│   │   │   ├── CamtToCoda.java      # Abstract base (template method)
│   │   │   ├── CamtToCodaFs.java    # Filesystem implementation
│   │   │   ├── CamtToCodaS3.java    # S3 implementation
│   │   │   ├── cli/                  # Picocli CLI subcommands
│   │   │   ├── anonymize/           # CAMT anonymization
│   │   │   ├── validation/          # Pre-flight validators
│   │   │   └── tools/               # Saxon extension functions
│   │   └── resources/xslt/          # XSLT transformation files
│   └── src/test/                    # Tests (JUnit 5, jqwik)
├── FileManager/         # S3 file operations module
├── TestTools/           # Docker detection utility
└── docker/              # Build & runtime Dockerfiles
```

## Configuration

### Environment Variables (Docker)

| Variable | Description | Default |
|---|---|---|
| `MODE` | `FS` or `S3` | `FS` |
| `VERSION` | CAMT version (`52` or `53`) | Required |
| `IN` | Input path/bucket | Required |
| `OUT` | Output path/bucket | Required |
| `ARCHIVE` | Archive path | `/tmp` |
| `ERROR` | Error path | `/tmp` |

## Specifications

- **CAMT**: ISO 20022 — XSD schemas in `specifications/CAMT/`
- **CODA**: Belgian CODA 2.6 — PDF specification in `specifications/CODA/`

## License

See repository for license information.
