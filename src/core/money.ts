// 3-decimal fixed-point money.
//
// CODA 2.6 Annexe I specifies the amount field as "12 pos + 3 decimals"
// (Record 1 pos 44-58, Record 2.1 pos 33-47, Record 8 new balance, Record 9
// totals). The scale is therefore THOUSANDTHS, not cents. Representing amounts
// as integer thousandths makes summation exact, so Record 9 totals and the
// balance reconciliation match to the last CODA digit instead of drifting on
// IEEE-754 float accumulation.

/** Convert a decimal amount to integer thousandths (round half-up at 3 dp). */
export function toMillis(amount: number): number {
  return Math.round(amount * 1000);
}

/** Convert integer thousandths back to a decimal amount. */
export function fromMillis(millis: number): number {
  return millis / 1000;
}

/** Add two thousandths values (both already integers — exact). */
export function addMillis(a: number, b: number): number {
  return a + b;
}

/** Format integer thousandths as 12 integer + 3 decimal digits (15 chars, unsigned). */
export function formatMillis(millis: number): string {
  const digits = Math.abs(millis).toString().padStart(4, "0");
  const intPart = digits.slice(0, -3).padStart(12, "0");
  const decPart = digits.slice(-3);
  return intPart + decPart;
}
