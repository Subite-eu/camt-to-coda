# User Guide

## Installation

### Docker (recommended)

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main
```

### npm / npx

```bash
# Run without installing
npx camt2coda --help

# Install globally
npm install -g camt2coda
```

### From Source

Requires **Node 22+** and npm.

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm install
npm run build
# The compiled CLI is at dist/cli.js
node dist/cli.js --help
```

## Usage

### Basic Conversion

```bash
# Convert all CAMT 053 files in a directory
camt2coda convert -v 53 -i /path/to/camt/ -o /path/to/coda/

# Convert a single file
camt2coda convert -v 53 -i statement.xml -o output/

# Convert CAMT 052 files
camt2coda convert -v 52 -i /path/to/camt052/ -o /path/to/coda/
```

### Dry-Run Mode

Preview what would happen without writing any files:

```bash
camt2coda convert -v 53 -i input/ -o output/ --dry-run
```

Output shows:
- Which CAMT version was detected
- Whether pre-flight validation passes
- How many output files would be created
- Record counts per file

### Anonymization

Replace sensitive data in-line during conversion (IBANs, BICs, names, references replaced with deterministic fakes):

```bash
camt2coda convert -v 53 -i input/ -o output/ --anonymize
```

This is useful for generating test fixtures from real statements. The anonymization is deterministic: the same input always produces the same fake values, preserving referential integrity.

### Validation Only

Check a CAMT file without converting:

```bash
camt2coda validate statement.xml
```

Checks:
- XML well-formedness
- XSD schema compliance
- Account identifier present
- Currency present
- Opening/closing balances present
- Date fields present

### File Information

Display metadata about a CAMT file:

```bash
camt2coda info statement.xml
```

Shows: CAMT version, account IBANs, currency, entry count, statement count, dates.

### Web UI

Start a local web server with a drag-and-drop interface:

```bash
camt2coda serve
# or with a custom port:
camt2coda serve --port 8080
```

Open `http://localhost:3000` in your browser. You can:
- Drag and drop one or more CAMT files
- Preview the converted CODA output inline
- Download the result as a `.cod` file

### S3 Mode

Read from / write to S3-compatible storage:

```bash
camt2coda convert -v 53 \
  -i camt-bucket -o coda-bucket \
  --mode s3 \
  --endpoint http://localhost:9000 \
  --access-key mykey \
  --secret-key mysecret
```

Using environment variables (suitable for Docker):

```bash
docker run --rm \
  -e MODE=S3 \
  -e VERSION=53 \
  -e IN=camt-bucket \
  -e OUT=coda-bucket \
  -e EP=http://minio:9000 \
  -e AK=mykey \
  -e SK=mysecret \
  ghcr.io/subite-eu/camt-to-coda:main
```

### Docker Compose (local dev with MinIO)

```bash
docker compose up
```

This starts MinIO (S3-compatible) alongside the converter. See `docker-compose.yml` for the full configuration.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MODE` | `FS` (filesystem) or `S3` | `FS` |
| `VERSION` | CAMT version (`52` or `53`) | Required |
| `IN` | Input path or S3 bucket name | Required |
| `OUT` | Output path or S3 bucket name | Required |
| `ARCHIVE` | Archive path for processed files | `/tmp` |
| `ERROR` | Error path for failed files | `/tmp` |
| `EP` | S3 endpoint URL | AWS default |
| `AK` | S3 access key | — |
| `SK` | S3 secret key | — |

## Troubleshooting

### "CAMT namespace version not found"

The input XML does not contain a recognized CAMT namespace. Check that:
- The file is valid XML
- The `xmlns` attribute matches `urn:iso:std:iso:20022:tech:xsd:camt.0XX...`
- The `-v` flag matches the file type (52 or 53)

### "Invalid line length: expected 128, got N"

A record builder produced a line that is not 128 characters wide. This usually means:
- A field value is longer than the CODA field allows (the value is truncated to fit)
- A required field is missing in the source CAMT file, leaving a field empty

Run `camt2coda validate statement.xml` first to check for missing required fields.

### "BIC not found"

For CAMT 053, a BIC is required. Check that the file contains `Acct/Svcr/FinInstnId/BIC` or `Acct/Ownr/Id/OrgId/AnyBIC`.

### "Balances are inconsistent"

The opening balance + sum of movements does not equal the closing balance. This is usually a data quality issue in the source CAMT file and is reported as a pre-flight warning, not a hard error.

### S3 connection errors

- Confirm `EP` (endpoint), `AK` (access key), and `SK` (secret key) are set correctly
- For MinIO, make sure the MinIO service is running: `docker compose up minio`
- Check that the input and output buckets exist in MinIO

### Node version

The converter requires **Node 22+**. Check your version:

```bash
node --version
```

If you are on an older version, use the Docker image which bundles the correct runtime.
