# Browser workflow remediation report

Scope: C02/U01–U08, browser adaptation and privacy. Shared checkout; no commits by web owner.

## Implemented

- Browser-safe deterministic SHA-256 replaces the unavailable Node crypto call. Forward privacy regenerates parsed field metadata from the exact anonymized bytes; preview and download use the same artifact. Every forward statement remains in `files[]`, with nonidentifying privacy filenames and ZIP download-all.
- Reverse privacy serializes an explicit allowlist of safe model fields to one multi-statement CAMT document. Synthetic Other account IDs replace account identifiers; parties, bank identifiers, references and free text are omitted. Amounts/dates/currency and detail amounts are retained. Scope and deterministic-linkability limitations appear beside export controls. Original source and original filename remain visible and are explicitly outside export anonymization scope.
- Structure-0 Belgian BBAN anonymization follows the new packed layout: only the 12 account characters are pseudonymized; packed currency, qualification and country are retained, and account extensions are blanked. Updated the old anonymizer test helper to declare its IBAN structure correctly.
- Vite module worker owns conversion and structural XML provenance indexing. Fresh worker per request, termination on cancellation/unmount/replacement, and generation checks prevent stale jobs from overwriting new input. Worker startup/failure has recovery; non-worker test environments have a cancellable deferred fallback.
- File upload/drop/paste detects direction; upload preserves original filename. File byte limits (5 MiB, actual UTF-8), read errors, empty input, cancellation, retry, format recovery and source preservation are handled. Direction controls are locked to loaded source identity.
- Summary is the initial review view: all-statement selection, opening/closing balances, movements, reconciliation difference, bounded 25-movement pagination. Expert inspection uses one CODA record at a time, search capped to 40 results, record jump, keyboard roving focus, contextual accessible names and selected state.
- XML inspection uses exact offsets of structurally scoped statement/entry/detail nodes, resolving balances by OPBD/CLBD and parties by debit/credit role. Both CODA and XML values can select mappings. Decoded values, raw spaces, transformation rules and direct/derived/defaulted/truncated/unavailable status are shown. Unsupported mappings are explicitly unavailable rather than global text matching. XML rendering is bounded to a 50,000-character initial excerpt or selected-node window; complete artifacts remain downloadable.
- Desktop panes and inspector have independent bounded scrolling. Mobile source/result tabs have keyboard arrows and labelled panels; selected fields use a persistent nonmodal bottom sheet. Page/document scrolling reserve the sheet footprint, so selected and final fields can scroll above it. Escape dismisses details. Live announcements, semantic headings, skip link, visible focus and reduced-motion styles are present.
- Invalid reverse conversion produces no artifact. Downloads require runtime-valid source/output contracts and review of all artifact warnings. All warnings are listed with statement context; selection changes reset acknowledgement. Clipboard reports success only after awaited write and offers selectable fallback on denial/unavailability.
- Existing theme tokens are preserved. Color interpolation was removed from selected buttons and badges to avoid transient theme/selection contrast failures.

## Verification

Red regressions observed before fixes: browser privacy createHash throw, reverse account leak, first-statement-only forward result; inaccessible numeric field names/selected semantics; denied clipboard unhandled rejection/no fallback; invalid reverse generated an empty artifact; XML nodes missing keyboard entry; packed BBAN anonymization changed EUR to RJG.

Final verification before handoff:

- `npx vitest run --project web`: 15 files, 49 tests passed.
- `npx vitest run --project node test/unit/anonymizer.test.ts`: 20 tests passed.
- `npm run typecheck`: passed.
- `npm run build:web`: passed; worker emitted as a separate production asset (~164 kB), main JS ~480 kB (~148 kB gzip).
- Real production Chromium at 375×812: selecting the movement and then clicking its amount with the mobile sheet open succeeds; body width stays 375.
- Axe against production mobile light selected-field view and desktop immediate dark-theme selected-field view: zero violations after fixes. Earlier findings (scope paragraph outside landmark and interpolated badge text contrast) were corrected and rechecked.
- Manual screenshots `/private/tmp/camt-mobile.png`, `/private/tmp/camt-desktop.png` inspected. Local Chromium requires sandbox escalation on macOS; authorized escalation succeeded. Preview server remains on 127.0.0.1:4173 (exec session 13201) for root's cross-browser E2E verification.

## Integration notes and honest limits

- Additive UI adapter contracts: `files: Artifact[]`, `statements: CamtStatement[]`, `fieldIndexes: FieldEntry[][]`, `version`, `anonymized`; legacy first-artifact fields remain. Uses core `statementsToXml(statements, version?)` and reverse `statements[]`.
- Root installed fflate; root owns production Playwright/CI/public schema tests and final integration coverage.
- Provenance is resolved from exact output/source XML structure in the web adapter rather than persisted inside the core pivot. Fields without a reliable counterpart remain unavailable/defaulted; bank-specific transaction-code transforms are not claimed as direct copies. Repeated remittance nodes now use decoded character offsets and exact contributing XML ranges per CODA communication zone, including entity-aware offsets and selectable later continuation fragments.
- Privacy exports are demonstration/review artifacts. CODA account pseudonyms are not promised as bank-valid IBANs. Amounts, dates and transaction patterns intentionally remain identifiable. Source panes and original input filenames remain original, as disclosed.
- Dedicated physical-device and screen-reader certification, a full measured 5-MiB performance budget, and Firefox runtime verification are outside this owner's local verification. Root owns cross-browser production tests and final review.

Fresh-review follow-up: reproduced Record 3.3 long-remittance mapping to first Ustrd incorrectly. Added public long-remittance fixture regression and UI source-selection regression; now Record 3.3 maps to the second Ustrd contributing fragment, Record 3.2 exposes both contributing ranges, and the later D-fragment selects Record 3.3. Zone offsets are explicit (movement 0/53/106; information 0/73/178) and labelled derived.

Monetary-detail review follow-up: nonzero Record 2.1 detail numbers now resolve under their aggregate sequence instead of advancing account-entry index. Exact child TxDtls amount/direction/currency attribute and effective creditor/debtor role are retained for monetary 2.x and associated 3.x records. Public monetary CODA regression covers both reverse and forward mapping, signed-detail creditor mapping, foreign-detail currency and Summary counting/reconciliation (one aggregate movement). Inspector identifies the monetary breakdown context. Browser ingest copy explicitly states CODA capacity of 9,999 movements/details per statement. Final rerun: 15 frontend files / 49 tests, app typecheck and production build passed.

CAMT v02 follow-up: transaction monetary-node detection and exact amount/currency provenance also accept AmtDtls/TxAmt/Amt; direction correctly inherits from Ntry when v02 has no independent detail direction. Generated-v02 regression reproduced missing mapping before fix; all 49 frontend tests, typecheck and production build pass afterward. No other UI changes in this follow-up.
