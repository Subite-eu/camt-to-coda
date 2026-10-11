# Worldwide source sweep implementation plan

User scope: another broad internet sweep for CAMT originals and documented usage,
plus Belgian bank and software sources containing complete CODA examples. Earlier
authorization to test, review, commit, push and merge when green remains active.

## Evidence and constraints

Use official bank/authority evidence for CAMT availability and geography. Distinguish
bank-published examples from production exports, third-party fixtures, synthetic
data and specification excerpts. Preserve downloaded bytes and source defects.
Commit provenance and literal expectations; keep unlicensed/restricted originals
in ignored ephemeral caches, excluded from bundles, Docker images and CI artifacts.
Complete third-party CODA examples do not close the bank-issued CODA acquisition gap.

## Tasks

- [x] Research independent Americas/APAC, EMEA and Belgian CODA sources in parallel;
  review exact URLs, file contents, namespaces, rights and channel/market scope.
- [x] Expand `examples/bank-catalog/catalog.json`, `country-references.json` and
  `source-inventory.json`; independently pin new XML hashes, byte lengths, content
  counts and expected XSD outcomes. Regenerate geography indexes.
- [x] Add a separately classified CODA publisher manifest and research README.
  Test unchanged complete fixtures against independent fixed-width facts, literal
  balances/movements, parser and reverse-conversion behavior. Retain malformed or
  legacy examples with explicit expected rejection where appropriate.
- [x] Add regression coverage for inventory-derived summary counts in
  `test/unit/bank-catalog.test.ts`; update `scripts/build-bank-catalog.mjs` so
  expanding the inventory cannot leave stale hardcoded validation totals.
- [x] Include required CODA-source acquisition/integration checks in the existing
  ephemeral bank-source CI gate, with cleanup and no original artifact upload.
- [ ] Update current documentation, run catalog/type/build/source/coverage/browser
  checks and obtain independent review. Push a PR; merge only its green exact head.
- [ ] Verify both deployed production builds and focused end-to-end behavior.

## Review focus

- A bank's headquarters do not establish the geographic reach of its CAMT service.
- A PDF/inline fragment is not a downloadable original XML/CODA file.
- Published file defects must not be silently normalized into test expectations.
- Repeated archive members and identical files must not inflate unique-file claims.
- Source summaries and CI requirements must grow with canonical metadata.

## Findings and validation

- 97 bank/brand entries, 58 authority references, 61 geography/scope groups.
- 119 unique CAMT originals/payloads: 107 valid, 5 invalid as published, 5 missing namespaces, 2 wrapped. Fresh acquisition and 239 source checks passed.
- 29 third-party CODA fixtures from 65 downloads; no verified complete bank-issued original. Original encodings and independent literal facts retained.
- Source testing exposed invalid BIC output; focused schema-version guards reject invalid identifiers without rewriting input.

- Independent review found no blockers; corrected CODA schema-coverage wording and retained the existing CI job name. Focused browser verification: 17 passed (catalog plus 12 original uploads/downloads and library check). CODA required checks: 138 passed.

- Final local coverage: 1,597 passed, 515 optional source/live-storage checks skipped; separate required runs pass 181 bank compatibility, 239 catalog source and 138 CODA checks. Typecheck, build, 104 synthetic-fixture authoring checks and catalog consistency pass. GitHub Actions must supply live MinIO and the full four-browser matrix before merge.
