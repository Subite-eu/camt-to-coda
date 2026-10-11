# Contributing

## Development setup

Use Node **22.12+ in the 22 series, or Node 24**, npm, Python 3 (independent example authoring), and `xmllint` (XSD tests). On Ubuntu, install `libxml2-utils`; on macOS, ensure `xmllint` is on your PATH. Docker is needed for the live MinIO and image smoke checks.

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm ci
npx playwright install --with-deps chromium firefox webkit
```

```bash
npm run dev -- convert -i examples/camt/camt.053.001.08.xml -o /tmp/coda-example
npm run dev -- reverse -i examples/coda/coda-basic-eur.cod -o /tmp/camt-example
npm run dev:app            # Vite UI with hot reload, port 5173
npm run build              # CLI/core/server → dist/
npm run build:web          # React app and worker → dist-web/
node dist/cli.js serve     # Needs both builds for the UI
```

Input CAMT versions are detected automatically; `--camt-version` is a reverse output option. See the [user guide](docs/user-guide.md) and [HTTP API](docs/http-api.md) for supported options.

## Verification

```bash
npm run examples:check     # Check synthetic originals against independent author.py
npm run catalog:check      # Check evidence metadata and generated geography indexes
npm run typecheck          # Node and React TypeScript
npm test                  # Node and UI unit/integration tests
npm run test:watch
npm run test:coverage
npm run test:examples      # Public sources, literal expectations, XSDs and round trips
npm run test:bank          # Twelve bank originals: semantic conversion and XSD checks
npm run test:bank:catalog  # All 119 inventoried originals/payloads: integrity, content and XSD checks
npm run test:coda:published # 29 third-party CODA sources with explicit provenance
npm run build
npm run build:web
npm run test:e2e           # Built app: Chromium, Firefox, WebKit and mobile Chromium
npm run test:bank:e2e -- --project=chromium
# Combined local checks, after installing prerequisites:
npm run test:ci
```

`npm test` skips acquisition-dependent bank checks unless `BANK_CORPUS_REQUIRED=1`; `npm run test:bank` fetches verified originals and requires those checks. Restricted publisher originals must remain outside commits, published bundles, shared caches and CI artifacts. The 22 unchanged attributed Bundesbank fixtures are the documented exception: do not edit/normalize/relicense them. `npm run test:bank:catalog` fetches all 97 external inventoried XML originals/payloads and validates all 119 source fixtures; `BANK_CATALOG_REQUIRED=1` makes missing originals fail. Read the [bank corpus provenance/terms](examples/bank-published/README.md) before adding sources; literal expectations must come from the original, not converter output. `npm run test:coda:published` retrieves 29 distinct third-party CODA fixtures; `CODA_CORPUS_REQUIRED=1` makes missing files fail, and `CODA_CORPUS_DIR` selects the ephemeral cache. Metadata preserves each original encoding, license and fixture classification. Complete bank-issued CODA sourcing remains unresolved.

`npm test` skips the optional live MinIO cases when `MINIO_ENDPOINT` is unset. CI runs those cases in a dedicated required job. To reproduce it locally:

```bash
docker build -f scripts/Dockerfile.minio-test -t minio:test .
docker run --detach --name camt2coda-minio-test -p 9000:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio:test server /data
curl --fail --retry 20 --retry-connrefused --retry-all-errors --retry-delay 1 --max-time 2 http://localhost:9000/minio/health/live
MINIO_ENDPOINT=http://localhost:9000 npx vitest run --project node test/unit/storage.test.ts
docker rm -f camt2coda-minio-test
```

This uses the pinned source build in `scripts/Dockerfile.minio-test`, matching CI. The legacy `docker-compose.yml` defines MinIO and bucket initialization only; it does not launch the converter and its upstream images are not the CI-tested setup.

To verify a deployed static app with the same browser tests and compare its assets with a local build:

```bash
PLAYWRIGHT_BASE_URL=https://camt2coda.subite.io npm run test:e2e -- --workers=2
node scripts/verify-deployment.mjs https://camt2coda.subite.io https://coda2camt.subite.io
```

Build web assets from the intended commit first for byte comparison. Remote tests use the given deployment instead of starting a local preview. They restrict statement uploads to local browser file selection; unexpected network destinations fail the test. The known hosted Cloudflare analytics/CORS limitation is annotated explicitly in the suite and [deployment report](docs/audits/2026-10-10-deployed-verification.md).

## Code and test organization

| Location | Purpose |
|---|---|
| `src/core/` | Pure conversion pipeline, shared model, field definitions and record builders |
| `src/web-app/` | React UI, worker and colocated component tests |
| `src/web/` | Node HTTP server and browser exports/shims |
| `test/unit/` | Parsers, builders, storage, validation, holidays; `property.test.ts` uses fast-check |
| `test/integration/` | Public original sources/XSDs, CLI, API and regression tests |
| `test/e2e/` | Real browser review, accessibility, privacy, errors and all original-source uploads/downloads |
| `test/golden/` | Supplemental private-bank golden comparisons; see its differences document |
| `examples/` | Required, independently authored public CAMT and CODA originals with literal expectations |
| `specifications/` | Authoritative CODA, Belgian CAMT, AOS and ISO schemas |

Use ESM imports with `.js` extensions from TypeScript, 2-space indentation and existing naming conventions. Keep conversion logic pure and validate side effects at CLI/API/storage boundaries. CODA amounts use integer **thousandths**, not two-decimal cents. Cite the authoritative specification when changing field positions or mappings; see the [mapping matrix](docs/mapping-matrix.md) and [architecture](docs/architecture.md).

## Adding examples and regressions

1. Invent source identities and amounts; author original CAMT and CODA independently of the converter. Keep any private bank data in the ignored `private-examples/` directory and out of commits. An anonymized real statement is not automatically safe public test data.
2. Extend `examples/author.py`, including the literal expectations it writes to `examples/manifest.json`. The authoring utility must not import or invoke the converter. Run `python3 examples/author.py` to regenerate the authored originals, manifest and browser metadata (`examples/catalog.json`), then `npm run examples:check` to verify them. Add a useful title and description for business scenarios; the browser picker loads the same original files on demand.
3. Positive CAMT originals must validate against their bundled XSD; place intentional invalid inputs under `examples/invalid/` with expected failures. Run `npm run test:examples`.
4. Add meaningful assertions for the changed behavior. Cover both directions where applicable, distinguish original-source expectations from generated round-trip output, and document unavoidable losses. Browser tests also exercise every manifest fixture.

## Pull requests and CI

Create a branch from `main`, implement the change and its regression coverage, update affected current guides and `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md), and open a PR against `main`.

GitHub Actions requires Node 22/24 conversion, typecheck, build and coverage checks; independent public-source/XSD checks; four browser projects with accessibility and actual download assertions; a separate bank-original integrity/conversion/Chromium job; a dependency audit; live MinIO; and Docker CLI/web smoke checks. The standard browser suite includes all 104 synthetic originals; the required bank job separately checks all 119 inventoried source files and runs twelve compatibility-original uploads/downloads and one library check without uploading original-file artifacts. The same required source job acquires and validates all 29 third-party CODA fixtures, including source defects and strict conversion rejections. Main Docker publication and tagged releases depend on these gates. All relevant checks and independent review must pass before merging. See [releasing](docs/releasing.md) for the separate release process.


## Maintaining bank and country references

Edit `examples/bank-catalog/catalog.json` for banks and `country-references.json` for authorities. Use primary publisher URLs, a verification date, documented markets, exact evidenced versions (or explicit uncertainty), resource/access labels and reporting scope. Distinguish CAMT customer reporting, settlement-account reporting, payment-only profiles, drafts and future-effective guides. A bank's headquarters or ISO payment migration is not evidence of worldwide CAMT availability. Do not infer absence from a failed search.

Run `npm run catalog:build` after metadata changes and commit the generated geography/bank indexes. `npm run catalog:check` is required CI. Update source pins only after reviewing original publisher bytes; record archive/member hashes separately and preserve source defects. New converter compatibility expectations must be independently read from the original. External originals remain in ignored/ephemeral storage and must not enter browser bundles, Docker inputs or uploaded artifacts.
