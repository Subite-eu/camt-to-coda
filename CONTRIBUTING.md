# Contributing

## Development Setup

1. **JDK 23** — Required for local development. The Docker build handles this for CI.
2. **Maven** — Build tool
3. **Docker** — For running tests with MinIO (S3-compatible storage)

```bash
cd java/BankFileConverter
sh build.sh         # Full Docker build + tests
mvn test             # Run tests locally (requires JDK 23)
```

## Code Style

- Java source files use tabs for indentation
- XSLT files use tabs for indentation
- Follow existing naming conventions (camelCase for Java, hyphenated for XSLT files)

## Testing

- Unit tests: `src/test/java/eu/subite/`
- XSLT tests: `src/test/java/eu/subite/xslt/`
- Edge case tests: `src/test/resources/edge-cases/`
- Example CAMT files: `example-files/CAMT/`

### Adding Test Data

1. Place real CAMT files in `example-files/private/` (gitignored)
2. Run `camt2coda anonymize -i example-files/private/ -o example-files/CAMT/`
3. Commit the anonymized files

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `mvn test` (all tests must pass)
4. Open a PR against `main`
5. CI will run build + tests automatically

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.
