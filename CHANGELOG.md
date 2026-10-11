# Changelog

Current changes are listed under Unreleased. Older entries describe their historical release, including the retired Java implementation; see the [current documentation](docs/README.md) for available features and commands.

## [Unreleased]

### Added

- Dedicated **Example files** browser view with 252 entries (119 bank-published CAMT originals/payloads, 29 third-party CODA fixtures and 104 synthetic files), filename search, format/provenance/country/publisher filters, 20-file pagination and explicit source-status/country-basis labels. Publisher originals are fetched only on request, checked against size/SHA-256 pins, and extracted without rewriting bytes; browser retrieval failures offer a direct publisher link. Synthetic files support original downloads and conversion, while navigation preserves the current conversion. No complete bank-authored CODA original is claimed.
- Additional worldwide source sweep: PostFinance, BMO workbook attachments, LHV, Slovenská sporiteľňa and Bank of Korea interbank payloads, with original container/member/payload pins and explicit schema defects.
- Separate 29-file third-party CODA research corpus, deduplicated from 65 downloads, with immutable URLs, encoding/license evidence, independently extracted field facts, positive/negative tests and required ephemeral CI acquisition. Belgian bank CODA service/specification evidence remains distinct from complete bank-issued originals.

- Worldwide catalog with 97 bank/brand entries, 58 national/regional/global authorities and 119 byte-verified CAMT052/053 originals/payloads; generated geography/bank indexes, searchable browser filters, clear access/reporting scope, 22 unchanged attributed Bundesbank originals and a required source/XSD CI gate.
- Separate provenance and pinned acquisition for 12 bank-published CAMT originals from ING, ABN AMRO and Nordea; 181 Node checks, real browser uploads/downloads, official UI download links and a required CI publication gate. These twelve publisher originals stay outside Git and published artifacts. Complete bank-issued CODA sourcing remains an explicit acquisition gap.

- Bidirectional browser review with statement summaries, reconciliation, pagination, multi-statement selection/ZIP, exact field provenance, keyboard navigation, responsive panels, cancellation and recovery.
- Privacy exports in both browser/API directions, with consistent result preview/download, safe filenames and explicit retained-data boundaries.
- 104 independently authored original CAMT and CODA fixtures with literal expectations, positive/negative cases and all supported input/output XSD checks; business scenarios include salaries, cards, direct debits, international transfers, interest, refunds and busy statements.
- Searchable browser sample library with format filters, descriptions, opt-in invalid examples and original files loaded on demand.
- Prominent download panel with the converted filename, explicit CODA/CAMT action, adjacent note acknowledgment and multi-file ZIP option.
- Required CI on Node 22/24, four browser projects with accessibility and actual downloads, dependency audit, live MinIO and Docker CLI/web smoke checks before publication.
- Remote browser testing through `PLAYWRIGHT_BASE_URL`, deployed asset byte verification, and dated audit/deployment evidence.
- Current documentation index and HTTP API reference covering request/response shapes, limits, validation and privacy.

### Changed

- Reverse XML serialization rejects invalid account/counterparty BICs using the target version’s bundled ISO pattern, including invalid placeholders found in external CODA fixtures, instead of producing schema-invalid XML.

- CAMT 052/053 input and CAMT 053 output support versions 02–13 with version-specific XML serialization; reverse output defaults to .08 and preserves all statements.
- Transaction mapping and CODA reference descriptions, 30 EEA holiday calendars, standard AWS SDK credentials/region handling and paginated S3 listing.
- Browser conversions run in a cancellable worker with a 5 MiB limit. Runtime errors block download; conversion notes require acknowledgment.
- Installation, CLI, architecture, mappings, limitations, contributor and release documentation now describe the TypeScript implementation and actual publication outputs.
- Dependency updates include PostCSS 8.5.29 and Vitest/coverage 4.1.11.

### Fixed

- CAMT052 interim booked (`ITBD`) closing balances and deterministic booked-before-available balance selection, including a regression found in ING's official intraday example.

- Exact three-decimal money handling, lexical precision/overflow checks, mixed-currency rejection and balance/trailer reconciliation.
- Record 3.1 positions, Belgian BBAN currency placement, movement/detail numbering and continuation links; monetary details no longer count as additional account movements.
- Record 4 free communications, structured-reference checksum handling, long communications, detail references and local return reasons.
- Reverse multi-file reconstruction, modern party wrappers and version-specific status/BIC/detail amount shapes; unsupported or unrepresentable outputs fail explicitly.
- CLI output path/collision handling, archive/error validation and failure exit status; HTTP media types, body limits, CORS defaults and reverse privacy metadata.


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
