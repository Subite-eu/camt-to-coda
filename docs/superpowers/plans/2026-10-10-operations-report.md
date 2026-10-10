# Operations remediation report

Owner: CLI/API/storage/packaging agent. Scope: audit C13–C16 and shared runtime validation/warnings. No commits or edits to other owners' implementation areas.

## Progress and regressions

1. Read the remediation design, Task 3/global constraints/review focus, audit C13–C16, and test-driven-development instructions.
2. Added and ran failing behavioral regressions before fixes. Six initial CLI failures reproduced invalid-source output/archive success, early writes before validating later statements, hidden writer warnings, mixed-directory reverse discovery, unsupported backend archive handling, and path traversal through source-derived names. Storage tests reproduced neutral listing failures and four S3 pagination/movement failures. Eight API regressions reproduced body/format/status/warnings/all-statements/static-path failures. Later red tests reproduced batch output overwrites and missing runtime-validation metadata.
3. Repaired CLI preparation and validation before writes, archive failure exit status, safe filenames, duplicate output detection, distinct anonymous batch names, warning propagation, complete reverse statement reporting, and case-insensitive direction filtering.
4. Made filesystem listing format-neutral, regular-file-only, and suitable for explicit files. S3 listing now exhausts continuation pages, excludes directory placeholders, and rejects missing/repeated continuation tokens. Both storage implementations reject cross-backend moves before mutation; S3 copy sources encode key segments.
5. Repaired raw XML and multipart upload parsing/detection, quoted boundaries, invalid direction/media handling, 400 syntax errors, 422 validation failures without downloadable artifacts, complete reverse statements, aggregated warnings, and explicit runtime check metadata with `xsdValidated: false`. Retained loopback default, bounded request buffering and opt-in CORS. Hardened static traversal/malformed URL handling and missing-asset responses.
6. Repaired Docker build inputs and Vite build/copy of actual `dist-web`. Added an allowlist `.dockerignore` so private examples, repository history, credentials, audit artifacts and local dependencies never enter its build context. Image entrypoint supports CLI commands and `serve --host 0.0.0.0`; default command displays help.
7. Replaced the legacy private-file/skip-dependent CLI integration source with required public synthetic CAMT v08, and used `node --import tsx` in CLI subprocess tests to avoid the tsx command's unnecessary IPC socket.

## Verification

- Operations suite: `npx vitest run test/integration/server.test.ts test/integration/operations-remediation.test.ts test/integration/cli.test.ts test/unit/storage.test.ts test/unit/s3-remediation.test.ts` — **60 passed**, five pre-existing MinIO integration tests skipped.
- `npm run typecheck` — passed.
- `npm run build` and `npm run build:app` — passed.
- Built artifacts: `node dist/cli.js --version` returned 2.0.0. Spawned built `serve` and fetched `/api/health`, `/`, and the actual JS asset referenced by built HTML — all passed.
- Full-suite final checkpoint: `npm test -- --reporter=json --outputFile=/tmp/camt-operations-suite.json` — **883 passed, four failed, five skipped** (892 total), while the other owners were still integrating changes.

Named cross-owner failures from that checkpoint:

- `test/integration/public-examples.test.ts`: camt-long-remittance — preserves the literal independently specified statement values.
- `test/integration/public-examples.test.ts`: camt-long-remittance — preserves representable money, parties and communications through a full round trip.
- `test/unit/records/record1.test.ts`: handles non-IBAN account with structure 0.
- `test/unit/records/record21.test.ts`: sets globalisation code to 1 only for batch entries (details > 1).

Root and core owner were notified with these names. The initial full-suite checkpoint had 48 failures during concurrent work; the final checkpoint above supersedes it.

## Limits and handoff

- Docker client exists, but the Docker daemon socket does not. Actual local image build/container execution could not run. Root owns CI image build plus container CLI/serve smoke gates and README corrections.
- No live S3 account or MinIO was exercised. Pagination and move policies use deterministic mocked AWS responses; filesystem tests use real temporary files.
- Cross-backend archive/error moves fail explicitly before conversion; transfer across backends is deliberately unsupported.
- Validation completes for every statement in an input before the first output write. A later storage write failure can leave already-written valid outputs, but the source is not archived successfully and the CLI exits nonzero. This is per-input success gating, not a distributed storage transaction.
- Duplicate generated filenames within an input or across the current batch fail explicitly, preventing silent overwrites. Anonymous names include input and statement ordinals and contain no source account/statement identifiers.
