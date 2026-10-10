# Deployed app verification

Both public domains were exercised directly on October 10, 2026: `https://camt2coda.subite.io` and `https://coda2camt.subite.io`. Requests used the deployed assets and conversion worker, with no application mocks or local preview server.

## Results

- Each domain passed 255 browser checks: all 76 independently authored source fixtures plus nine workflow checks, across Chromium, WebKit and mobile Chromium. Total: 510 passing checks.
- All valid original-source downloads matched the verified converter byte for byte, including every forward statement. All invalid originals blocked download after acknowledging any conversion warnings. An explicit network allowlist rejected unexpected submissions regardless of encoding, unexpected GET paths/query strings and WebSockets; only built static assets and known edge analytics were permitted. No unexpected submissions or application exceptions were observed in these checks.
- Workflow checks exercised multi-statement selection and ZIPs, forward/reverse privacy preview and download, reverse output XSD validation, keyboard field navigation, invalid-input recovery, the 5 MiB limit, light/dark axe accessibility, and a 2,000-movement conversion with bounded rendering and complete output.
- Desktop and 390 px mobile views were inspected visually: summary, field mapping, source highlighting, document tabs, inspector and downloads. No horizontal overflow was observed.
- HTML references and deployed JavaScript, CSS and worker bytes matched the production build from audit remediation commit `2a95dca4a0bb1763d66d932f34de3913ce58cf62`.

| Asset | SHA-256 |
|---|---|
| `index-BM4roZmJ.js` | `3eab85a823c76e537b7478e15cf31ccff2fc62b2b682f2737a0c24589948b6d6` |
| `index-B1I4Yrki.css` | `eb17e818b5f7dd0e38dfdb9c3878581f59f4e8eb6ac500e26abf300f6383aa48` |
| `conversion.worker-C4iX5MYU.js` | `a359a7a68a2cf3ec4d9c25ef31a08d65a9fcab6c16c63b97f445bd193b1a0def` |

Cloudflare injects analytics at the edge. This environment could not reach its `cloudflareinsights.com/cdn-cgi/rum` endpoint; WebKit reports that specific access-control failure as a page exception. The fixture tests annotate that exact external telemetry error separately and continue to fail on other page exceptions. Application assets, conversions and downloads succeeded. Firefox is required in Linux CI; the local macOS Firefox startup limitation remains as documented in the remediation report. These checks do not certify physical devices or screen readers.

## Dependabot review

PR #22 proposed PostCSS 8.5.25; merged remediation already installed 8.5.29 with nanoid 3.3.16. The superseded PR was closed while retaining the newer version. PR #24 raises the Vitest and coverage minimum versions to 4.1.11 and updates compatible development dependencies. It was refreshed against current main, reviewed, and merged only after the complete Node, browser, security, live-storage, Docker and preview matrix passed. Merge commit: `bf450fd628195a2b8b25578f3251002ce0c0665c`.

## Reproduce

See the deployed test commands in the README. `PLAYWRIGHT_BASE_URL` disables the local preview server. `scripts/verify-deployment.mjs` checks that live HTML references the current built assets, then compares their bytes; stale HTML or assets fail explicitly. The original-source browser suite also runs in every existing CI browser project (85 checks per project, 340 across the four CI projects). Independent review identified and verified repairs for warning acknowledgment masking invalid-download checks and JSON encoding evading the initial request-body assertion; the strengthened checks were rerun against both live domains.
