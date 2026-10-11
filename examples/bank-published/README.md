# Bank-published compatibility examples

This separate corpus records **12 original CAMT examples published by three
banks**, covering **61 movements and 84 monetary transaction details**. These
are official illustrative examples, not customer production exports, independent
bank certification, or proof of every bank's reporting behavior. The other
[104 bundled originals](../README.md) remain independently authored synthetic
CAMT and CODA fixtures.

## Provenance and acquisition

All links were followed from the banks' own documentation pages and retrieved on
**2026-10-11**. [manifest.json](manifest.json) records each publisher, landing
page, terms URL, original filename, exact ZIP member (when applicable), original
and download SHA-256 checksums, byte counts, schema and known publisher issues.
Nordea's landing links redirect from `/media/…`; both that link and the final
bank-hosted download URL are recorded. Archives and XML are pinned separately.
No whitespace, line endings, names, dates or amounts are repaired or rewritten.
Unzipping the selected member and giving the local cache file a stable `.xml`
filename are the only acquisition transformations. ABN's original `.txt` and
Nordea's `.sendfile` members contain XML and are preserved byte for byte.

| Publisher and primary documentation | Originals | Reporting variety |
|---|---|---|
| [ING account-reporting examples](https://www.ingwb.com/en/payments-and-collections/account-reporting-format-specifications) | CAMT052 v02; CAMT053 v08 | EUR intraday debit balances and interim booked closing balance; daily debit/credit transfers, modern party wrappers and structured references |
| [ABN AMRO batch-reporting examples](https://www.abnamro.nl/nl/zakelijk/producten/betalen/sepa/rapportages/comprimeerinstellingen.html) | Credit-transfer and direct-debit batch ZIPs, CAMT053 v02 | EUR aggregate movements with two separately valued transactions, counterparty names and end-to-end references |
| [Nordea Corporate Access examples](https://www.nordea.com/en/en/our-services/cash-management/corporate-access-documents) | Standard and extended CAMT053 v02 for Denmark, Finland, Norway and Sweden | DKK/EUR/NOK/SEK, IBAN and other account identifiers, bankgiro, cross-border transfers, multi-transaction batches, long/free and creditor-reference communications |

`catalog.json` contains only reviewed download links and descriptions for the
browser; it contains no original XML. The UI links directly to the publishers,
explains ZIP extraction and keeps these sources separate from synthetic samples.

## Usage terms

Public download availability is **not** a redistribution licence. The repository's
MIT licence does not apply to bank documents. Reviewed terms:

- [ING legal statement](https://www.ingwb.com/en/service/compliance/privacy-and-legal-statements/legal): restricts copying and distribution of site content; no general fixture redistribution permission established.
- [ABN AMRO disclaimer](https://www.abnamro.nl/nl/zakelijk/over-abnamro/disclaimer.html): permits private use with attribution; commercial use requires prior permission.
- [Nordea general terms](https://www.nordea.com/en/general-terms): reserves reproduction rights with a personal storage/printing exception.

For this reason **originals are not committed, bundled, mirrored or uploaded as
CI artifacts**. Local compatibility checks download directly from the banks into
ignored `private-examples/bank-published/`; CI uses an ephemeral runner directory
and removes downloads/results. This separation does not grant any additional
usage rights: review the publisher's terms for your intended use. Do not publish
the cache, derived statement files, screenshots or reports containing originals.

## Reproducible tests

Install Node/npm dependencies and `xmllint`, then run:

```sh
npm run test:bank
npm run build:web
npx playwright install --with-deps chromium
npm run test:bank:e2e -- --project=chromium --workers=2
```

`npm run bank:fetch` only fetches and verifies the corpus. `BANK_CORPUS_DIR` may
select an alternative local/ephemeral directory. Verified cached originals can
be used offline. Missing files require a successful download; changed bytes,
wrong ZIP members, oversized responses and HTTP errors fail closed. There is no
fallback to synthetic data or a skip on acquisition failure. If a bank changes
a file, review the new primary source and independent expectations before
updating either hash; never automatically accept replacement bytes. A corrupt
cache fails until deliberately removed and fetched again.

The **181 Node checks** cover provenance and source integrity, source XSDs,
literal account/currency/balance/entry/detail amounts, directions, dates,
counterparties and end-to-end IDs, CODA widths and validation, balance warnings,
and all twelve CAMT053 reverse targets (v02–13). Expected facts were extracted
independently from original XML using Python's standard-library ElementTree and
Decimal and reviewed, without invoking the converter. Round-trip checks permit
documented CODA date/name limits and retain monetary details separately from
amountless batch-count summaries. The browser suite performs twelve real file
uploads/downloads and checks the downloaded CODA against literal expectations,
plus one sample-library check. No bank originals need to be publicly hosted by
the app for these tests.

Ordinary `npm test` checks provenance and downloader integrity offline and
explicitly skips the 180 acquisition-dependent Node cases. The commands above
set `BANK_CORPUS_REQUIRED=1`; missing originals then fail. The dedicated required
GitHub Actions job fetches originals, runs Node and Chromium checks, publishes no
original-file artifacts and gates main image publication and tagged releases.

## Publisher inconsistencies and conversion limits

- Nordea **extended Denmark** contains stray hyphen text between XML elements.
  Its unchanged original is well-formed XML but fails the ISO XSD. Tests require
  this specific failure; runtime parsing is not full XSD validation.
- Nordea **extended Finland** has closing balance **491.49 EUR**, while opening
  **500.50 EUR** plus its listed signed movements gives **491.99 EUR**. Tests
  preserve all original values and require a balance-mismatch warning.
- ABN's batches and Nordea extended batches retain batch counts as amountless
  summaries alongside monetary details. CAMT053 v03–06 require amounts on all
  transaction details and cannot encode that combination: tests require explicit
  rejection rather than invented amounts. v02 and v07–13 retain the money and
  summaries. Other known format losses are in the
  [conversion limitations](../../docs/conversion-limitations.md).

The ING page also links a CAMT053 v08 file under its CAMT052 v08 heading; we use
the XML's actual namespace, not the misleading link placement. PDF illustrations
and incomplete snippets were not converted into invented full statements.

## Remaining CODA acquisition gap

**There are currently zero complete bank-published CODA originals in this
corpus.** The vetted search covered KBC/CBC, Belfius, ING Belgium, BNP Paribas
Fortis, Crelan and Argenta. These primary sources are useful references but do
not satisfy the complete-original requirement:

| Official source | Evidence and decision |
|---|---|
| [KBC CODA page](https://www.kbc.be/ondernemen/nl/product/betalen-en-betaald-worden/rekeninginformatie/coda.html) → [bank-hosted manual](https://multimediafiles.kbcgroup.eu/ng/published/KBC/PDF/RUN/BETVERKEER/Coda_N.pdf) | Febelfin CODA 2.6 specification, February 2018, 73 pages; no complete statement. Bank hosting does not make a standards-body manual a bank-issued fixture. SHA-256 `078c5c87f3d89abc6db7ba42a8ce8a11ee1ec0cbdf5a3b1a76ce28eb3183b1c5`. |
| [BNP Paribas Fortis reference-change PDF](https://entreprises.bnpparibasfortis.be/docs/default-source/newsannex/cm_e-banking_fiche_ext_67f-e_en.pdf) | March 2018, one page, two before/after record 2.1 snippets; no header, balances or trailer. PDF wrapping prevents treating extracted text as original fixed-width bytes. SHA-256 `210d3a36a7389bc046856bbfb7049940974da4cb1c42ad424dfb9289931e3b45`. |
| [Belfius CODA/XML reporting](https://www.belfius.be/professional/fr/banque-par-vous-meme/services/reporting-coda/index.aspx) | Reporting options and customer download channels; no complete public original verified. |
| [Crelan instructions](https://www.crelan.be/nl/ondernemers/artikel/mycrelan-pro-gebruiksaanwijzing), [Argenta CODA](https://www.argenta.be/fr/entrepreneurs/payer/coda-caro.html) | Customer-file access instructions; no complete public original verified. |

[KBC's terms](https://www.kbc.be/particulieren/nl/juridische-info/juridische-informatie.html)
and [Febelfin's disclaimer](https://febelfin.be/nl/disclaimer) also restrict
third-party reproduction. Neither downloaded reference establishes a reusable
bank fixture licence. Third-party GitHub/Odoo/Tryton files, generator examples,
and files labelled “ING” by a different publisher are not substituted here.

Closing this remaining gap requires a complete original published by a bank
with appropriate testing rights, or a bank-approved sample supplied with written
permission and traceable provenance. Do not generate missing records and call
the result a bank original. The existing synthetic CODA suite still exercises
reverse conversion comprehensively; it is not evidence of bank-issued sourcing.


## Broader discovery catalog

The separate [worldwide bank and country reference catalog](../bank-catalog/README.md) now inventories 57 bank/brand entries, 57 authorities and 104 byte-verified bank-published CAMT052/053 files, including these twelve. It distinguishes national customer-reporting guides, settlement-account profiles, payment-only ISO adoption and regional/global references. Twenty-two unchanged Bundesbank originals are committed under its attribution-based terms; the other 82 files remain external. The larger inventory tests source integrity, independently counted content and XSD outcomes; these twelve additionally carry the semantic conversion/browser checks above. Inventory membership does not establish converter compatibility or commercial-bank retail availability.
