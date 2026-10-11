# Bank-published compatibility corpus

User request: add vetted bank-published originals with provenance, comprehensive
tests, and merge after green CI.

## Evidence and scope

Official ING, ABN AMRO and Nordea pages link twelve downloadable CAMT examples.
Their site terms do not provide a general redistribution licence. Keep originals
in an ignored local/ephemeral CI cache, with reviewed URLs, original filenames,
SHA-256 hashes, retrieval date and independent literal expectations committed.
Never publish cached originals in browser bundles, Docker images or CI artifacts.
Bank-published examples are illustrative, not production exports or certification.

Research of KBC/CBC, Belfius, ING Belgium, BNP Paribas Fortis, Crelan and Argenta
did not locate a complete public bank-published CODA original. Bank-hosted
Febelfin specifications and BNP record excerpts do not meet that requirement.
Record this remaining acquisition gap explicitly; do not relabel synthetic or
third-party files. A complete bank-published original with suitable usage rights
is needed to close it.

## Implementation

1. Add an external corpus manifest and documentation, separate from the 104
   independently authored synthetic originals. Preserve source inconsistencies.
2. Add a bounded HTTPS downloader with pinned archive and member hashes,
   exact ZIP member selection, verified cache reuse and fail-closed errors.
3. Test provenance/import integrity offline; run opt-in required integration
   tests against fetched originals, independent XSDs, literal statement/detail
   values, CODA validation and twelve reverse XML versions.
4. Fix the observed CAMT052 ITBD balance selection defect with a failing
   independently authored regression; prefer booked balances over available ones.
5. Provide official bank download links in the sample UI, clearly separated
   from bundled synthetic examples; test the distinction and actual bank uploads.
6. Add a required CI bank-corpus job with no original-file artifact/cache upload,
   include it in deployment/release gates, and document acquisition failures.
7. Run relevant checks, obtain independent review, push PR and merge only after
   the exact reviewed head is green. Report remaining CODA acquisition gap.


## Expanded user scope: worldwide discovery and country references

The user requested broad bank examples grouped by geography, a browser catalog, and an inventory of official national/regional authorities worldwide. Research produced 57 bank/brand records and 57 authority records. Public XML, inline/PDF examples, specifications, portals, broken/unverified links and service evidence have distinct labels. Market scope follows actual documentation; payment migration does not imply corporate CAMT reporting.

Add a canonical metadata catalog and generated geography/bank indexes, with a required consistency check. A lazy browser catalog filters bank/authority, region, country and resource type, and preserves existing conversion state. Add responsive/accessibility/navigation tests. Pin 104 downloaded CAMT052/053 originals and independently extracted content counts; test all original hashes and expected XSD classifications. Permit only the 22 unchanged attributed Bundesbank files in Git under its §4.1 terms; retain the other82 in ignored/ephemeral caches without CI artifacts. Do not expand converter support to CAMT054, wrappers or malformed sources merely because references include them. Preserve the CODA acquisition gap.
