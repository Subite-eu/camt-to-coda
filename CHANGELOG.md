# Changelog

## [2.0.0] - 2026-03-15

### Changed
- Complete rewrite from Java/XSLT to TypeScript
- 288+ tests (unit, integration, property-based)
- Pure-function record builders (individually testable)
- Storage abstraction (filesystem + S3/MinIO)
- Commander-based CLI with subcommands
- Minimal web UI (drag-drop, preview, download)
- CODA output anonymization (--anonymize flag)
- Holiday calculator for BE/LT/NL working-day sequences
- ~1500 lines of TypeScript (vs ~5000 lines Java + XSLT)

## [1.x] - Quality Expansion (Java)

### Added
- **Record 3.x (Information Records)** — Full implementation of CODA records 3.1, 3.2, 3.3 for batch detail entries in both CAMT 052 and 053 XSLTs
- **Transaction Code Mapping** — New `TransactionCodeUtils.xslt` mapping ISO 20022 Domain/Family/SubFamily to 8-character CODA transaction codes (SEPA CT, instant payments, direct debits, card payments, interest, charges)
- **Structured Remittance** — When `RmtInf/Strd/CdtrRefInf/Ref` is present, communication type is set to `1` (structured) with CODA type 101 formatting
- **CAMT Anonymization Tool** — Configurable anonymizer for replacing sensitive data (IBANs, BICs, names, references) with deterministic fakes. YAML config, CLI subcommand, referential integrity preservation
- **Pre-flight Validation** — XSD schema validation and business rule checks (account ID, currency, balances, dates) before conversion
- **Dry-Run Mode** — `--dry-run` / `-d` flag validates and transforms without writing output or moving source files
- **Picocli CLI** — New user-friendly CLI with subcommands: `convert`, `validate`, `info`, `anonymize`
- **Test Expansion** — DateToSequenceHelper tests, XSLT template test helper, business rule validator tests, anonymizer tests (IBAN generator, config parser, round-trip), edge case test data
- **CI/CD Improvements** — Split workflow into test/quality/build jobs, SpotBugs static analysis, OWASP dependency check, release automation
- **Documentation** — Full README rewrite, architecture docs, format guide, user guide, contributing guide

### Fixed
- **Record 9 Count** — Now correctly counts all emitted records (2.1, 2.2, 2.3, 3.x, 8) instead of just `2 + count(Ntry)`
- **Record 2.3 Link Code** — Dynamic link code (was hardcoded `0`, now `1` when Record 3 follows)

### Dependencies
- Added: SnakeYAML 2.2, Picocli 4.7.6, jqwik 1.9.1
- Added: JaCoCo (coverage), PITest (mutation testing)
