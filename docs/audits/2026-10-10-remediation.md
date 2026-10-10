# Correctness, completeness and UX audit remediation

The October 10 audit covered the converter, validation, browser workflow, privacy, CLI/API, storage, packaging and verification. This report records the implemented remedies and independent review, with reproducible tests. Public examples are synthetic originals, not bank-emitted files or converter-generated round trips.

## Audit coverage

| Audit area | Implemented behavior | Required evidence |
|---|---|---|
| C01: Reverse schema conformity | Version-specific sequences, BIC/status/party/amount choices; unsupported versions reject | Every valid original CODA against all twelve output schemas; original CAMT 052/053 v02–13 XSD checks |
| C02: Privacy | SHA-256 browser implementation; shared result/download artifact; reverse allowlist; API privacy across all statements and metadata | Real forward/reverse downloads, Node hash vectors, HTTP query/multipart privacy tests |
| C03–C04: Money and intraday completeness | Three-decimal currencies retained, unrepresentable precision/currency rejected, actual 052 entries parsed | Literal maximum/three-decimal/sign/currency expectations, original 052 version matrix |
| C05–C06: Every statement | All forward files and reverse logical statements; selector, per-statement summary, ZIP download | Independent two-statement CAMT/CODA sources, CLI/API/browser tests |
| C07–C08: Validation and warnings | Numeric/domain/date/record/order/link/count/total checks; failures block outputs; all notes visible; runtime and XSD claims separated | Invalid public sources, CLI no-output/no-archive, API status, UI acknowledgment regressions |
| C09: CAMT variants | Prefix/single quotes, modern party wrappers, repeated details, DateTime, other identifiers | Source XSD and literal semantic tests |
| C10–C12: Communications and detail integrity | Record 3.3 and boundary spaces, OGM checksum, references/name-only parties, record links; monetary breakdown grouping | Original long/structured/detail sources, exact detail amounts/signs/references, all-version output matrix |
| C13: CLI outcome integrity | Validate complete input before writing/archive, surface writer warnings, detect duplicate destinations | Filesystem subprocess failure/collision/archival tests |
| C14: Packaging | Builds actual Vite assets, includes both outputs, usable CLI/server entrypoint | Docker build/version/health/HTML/JavaScript smoke gate |
| C15–C16: Discovery and S3 | Case-insensitive direction filtering, complete pagination, encoded copy keys, explicit backend policy, SDK temporary credentials/region | Mocked failure/pagination/provider tests and live MinIO read/write/list/move job |
| U01–U03: Review and inspection | Detect input, retain filename, summary first, all-statement review, exact scoped provenance, desktop bounded panels/mobile tabs | Browser interaction/actual download tests and source range regressions |
| U04–U05: Accessibility and recovery | Roving field/XML focus, meaningful names, arrows/Escape, announcements, selectable errors, source retained | Keyboard, invalid-input recovery and light/dark axe checks across browsers |
| U06: Large input | Cancellable per-job worker, stale result protection, 5 MiB input limit, 25-row summary and bounded record/XML rendering; explicit 9,999 movement/detail capacity | Worker lifecycle, oversized upload, pagination/render bounds and counter-capacity regressions |
| U07–U08: Trust and copying | Accurate runtime/privacy/offline explanations, warning review, awaited clipboard result and fallback | Clipboard denial/unavailability tests and user-facing scope assertions |

## Independent review

A reviewer independently reproduced and verified repairs for monetary detail double counting, reverse API privacy omission, packed BBAN currency corruption, reverse filename collisions, four-digit counter truncation, repeated-remittance provenance, detail precision, v02 amount shape, mixed-sign creditor/debtor selection, nested return-reason contamination, OGM checksum handling, and temporary AWS credentials/region. These findings have behavioral regressions, including additional independently authored source fixtures. Monetary detail fields and v02 amount provenance were reviewed again after fixes. A final precision review verified rejection of tiny sub-thousandth amounts and large excess-precision source decimals before JavaScript numeric conversion, while exact thousandths and extra trailing zeros remain valid. The focused review passed 439 checks plus independent boundary probes.

## Verification and CI

`examples/manifest.json` is the required original-source inventory and literal semantic contract. `examples/author.py --check` detects accidental fixture changes without rewriting anything. `test/integration/public-examples.test.ts` checks original schemas, modeled values, full round trips and every valid original CODA across all supported reverse schemas. Unsupported detail shapes in older versions must reject explicitly rather than invent values.

GitHub Actions requires Node 22 and 24 typecheck/build/coverage, original-source/XSD tests, Chromium/Firefox/WebKit/mobile Chromium production browser tests with actual downloads and axe, dependency auditing, live MinIO storage, and Docker CLI/web smoke. Publication and tagged releases depend on these gates. MinIO's isolated test service is built from a pinned official source release, avoiding reliance on unavailable upstream container images.

Run the commands in the README for verification. Live MinIO tests are enabled with `MINIO_ENDPOINT`; local skips do not bypass the dedicated CI job. Browser traces, failure screenshots and coverage are uploaded by CI. CLI subprocess and real-browser execution supplement unit coverage; generated code, UI primitives and process entry scaffolding are not treated as business-logic coverage.

## Remaining format boundaries

See `docs/conversion-limitations.md` for documented losses and unsupported shapes. Runtime checks do not execute XSD validation. Synthetic privacy exports retain amounts/dates/patterns and deterministic linkability; original source panes remain original. They are review samples and must not be used for bank import. Physical-device and screen-reader certification and deployment-specific performance measurements are distinct from the automated browser/accessibility coverage.

## Final local verification

- 76 independently authored source fixtures; complete original/round-trip/output-version checks pass.
- Full Vitest suite with live MinIO enabled: 1,182 tests passed, zero skipped (54 files).
- Coverage: 94.94% lines, 84.96% branches; existing 90%/80% thresholds retained, S3 and browser adapters added to measurement.
- Typecheck, Node build and production Vite build pass; dependency audit reports zero vulnerabilities.
- Production Chromium, WebKit and mobile Chromium: 27 E2E tests passed (including a 2,000-movement valid statement with bounded DOM, pagination and complete download), including actual privacy/ZIP downloads and light/dark axe scans. Firefox is a required Linux CI project; the local macOS Firefox runtime could not resolve its temporary profile.
- Docker image build, CLI version, HTTP health, HTML and actual bundled JavaScript smoke pass. Live MinIO built from pinned official source and all 29 storage tests pass.
- Independent final review: 471 conversion/storage/example/CLI tests and 14 privacy/provenance/UI checks passed; all confirmed findings resolved, no remaining concrete merge blockers identified before CI.
