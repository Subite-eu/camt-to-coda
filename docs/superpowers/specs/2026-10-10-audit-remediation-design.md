# Audit remediation and public conformance library

The user authorized all findings and improvements in the 10 October audit, comprehensive original-source CAMT/CODA examples, full GitHub Actions coverage, independent review, and commit/push/PR merge once green.

## Outcome

Both conversion directions preserve all statements, three-decimal money, currency and representable details. Invalid syntax, invalid business fields and malformed CODA cannot be reported as valid. Generated CAMT conforms to its explicitly supported XSD version. Unsupported versions fail explicitly instead of merely changing a namespace.

The browser detects input format, shows every statement, preserves source on errors, explains validation and conversion limitations, and offers an accessible readable summary plus expert raw inspection. Conversion runs in a worker with cancellation and bounded input/rendering. Inspection locates specific source nodes with transformation context. Anonymization protects exported artifacts in both directions, uses matching previews, and strips identifiers from filenames; its scope is explained rather than implying protection from every possible inference.

## Contracts

- Keep the pure `CamtStatement` pivot and CODA field tables. Extend types additively where useful.
- `parseCamt` accepts 052/053 v02–13 and normalizes version shapes, namespace syntax, repeated detail blocks and date choices.
- `statementToXml` supports 053 v02–13 only where validated against every bundled XSD; unsupported message types/versions throw. Preserve three decimals and account currency. Generated mandatory status/timestamp policies are documented.
- `codaToCamt` exposes `statements: CamtStatement[]` alongside legacy `statement` (first), plus one multi-statement XML document. Every logical CODA file is preserved.
- Browser entry `convertForward` retains `files[]` and all warnings; `convertReverse` adds `statements[]` and genuine validation, retaining current XML/lines/warnings keys.
- Storage listing is format-neutral and callers filter by direction. S3 listing exhausts pages. Archive only after all outputs succeed, reject unsupported backend moves or transfer explicitly.
- Runtime validation separates syntax/structure/business/reconciliation checks; CI independently runs full XSD checks. No runtime claim of XSD validation without executing one.
- Public fixtures are synthetic, spec-authored source inputs in both formats, checked in with provenance, literal expected values, and intentional invalid examples. They do not contain private bank data and are not produced by the converter under test.

## UX

Load → review → inspect → download. Original filename, detected version, statement selector and counts stay visible. Show balances/movements/reconciliation and navigable warnings/errors; invalid artifacts cannot be downloaded as successful output. Desktop panes scroll within a bounded workspace with persistent inspection; mobile uses source/result tabs and a selected-field sheet. Field controls have meaningful names, selected state, keyboard navigation and announcements. Search and record navigation avoid hundreds of tab stops. Copy waits for clipboard success with fallback. Keep theme tokens and visible focus; add reduced-motion behavior and usable touch targets.

## Verification and delivery

Public examples cover all input versions, each supported output schema, EUR/three-decimal foreign currency, signs/zero amounts, empty/multiple statements, namespace variants, party shapes, multiple detail blocks, long/structured remittance, refs/return/purpose fields, other accounts, link/record/trailer integrity, and malformed inputs. Regression tests independently assert expected semantics. Browser tests exercise the built app and real file loading/download, privacy, mobile, accessibility, cancellation and large-file behavior. CLI/API/storage tests cover failure/archive policies and mixed/paginated discovery. Docker build and CLI/serve smoke tests gate PRs. CI matrix runs Node 22/24, typechecks/builds, unit/integration/coverage, schema/example tests and browser tests. Final independent review is followed by fixes and re-verification before PR merge.

## Scope boundaries

No CAMT054 support is promised. Unrepresentable bank-internal fields and format length limits remain documented losses with visible warnings. Existing unrelated untracked AGENTS.md is preserved. Audit evidence is retained locally; public docs summarize findings and resolution without private inputs.
