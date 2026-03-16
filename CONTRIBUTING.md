# Contributing

## Development Setup

### Prerequisites

- **Node 22+** — Required for local development
- **npm** — Package manager (comes with Node)
- **Docker** — For running integration tests with MinIO (S3-compatible storage)

### Getting Started

```bash
git clone https://github.com/Subite-eu/camt-to-coda.git
cd camt-to-coda
npm install
```

### Running Tests

```bash
npm test                  # Run all tests once (vitest run)
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run typecheck         # TypeScript type-check only
```

### Building

```bash
npm run build             # Compile TypeScript to dist/
npm run dev               # Run CLI directly with tsx (no build step)
```

### Running Locally

```bash
# Using tsx (no build needed — good for development)
npm run dev -- convert -v 53 -i example-files/CAMT/ -o /tmp/out/

# After building
node dist/cli.js convert -v 53 -i example-files/CAMT/ -o /tmp/out/
```

## Code Style

- TypeScript source files use 2-space indentation
- Follow existing naming conventions: `camelCase` for functions and variables, `PascalCase` for types and interfaces
- Pure functions preferred — avoid mutable state and side effects in the `core/` and `records/` modules
- Each CODA record builder lives in its own file (`src/core/records/record21.ts`, etc.)

## Testing

- Unit tests live alongside the source: `test/unit/`
- Integration tests: `test/integration/` — run the full pipeline against anonymized CAMT files
- Property-based tests: `test/property/` — use `fast-check` to verify invariants
- Golden files: `test/golden/` — expected `.cod` output for regression testing

### Adding Test Data

1. Place real CAMT files in `example-files/private/` (gitignored)
2. Anonymize them: `npm run dev -- convert -v 53 -i example-files/private/ -o example-files/CAMT/ --anonymize`
3. Commit the anonymized files in `example-files/CAMT/`
4. Update the corresponding golden files in `test/golden/`

## Project Structure

```
src/              TypeScript source
test/             Tests (unit, integration, property-based, golden)
example-files/    Anonymized CAMT example files
specifications/   XSD schemas and CODA spec PDF
docs/             Documentation
```

## Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Add or update tests for any changed behaviour
4. Run `npm test` — all tests must pass
5. Run `npm run typecheck` — no type errors
6. Open a PR against `main`
7. CI will run all tests automatically

### PR Checklist

- [ ] Tests added or updated
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if this is a user-visible change

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.
