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
npm run examples:check     # Check committed originals against independent author.py
npm run typecheck          # Node and React TypeScript
npm test                  # Node and UI unit/integration tests
npm run test:watch
npm run test:coverage
npm run test:examples      # Public sources, literal expectations, XSDs and round trips
npm run build
npm run build:web
npm run test:e2e           # Built app: Chromium, Firefox, WebKit and mobile Chromium
# Combined local checks, after installing prerequisites:
npm run test:ci
```

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
2. Extend `examples/author.py`, including the literal expectations it writes to `examples/manifest.json`. The authoring utility must not import or invoke the converter. Run `python3 examples/author.py` to regenerate the authored originals and `npm run examples:check` to verify them.
3. Positive CAMT originals must validate against their bundled XSD; place intentional invalid inputs under `examples/invalid/` with expected failures. Run `npm run test:examples`.
4. Add meaningful assertions for the changed behavior. Cover both directions where applicable, distinguish original-source expectations from generated round-trip output, and document unavoidable losses. Browser tests also exercise every manifest fixture.

## Pull requests and CI

Create a branch from `main`, implement the change and its regression coverage, update affected current guides and `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md), and open a PR against `main`.

GitHub Actions requires Node 22/24 conversion, typecheck, build and coverage checks; independent public-source/XSD checks; four browser projects with accessibility and actual download assertions; a dependency audit; live MinIO; and Docker CLI/web smoke checks. At this revision the browser suite has 85 tests per project (340 total). Main Docker publication and tagged releases depend on these gates. All relevant checks and independent review must pass before merging. See [releasing](docs/releasing.md) for the separate release process.
