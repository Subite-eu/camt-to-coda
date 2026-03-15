// ── Formatting helpers ──────────────────────────────────────────────────

export function padRight(s: string, len: number, char = " "): string {
  return s.slice(0, len).padEnd(len, char);
}

export function padLeft(s: string, len: number, char = " "): string {
  return s.slice(0, len).padStart(len, char);
}

export function formatBalance(amount: number): string {
  const abs = Math.abs(amount);
  const [integer, decimals = "0"] = abs.toFixed(3).split(".");
  return padLeft(integer, 12, "0") + padRight(decimals, 3, "0");
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "000000";
  const d = dateStr.slice(8, 10);
  const m = dateStr.slice(5, 7);
  const y = dateStr.slice(2, 4);
  return d + m + y;
}

/**
 * CODA sign code: 0 = credit (positive/zero), 1 = debit (negative).
 * NOTE: The original PoC had this inverted (>= 0 → "1"). Fixed here to
 * match the CODA 2.6 spec and the Java XSLT implementation.
 */
export function signCode(amount: number): string {
  return amount >= 0 ? "0" : "1";
}

export function movementSign(creditDebit: "CRDT" | "DBIT"): string {
  return creditDebit === "CRDT" ? "0" : "1";
}

export function accountStructure(account: string): string {
  if (account.startsWith("BE")) return "2";
  if (/^[A-Z]{2}/.test(account)) return "3";
  return "0";
}

export function signedAmount(amount: number, creditDebit: "CRDT" | "DBIT"): number {
  return creditDebit === "CRDT" ? amount : -amount;
}
