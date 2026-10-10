# Audit remediation implementation plan

Design: `docs/superpowers/specs/2026-10-10-audit-remediation-design.md`. User authorized execution and merge; no further permission gate is required for the agreed scope.

## Global constraints

TypeScript/ESM with .js imports; CODA exactly 128 characters; integer thousandths (12 integer + 3 decimal); no private examples committed; spec references in mapping documentation; preserve every logical statement. Agents own disjoint file sets and do not commit or alter each other's files. Root integrates, reviews and commits. Add failing behavioral regressions before implementation.

## Task 1 — Core conformance (core/validation owner)

Consumes `CamtStatement` and audit C01/C03–C12. Produces additive `statements[]` on reverse and browser adapters, preserving `statement`, XML/lines/warnings. Owns `src/core/**`, `src/validation/**`, `src/web/browser-entry.ts`, and related node core tests.

- Reproduce schema invalidity, precision/currency loss, 052 entries, multiple statements, invalid syntax/numbers, repeated/modern details, continuations/OGM/refs and link failures in regression tests; verify red with Vitest and xmllint.
- Implement normalized parsing, complete CODA logical-file reconstruction, version-aware serialization, warning/validation contracts and field/detail/link preservation.
- Use every bundled 053 schema to validate generated output; test incompatible versions reject. Runtime metadata must accurately distinguish semantic validation from XSD validation.
- Verify core tests, full suite/typecheck after integration, and report any cross-owner failures rather than changing unrelated files.

## Task 2 — Browser workflow (web owner)

Consumes browser-entry forward files/reverse statements, core field tables and audit C02/U01–U08. Owns `src/web-app/**`, `src/anonymize/**`, `src/web/crypto-shim.ts`, Vite config if necessary, and frontend tests. Avoid package/config ownership conflicts: request dependencies from root.

- Add failing regressions for successful nonempty privacy in both directions, all statements, preview/download consistency, detection/error recovery, real field mapping and accessibility.
- Implement browser-safe anonymization, shared conversion artifacts, worker/cancel/input limits, readable summary + expert view, exact-source mapping, bounded desktop/mobile inspection, efficient accessible record/field navigation, honest validation/download states and clipboard recovery.
- Preserve design tokens, contrast and focus; test file read/download behavior and large input boundaries. Root owns production-bundle Playwright tests and CI dependencies.

## Task 3 — CLI/API/storage/packaging (operations owner)

Consumes core additive contracts, audit C13–C16 and warning/validation fixes. Owns `src/cli.ts`, `src/storage/**`, `src/web/server.ts`, Dockerfile, .dockerignore, operations tests. Root owns GitHub workflow and package scripts.

- Add failing regressions: invalid source creates no output/archive, writer warnings visible, multiple reverse statements, reverse mixed directory inputs, paginated S3 listing and cross-backend archive policy.
- Implement complete validation gating, safe output paths/names and per-input success; filter neutral listings by direction; exhaust S3 pages; transfer or explicitly reject unsupported cross-backend moves.
- Repair Docker multi-stage Vite build/copy and static server paths; support container CLI and serve smoke tests. Keep local socket/body-size protections.

## Task 4 — Public examples and CI (root)

Owns `examples/**`, scripts, package manifests/lock, GitHub workflows, Playwright configuration/tests, public example/schema integration tests and docs.

- Author independent synthetic CAMT sources for 052/053 v02–13 and edge-case variants; independently build CODA source lines from literal spec positions without using production builders. Manifest records provenance, expected semantics and valid/invalid status.
- Add tests requiring all public sources and expected values, full XSD validation, precision/all-statement preservation, invalid rejection, exact CODA dimensions/flags/totals and reverse output schema validity. No skips for missing public files/tools in CI.
- Add browser e2e/axe fixtures against built preview; check actual downloads, upload/detection, privacy, multiple statements, mobile inspection, keyboard and recovery.
- CI Node22/24 unit/integration/typecheck/build; coverage; XSD/public fixture validation; browser e2e with artifacts; Docker build/CLI/static health smoke checks; deployment gated on all jobs.
- Update architecture/mapping/limitations/user guides and fixture provenance/coverage docs to match verified behavior.

## Task 5 — Integration, independent review and merge (root + fresh reviewer)

- Review all audit items against implementation and evidence, run full local verification and production browser inspection.
- Give a fresh reviewer the complete branch diff, design and coverage checklist; fix correctness/accessibility/CI issues and re-review fixes.
- Commit explicit project paths (exclude unrelated AGENTS.md/local audit artifacts), push branch, create/attach PR; monitor all GitHub Actions checks and fix failures. Merge only when checks and review are clean, then verify merged main and report PR/commit/tests.

## Review focus

1. XSD sequences and Party/BIC/status choices across v02–13 must be verified independently.
2. Every amount, continuation and statement remains represented; defaults/warnings never silently erase invalid data.
3. Privacy tests assert success and meaningful output, matching preview/download and filenames.
4. Async worker completion cannot overwrite newer input or ignore cancellation; keyboard/mobile navigation remains usable.
5. Public source fixtures are independently authored, required in clean CI, and genuinely exercise the advertised matrix.

## Progress

- Baseline audit: 673 tests passed, five skipped; typecheck and builds passed. User requests all remediation, public examples, comprehensive CI and merge.

- Implemented all workstreams and independent review followups. Public originals and full schema/behavior matrix are required, with browser/coverage/container/live-storage CI gates. Final integration evidence is recorded in `docs/audits/2026-10-10-remediation.md`; PR publication/green-check merge is the remaining delivery step.
