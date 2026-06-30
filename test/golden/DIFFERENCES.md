# Golden Cross-Validation

The golden suite lives in `test/integration/golden.test.ts`. It validates the
converter against a **real Belgian CAMT/CODA pair** for the same statement,
kept in `specifications/private-examples/` (gitignored — real account data).
The tests `describe.skipIf` themselves when that pair is absent, so CI and other
checkouts stay green.

## What it checks
- **Forward** (real CAMT → CODA): generated balances, movement amounts and
  signs match the real `.cod`; every line is 128 chars; the file reconciles.
- **Reverse** (real CODA → model): balances and movements are preserved.
- **Round-trip** (CODA → CAMT → CODA): money is preserved and the ISO↔CODA
  transaction-code mapping holds (`00150000` ↔ `PMNT/RCDT/ESCT`,
  `00101000` ↔ `PMNT/ICDT/ESCT`).

## Documented differences / limitations observed on the real pair
- **No `BkTxCd` in the source CAMT.** The real bank CAMT carries no transaction
  code element; the bank derived the CODA codes (`00150000`/`00101000`) from its
  own systems. The converter therefore leaves the CODA transaction code blank on
  the forward path (see `docs/conversion-limitations.md`). The code mapping is
  still validated via the round-trip test.
- Sequence number, creation timestamp and references differ as documented in
  `docs/conversion-limitations.md`.
