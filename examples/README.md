# Public original-source examples

See the [documentation index](../docs/README.md) for current commands, supported formats and API behavior.

These files are synthetic, independently authored source documents. Neither the CAMT nor the CODA originals were produced by camt2coda. They contain invented identities and references, and are safe to commit and share. They are conformance examples, not evidence that a bank emitted these documents.

The separate [bank-published corpus](bank-published/README.md) records 12 official CAMT downloads from ING, ABN AMRO and Nordea with provenance, pinned hashes and independent compatibility tests. Those twelve publisher originals remain outside version control and deployed artifacts. No complete bank-published CODA original has been verified; do not confuse the synthetic CODA fixtures below with bank-issued reports.

The broader [worldwide bank and country reference catalog](bank-catalog/README.md) inventories 57 bank/brand entries, 57 authority references and 104 separate bank-published CAMT XML originals. Geography folders group banks and national/regional references. Twenty-two Bundesbank XML originals are committed unchanged with attribution; other bank originals are external with pinned acquisition. This does not certify converter compatibility with every linked format.

The synthetic library contains **104 originals: 86 valid and 18 intentionally invalid**. `manifest.json` records each original's format, expected validity, specification version, covered features, and literal expected statement values. Tests read the committed files directly. `author.py` is a separate standard-library authoring utility following the ISO XSDs and CODA 2.6 Annexe I positions; it never imports or invokes the converter. `npm run examples:check` checks that the committed bytes match that independent definition without rewriting them. `catalog.json` contains browser metadata without test expectations; the searchable browser library loads these same originals on demand.

Business scenarios have original files in both `camt/` and `coda/`: salary payments, card purchases, direct-debit bills and collections, instant payments, USD and GBP international transfers, interest and fees, supplier invoices, customer refunds, accented names and escaped text, a 45-movement month, returned payments, and multiple accounts in different currencies. Search by scenario, currency or CAMT version in the browser and filter by source format. Invalid examples are hidden by default and can be enabled explicitly.

The library covers every supported CAMT 052/053 version from 02 through 13, prefixed and single-quoted namespaces, modern party wrappers, DateTime choices, empty and multiple statements, three-decimal non-EUR currency, debit and zero movements, other account identifiers, structured OGM, repeated transaction details, long communications and continuation boundaries, return/reversal/purpose fields, CODA records 2.2/2.3/3.1/3.2/3.3/4, CRLF, and deliberately malformed inputs. Invalid examples are isolated under `invalid/` and must be rejected.

Run `npm run test:examples` after installing `xmllint` (`libxml2-utils` on Ubuntu). Every valid original CAMT file and generated reverse XML is validated against the checked-in authoritative XSD. Both original formats are checked against the manifest and round-tripped through the other format. Known losses are documented in the [conversion limitations](../docs/conversion-limitations.md); a round trip does not imply all source metadata survives.

For a quick CLI test:

```sh
npm run build
node dist/cli.js convert -i examples/camt/camt.053.001.08.xml -o /tmp/coda-example
node dist/cli.js reverse -i examples/coda/coda-basic-eur.cod -o /tmp/camt-example
```

Do not use these synthetic documents or anonymized exports for bank import. Add an independently authored original and literal expectations when adding a new mapping or regression, and validate its source schema before using it as a positive example.
