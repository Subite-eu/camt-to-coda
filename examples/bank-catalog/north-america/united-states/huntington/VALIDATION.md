# Huntington inline examples: provenance and validation

Checked 2026-10-11. Publisher: Huntington National Bank, United States.

These are **bank-authored illustrations from public developer documentation**, not customer statements or certified production exports. The library assigns the XML filenames. No open redistribution licence was established: the application retrieves publisher content on request or extracts it locally from a saved publisher page; original content is not committed or bundled.

| Inventory ID | Official source container | Publisher update timestamp | Unchanged XML range (zero-based UTF-8 bytes) | Source schema |
| --- | --- | --- | --- | --- |
| huntington-052 | [CAMT052 Markdown](https://developer.huntington.com/enterprisepayments/docs/camt052.md) | 2026-08-10T16:55:01.000Z | offset 25219, length 3979 | camt.052.001.08: invalid as published |
| huntington-053 | [CAMT053 Markdown](https://developer.huntington.com/enterprisepayments/docs/camt053.md) | 2026-08-10T16:58:56.000Z | offset 9121, length 2514 | camt.053.001.02: valid |

Each range begins at the XML declaration and ends after the closing Document tag's final LF, before the Markdown fence. No whitespace, namespaces, line endings or values are repaired. Complete container hashes and sizes are verified before extraction; extracted XML has independent hashes and sizes. All pins and source structure counts are in the [canonical source inventory](../../../source-inventory.json). The [HTML field guides](https://developer.huntington.com/enterprisepayments/docs/camt052) and [CAMT053 guide](https://developer.huntington.com/enterprisepayments/docs/camt053) provide the surrounding bank documentation.

## Observed outcomes

- **CAMT052:** one report, two entries and two transaction details; USD credit 1500 and debit 750. The v8 XSD rejects the text-only Sts, reference ordering and direct party Nm elements. No opening balance is supplied. CODA validation rejects the missing opening-balance date, and the UI disables the converted CODA download. The XML remains available unchanged for negative testing.
- **CAMT053:** one statement, one entry and one transaction detail; USD opening balance 50000, credit 2500 and closing balance 52500. The original passes its v2 XSD. Forward conversion yields validated 128-character CODA records; reverse conversion retains the tested monetary values and passes the default v8 XSD. The US-prefixed IBAN values are illustrative placeholders: schema validity does not establish real account validity.

`npm run test:bank:catalog` requires acquisition, pin verification, independent structure counts, published XSD outcomes and literal Huntington conversion checks. `npm run test:examples:downloads -- --project=chromium` freshly acquires both containers and checks actual browser XML downloads, local saved-page extraction without requests, changed-page rejection and conversion/download behavior. Ordinary browser tests cover provenance labels, bank/country discovery, blocked-fetch fallback, accessibility and responsive layout across the CI browser matrix.

## Browser download fallback

The publisher did not provide browser CORS permission when checked. If **Save original file** is blocked, open **Publisher Markdown source**, save that exact page as a `.md` file and choose **Extract saved publisher page**. Extraction stays in the browser. Modified, reformatted or newly updated publisher pages are rejected until the reviewed inventory pins are updated; a changed page is never silently accepted.
