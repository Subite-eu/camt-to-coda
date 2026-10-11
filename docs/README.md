# Documentation

These guides describe the current TypeScript implementation. Start with the [project README](../README.md) for a feature overview.

| Guide | Use it for |
|---|---|
| [User guide](user-guide.md) | Browser workflow, installation, all CLI commands, storage and troubleshooting |
| [HTTP API](http-api.md) | Server configuration, requests, response shapes, validation and privacy |
| [Format guide](format-guide.md) | Supported formats and CODA record layouts |
| [Mapping matrix](mapping-matrix.md) | Current field mappings and specification references |
| [Conversion limitations](conversion-limitations.md) | Losses, precision, version restrictions and privacy boundaries |
| [Architecture](architecture.md) | Modules, conversion pipeline and test strategy |
| [Original-source examples](../examples/README.md) | Independent CAMT and CODA fixtures and literal expectations |
| [Worldwide bank and country catalog](../examples/bank-catalog/README.md) | Official bank examples/specs and national/regional authorities, grouped by geography, with access and reporting coverage |
| [Bank-published corpus](../examples/bank-published/README.md) | Official CAMT downloads, provenance, usage terms, compatibility tests and remaining CODA acquisition gap |
| [Contributing](../CONTRIBUTING.md) | Development, regression data, local checks and GitHub Actions |
| [Releasing](releasing.md) | Versioning, publication gates and actual release outputs |
| [Changelog](../CHANGELOG.md) | Unreleased changes and historical releases |

## Dated evidence and historical plans

[Audit remediation](audits/2026-10-10-remediation.md) and [deployed verification](audits/2026-10-10-deployed-verification.md) record the commits and checks evaluated on their stated dates. Their counts and findings are snapshots, rather than live feature references.

Files under `superpowers/plans/` and `superpowers/specs/` preserve implementation plans, design decisions and past audits. They may describe defects since repaired or approaches since replaced. Historical changelog entries likewise describe their release, including the retired Java implementation. Use the guides above for current commands and behavior.
