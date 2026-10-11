# User Guide

See the [documentation index](README.md) for mapping details, limitations and contributor instructions.

## Use the browser app

Open [camt2coda.subite.io](https://camt2coda.subite.io) or [coda2camt.subite.io](https://coda2camt.subite.io). Both sites provide the same bidirectional app:

1. Drop or select one CAMT XML or CODA file, paste its contents, or open a built-in sample. Search the **104 synthetic original samples** by scenario or version, filter by CAMT/CODA, and opt into invalid examples to test error handling. Open **Example files** in the header for the complete downloadable library described below. The app detects the conversion direction. The input limit is **5 MiB**.
2. Review the statement summary, opening/closing balances, reconciliation and movements. A file can contain several statements; use the statement selector to review each one. Movement lists are paginated.
3. Open the field inspector to compare source and result. Search or jump to a record; use arrow keys to navigate fields, Enter/Space to inspect and Escape to close. On small screens, switch between source and result tabs.
4. Review conversion notes and acknowledge them before downloading. Validation errors block downloads even after notes are acknowledged. You can cancel an in-progress conversion and retry after an error.
5. The **Ready to download** panel beneath the file status shows the actual output filename and **Download CODA (.cod)** or **Download CAMT (.xml)** button. For forward conversion, download the selected statement or use **Download all (N) · ZIP** for multiple results. Reverse conversion produces one CAMT XML document containing all reconstructed statements. If notes need review, the acknowledgment checkbox appears beside the disabled download.

Conversion runs in a local browser worker. Bank statement contents are not uploaded by the UI. The hosted page still fetches site assets and may contact Cloudflare analytics; an offline reload is not guaranteed.

**Anonymize** changes the result preview and downloaded artifact together; the source panel remains original. Names, account identifiers, references and free text are removed or replaced. Amounts, dates, currencies and transaction patterns remain, and deterministic pseudonyms are linkable. Synthetic identifiers are for review, **never bank import**. Use the independently authored [example library](../examples/README.md) for shareable test data.

## Find and download example files

Open **Example files** in the header, or visit `/#examples`. The library contains **254 files: 121 bank-published CAMT originals or unchanged payloads, 29 third-party CODA fixtures, and 104 synthetic test files**. Search filenames, publishers and descriptions; filter by **Format**, **Provenance**, **Country / scope**, and **Bank or publisher**. Results appear in pages of 20. Returning to the converter preserves your loaded source and converted result.

Each file identifies its publisher, bank relationship, provenance, source status, usage terms and country basis. **Bank-published original** means the source was published by the named bank or central bank. **Third-party fixture** means a developer or vendor published it; bank authorship and production origin are unverified. **Synthetic test data** uses invented identities and has no bank affiliation. No complete bank-authored CODA original has been verified.

Country filters describe documented publisher scope where available. An ING service-scope match, for example, does not establish the country of its individual sample. Belgian CODA format scope does not verify a third-party fixture's bank or production origin; synthetic files are **Not country-specific**. Read the country basis on the file before treating a filter match as provenance.

Source statuses have different meanings. **XSD valid** refers to source schema validation, without certifying every converter mapping. **Conversion tested** records the corpus's documented conversion checks and any representation limits. Schema defects and **Expected rejection** identify known negative examples; downloading an original does not repair or endorse it. Review the description and [conversion limitations](conversion-limitations.md) before using the result.

Browsing loads metadata only. **Save original file** explicitly fetches from the publisher and verifies the pinned download size and SHA-256 before extracting an exact ZIP or regular gzip TAR member. Reviewed embedded XML is saved as its unchanged, separately pinned byte range. The complete member and final payload hashes are checked, with an 8 MB download/expanded TAR limit and a 2 MB original limit. The app never proxies or rehosts publisher originals. Publisher terms still apply.

If the browser cannot fetch the source because of CORS, a network failure, a changed file or an unreviewed redirect, the app offers the publisher link. Download there, extract the named member where needed, and upload the file to the converter. **Download test file** saves the synthetic original; **Try in converter** opens that synthetic example directly. Synthetic files and anonymized exports are for testing and review, **never bank import**.

Huntington’s two **Extracted inline XML** entries come from its official Markdown documentation. Their XML code-block text is unchanged, including the final newline; this library assigns the `.xml` filenames. They are bank-authored illustrations, not customer statements. CAMT052 v8 has published schema defects and fails CODA validation; CAMT053 v2 passes XSD and conversion checks but contains US-prefixed IBAN placeholders. See the [Huntington provenance and validation record](../examples/bank-catalog/north-america/united-states/huntington/VALIDATION.md) for exact extraction boundaries and test outcomes.

For blocked direct access, open **Publisher Markdown source**, save the source as a `.md` file, then choose **Extract saved publisher page** on the same entry. The browser checks the complete saved page hash/size, extracts the reviewed byte range and checks the XML hash/size before downloading it. The page stays on your computer. Edited or updated pages fail integrity checks; they are never silently accepted.

## Install the CLI and local server

### From source

Use Node **22.12 or newer in the 22 series, or Node 24**, npm, and Git. Run from the repository root:

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm ci
npm run build
npm run build:web
node dist/cli.js --help

# Optional: expose this checkout as the camt2coda command.
npm link
```

The commands below use `node dist/cli.js`; after linking, `camt2coda` accepts the same arguments. Building the CLI alone does not build the web assets.

### Docker

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main
docker run --rm ghcr.io/subite-eu/camt-to-coda:main --help
docker run --rm -v /path/to/camt:/in -v /path/to/coda:/out ghcr.io/subite-eu/camt-to-coda:main convert -i /in -o /out
```

Use a `vX.Y.Z` image tag for a specific published release; `main` follows passing main builds. See [releasing](releasing.md) for publication details.

## Worldwide reporting references

Open **Bank catalog** in the header, or visit `/#bank-catalog`. Search by bank name, country or format; filter by region, country/market and resource type. Switch to **Country & regional references** for national associations, central banks and regional/global bodies. The catalog records 104 bank/brand entries and 58 authority references, with public downloads, inline/PDF examples, specifications, registration portals and service information labeled separately. Source notes identify historical/future-effective guidance, blocked or broken links, and channel/account restrictions. Returning to the converter preserves your loaded source and result. Selecting North America, Canada, United States or Mexico also reveals a link to the [bank-by-bank North America review](../examples/bank-catalog/north-america-review.md), including public evidence gaps and announced migrations.

ISO 20022 adoption for payment clearing does not establish a national CAMT customer-reporting standard. The authority entries distinguish those cases and settlement-account reporting. CAMT054 and SWIFT envelopes are reference-only for this converter. See the [geography and bank indexes](../examples/bank-catalog/README.md) and [original-source inventory](../examples/bank-catalog/source-inventory.json); an absent country is not yet inventoried, rather than evidence that the format is unavailable.

### Customer delivery and communication channels

Select **Communication channels** in the Bank catalog, or open `/#bank-catalog?section=channels`. The regional overview summarizes evidence for 71 banks and five operating/reference institutions across 131 channel records. Filter by region, country/market, delivery channel, automation and delivered content; search covers bank names, formats and setup requirements. Each bank/reference entry also has an optional **Customer delivery and automation** section when verified information is available.

Records distinguish API, SFTP, secure FTP with unspecified protocol, EBICS, WebDAV, host-to-host, managed file transfer, SWIFT FileAct/FINplus or unspecified SWIFT service, banking portals and accounting integrations. A public developer portal is not itself evidence of customer API delivery. Records state the actual reporting format, documented market, customer restrictions, onboarding/credentials, available schedules and primary sources with a verification date.

An API supplying other account data is labeled separately from CAMT/CODA XML delivery. Operator/interbank reporting is also separate from corporate file channels. Historical material and announcements remain visible, with their status, but do not contribute to current documented automated-file totals. “Documented” means the publisher describes the service; account entitlement and implementation still require bank confirmation.

Regional counts describe catalog coverage, not national adoption or market share. An institution is counted once per region even if it offers several channels. Automated-file counts include documented CAMT/CODA channels with automation available and exclude other account-data APIs, operator-only infrastructure, historical evidence and announcements. Each channel has its own geography; global scope is not assigned to individual countries. Missing information means not established. A [generated regional evidence document](../examples/bank-catalog/communication-channels.md) provides the same source records outside the app.

## CLI commands

### CAMT to CODA

```bash
node dist/cli.js convert -i examples/camt/camt.053.001.08.xml -o /tmp/coda-example
node dist/cli.js convert -i /path/to/camt/ -o /path/to/coda/ --dry-run
node dist/cli.js convert -i /path/to/camt/ -o /path/to/coda/ --anonymize
node dist/cli.js convert -i /path/to/camt/ -o /path/to/coda/ --archive /path/to/archive/ --error /path/to/errors/
```

CAMT **052 and 053, versions 02–13**, are detected from the namespace; there is no `-v` input-version option. Each statement produces a separate CODA file. Directory inputs include immediate regular files ending in `.xml`, case-insensitively; traversal is not recursive.

`--archive` moves successfully processed inputs; `--error` moves failed inputs. Moves must use the same storage backend as the input. Each input's statements are validated before its outputs are written or it is archived. A batch is not a storage transaction: an I/O failure can leave already-written outputs. Generated filenames are normalized to portable names; excessive lengths and output collisions are rejected. `--dry-run` writes no outputs and moves no inputs.

`--anonymize` applies to forward CODA output and uses generic filenames. There is no standalone `anonymize` CLI command, and `reverse` has no anonymization flag. The browser and HTTP API support privacy exports in both directions.

### CODA to CAMT

```bash
node dist/cli.js reverse -i examples/coda/coda-basic-eur.cod -o /tmp/camt-example
node dist/cli.js reverse -i /path/to/coda/ -o /path/to/camt/ --dry-run
node dist/cli.js reverse -i statement.cod -o output/ --camt-version camt.053.001.02
```

Reverse output defaults to **camt.053.001.08**; `--camt-version` accepts camt.053.001.02 through .13. Each input becomes one XML file containing all its statements. Directory inputs accept `.cod` and `.coda`, case-insensitively and non-recursively. Duplicate output basenames are rejected. Reverse conversion reconstructs the information CODA can represent; consult [conversion limitations](conversion-limitations.md) before relying on a round trip.

### Validate and inspect CAMT

```bash
node dist/cli.js validate examples/camt/camt.053.001.08.xml
node dist/cli.js info examples/camt/camt.053.001.08.xml
```

`validate` checks XML syntax, supported structure, modeled account/currency/amount/date requirements, generated CODA and balance reconciliation. It does **not** run full XSD validation. CI independently validates public CAMT sources and generated reverse XML against the bundled XSDs. Balance mismatches are reported as conversion notes; the browser requires acknowledgment before download. Modeled validation errors remain blocking.

`info` displays detected version and statement metadata, including account, currency, owner, balances and entries. It is an inspection command, not a substitute for validation. CLI processing failures exit with status 1; successful commands exit with status 0.

### Serve the UI and HTTP API

```bash
# Requires both builds from the installation steps.
node dist/cli.js serve
node dist/cli.js serve --port 8080 --host 127.0.0.1

# Container interfaces require an explicit non-loopback binding.
docker run --rm -p 3000:3000 ghcr.io/subite-eu/camt-to-coda:main serve --host 0.0.0.0
```

The default address is `http://127.0.0.1:3000`. The UI still converts locally. Explicit requests to the separate [HTTP API](http-api.md) upload data to the Node server for processing. API bodies default to **10 MiB**, configurable through `--max-body-mb`; CORS is opt-in through `--cors-origin <exact-origin>`.

For UI development use `npm run dev:app` (Vite, port 5173). `npm run build:web` creates the static `dist-web/` site, which can be hosted without the Node API.

## Filesystem and S3 storage

Both conversion commands accept filesystem paths and `s3://bucket/key-or-prefix` paths. S3 uses the optional `@aws-sdk/client-s3` dependency and the standard AWS SDK credential provider chain: environment credentials, temporary `AWS_SESSION_TOKEN`, shared profiles or runtime roles. Region uses `AWS_REGION`, then `AWS_DEFAULT_REGION`, then `us-east-1`. `--endpoint` selects an S3-compatible service such as MinIO.

```bash
# Supply credentials through your environment, profile or runtime role.
node dist/cli.js convert -i s3://camt-bucket/incoming/ -o s3://coda-bucket/converted/ --endpoint http://localhost:9000

docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN -e AWS_REGION ghcr.io/subite-eu/camt-to-coda:main convert -i s3://camt-bucket/incoming/ -o s3://coda-bucket/converted/ --endpoint http://host.docker.internal:9000
```

The Docker endpoint above uses Docker Desktop's host address; choose an address reachable from your container. The retired `MODE`, `VERSION`, `IN`, `OUT`, `ARCHIVE`, `ERROR`, `EP`, `AK` and `SK` variables do not configure the CLI. Use explicit arguments and standard AWS variables. The [contributor guide](../CONTRIBUTING.md) provides the live MinIO test recipe used by CI.

## Troubleshooting

| Symptom | Action |
|---|---|
| Unsupported CAMT namespace | Check the actual XML namespace; only 052/053 v02–13 are supported inputs. CAMT 054 schemas are reference material only. |
| Invalid CODA line width/order/links | Use original 128-character records without editor wrapping or trimming. Line endings may be LF or CRLF. Review the record named in the validation error. |
| Balance mismatch, mixed currencies or excess amount precision | Correct the source data. Review balance mismatch notes and correct the source as needed. Mixed entry/account currencies and values not exactly representable in CODA thousandths are rejected. |
| Missing BIC | ISO permits it; the converter does not require a BIC universally. A receiving bank's profile may impose additional rules. |
| Reverse version cannot represent detail data | Select a newer output version. v02 cannot preserve opposite-sign monetary details; v03–06 require amounts for multiple details. |
| Missing web app/assets | Run both `npm run build` and `npm run build:web` before starting the compiled server. |
| S3 connection or move failure | Check endpoint reachability, bucket permissions, standard AWS credentials/region and same-backend archive/error paths. |
| Input too large | Split browser inputs above 5 MiB; the API has a separate configurable body limit. CODA counters also limit each statement to 9,999 movements and each movement to 9,999 details. |
