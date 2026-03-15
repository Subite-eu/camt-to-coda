# User Guide

## Installation

### Docker (recommended)

```bash
docker pull ghcr.io/subite-eu/misc-camt-to-coda:main
```

### From Source

Requires JDK 23+ and Maven.

```bash
cd java/BankFileConverter
mvn clean package -DskipTests
```

The distribution ZIP is at `CamtToCoda/target/CamtToCoda-1.0.0.zip`.

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
- Which XSLT would be used
- Whether validation passes
- How many output files would be created
- Record counts per file

### Validation Only

Check a CAMT file without converting:

```bash
camt2coda validate statement.xml
```

Checks:
- XML well-formedness
- XSD schema compliance (if schema available)
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

### Anonymization

Replace sensitive data for safe sharing and testing:

```bash
# Anonymize with default config
camt2coda anonymize -i private/real-data/ -o examples/sanitized/

# Anonymize with custom config
camt2coda anonymize -i private/ -o examples/ --config my-config.yaml

# Preview without writing
camt2coda anonymize -i private/ -o examples/ --dry-run
```

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

### Docker Compose

```bash
cd java/BankFileConverter
docker compose up java-run
```

Environment variables: `MODE`, `VERSION`, `IN`, `OUT`, `ARCHIVE`, `ERROR`, `EP`, `AK`, `SK`.

## Troubleshooting

### "CAMT Namespace version not found"

The input XML doesn't contain a recognized CAMT namespace. Check that:
- The file is valid XML
- The `xmlns` attribute matches `urn:iso:std:iso:20022:tech:xsd:camt.0XX...`
- The `-v` flag matches the file type (52 or 53)

### "Invalid line length"

The XSLT produced a CODA line that isn't 128 characters. This usually indicates:
- A field value that's longer than expected (truncation may be needed)
- A missing field producing empty output

### "BIC not found"

For CAMT 053, a BIC is required. Check that the file contains `Acct/Svcr/FinInstnId/BIC` or `Acct/Ownr/Id/OrgId/AnyBIC`.

### "Balances are inconsistent"

The opening balance + sum of movements doesn't equal the closing balance. This is usually a data issue in the source CAMT file.
