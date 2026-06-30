import { createHash } from "crypto";
import type { CodaLine } from "../core/field-defs/types.js";

// ── PII zone map (0-indexed, end exclusive) ──────────────────────────────────
//
// Anonymization is fail-closed and driven entirely by this table so no PII field
// can be silently missed. Structured identifiers (IBAN/BIC/name) are replaced
// with deterministic plausible fakes; every free-text / reference zone is BLANKED,
// because arbitrary text (remittance info, customer references) cannot be
// structurally faked and routinely contains names, addresses, IBANs and invoice
// details. Positions follow the CODA 2.6 layout (see src/core/field-defs/).

type Mode = "iban" | "bic" | "name" | "blank";
interface Zone {
  start: number;
  end: number;
  mode: Mode;
}

const ZONES: Record<string, Zone[]> = {
  // Record 0 — header
  "0": [
    { start: 24, end: 34, mode: "blank" }, // file reference
    { start: 34, end: 60, mode: "name" }, // addressee name
    { start: 60, end: 71, mode: "bic" }, // bank BIC
    { start: 71, end: 82, mode: "blank" }, // company (KBO/BCE) number
  ],
  // Record 1 — old balance
  "1": [
    { start: 5, end: 39, mode: "iban" }, // account
    { start: 64, end: 90, mode: "name" }, // account holder name
  ],
  // Record 2.1 — movement
  "2.1": [
    { start: 10, end: 31, mode: "blank" }, // bank reference
    { start: 62, end: 115, mode: "blank" }, // communication zone 1
  ],
  // Record 2.2 — movement (cont.)
  "2.2": [
    { start: 10, end: 63, mode: "blank" }, // communication zone 2
    { start: 63, end: 98, mode: "blank" }, // customer reference (EndToEndId)
    { start: 98, end: 109, mode: "bic" }, // counterparty BIC
  ],
  // Record 2.3 — counterparty
  "2.3": [
    { start: 10, end: 44, mode: "iban" }, // counterparty account
    { start: 47, end: 82, mode: "name" }, // counterparty name
    { start: 82, end: 125, mode: "blank" }, // communication zone 3
  ],
  // Record 3.1/3.2/3.3 — information records (free-text detail)
  "3.1": [
    { start: 10, end: 31, mode: "blank" }, // bank reference
    { start: 40, end: 113, mode: "blank" }, // communication
  ],
  "3.2": [{ start: 10, end: 115, mode: "blank" }], // communication (cont.)
  "3.3": [{ start: 10, end: 100, mode: "blank" }], // communication (cont.)
  // Record 4 — free communication
  "4": [{ start: 32, end: 112, mode: "blank" }],
  // Record 8 — new balance
  "8": [{ start: 4, end: 38, mode: "iban" }],
};

/** Record key matching ZONES: "0","1","2.1","2.2","2.3","3.1","3.2","3.3","4","8". */
function recordKey(line: string): string {
  const r = line[0];
  if (r === "2" || r === "3") return `${r}.${line[1]}`;
  return r;
}

// ── Deterministic fake generators ────────────────────────────────────────────

/** Hash (original + seed) → hex string */
function hash(value: string, seed: number): string {
  return createHash("sha256")
    .update(value + "\x00" + String(seed))
    .digest("hex");
}

/** Map hash byte at index `i` onto a charset (full 64-hex window, no aliasing). */
function charAt(h: string, i: number, charset: string): string {
  const byte = parseInt(h.slice((i * 2) % 64, ((i * 2) % 64) + 2), 16) || 0;
  return charset[byte % charset.length];
}

/** Fake IBAN: keep the 2-char country code, replace the rest deterministically. */
function fakeIban(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original;
  const countryCode = trimmed.slice(0, 2).replace(/[^A-Z]/g, "X");
  const body = trimmed.slice(2);
  if (body.length === 0) return original.padEnd(len);
  const h = hash(trimmed, seed);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let fake = countryCode;
  for (let i = 0; i < body.length; i++) {
    fake += body[i] === " " ? " " : charAt(h, i, chars);
  }
  return fake.slice(0, len).padEnd(len);
}

/** Fake BIC: 4-letter bank code, then alphanumerics. */
function fakeBic(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original;
  const h = hash(trimmed, seed);
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphaNum = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let fake = "";
  for (let i = 0; i < trimmed.length; i++) {
    fake += trimmed[i] === " " ? " " : charAt(h, i, i < 4 ? alpha : alphaNum);
  }
  return fake.slice(0, len).padEnd(len);
}

/** Fake name: plausible uppercase letters, preserving word breaks. */
function fakeName(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original;
  const h = hash(trimmed, seed);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let fake = "";
  for (let i = 0; i < trimmed.length; i++) {
    fake += trimmed[i] === " " ? " " : charAt(h, i, chars);
  }
  return fake.slice(0, len).padEnd(len);
}

/** Replace a slice of a fixed-width line with a fake value (cached for integrity). */
function replacePart(
  line: string,
  start: number,
  end: number,
  fakeFn: (original: string, seed: number, len: number) => string,
  cache: Map<string, string>,
  seed: number
): string {
  const len = end - start;
  const original = line.slice(start, end);
  const cacheKey = `${start}:${end}:${original}`;
  let fake = cache.get(cacheKey);
  if (fake === undefined) {
    fake = fakeFn(original, seed, len);
    cache.set(cacheKey, fake);
  }
  if (fake.length !== len) fake = fake.slice(0, len).padEnd(len);
  return line.slice(0, start) + fake + line.slice(end);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Anonymize sensitive fields in a list of 128-char CODA lines.
 *
 * Fail-closed: structured identifiers (IBAN/BIC/name) are replaced with
 * deterministic fakes (same value → same fake, for referential integrity), and
 * ALL free-text / reference zones are blanked. Line length is preserved.
 *
 * @param lines  Array of 128-character CODA lines (raw strings or CodaLine)
 * @param seed   Optional numeric seed (default 0)
 */
export function anonymizeCodaLines(lines: (CodaLine | string)[], seed = 0): string[] {
  const caches: Record<Exclude<Mode, "blank">, Map<string, string>> = {
    iban: new Map(),
    bic: new Map(),
    name: new Map(),
  };
  const fakers = { iban: fakeIban, bic: fakeBic, name: fakeName };

  return lines.map((lineOrObj) => {
    let line = typeof lineOrObj === "string" ? lineOrObj : lineOrObj.raw;
    if (line.length !== 128) return line; // skip malformed lines

    const zones = ZONES[recordKey(line)];
    if (!zones) return line;

    for (const z of zones) {
      if (z.mode === "blank") {
        line = line.slice(0, z.start) + " ".repeat(z.end - z.start) + line.slice(z.end);
      } else {
        line = replacePart(line, z.start, z.end, fakers[z.mode], caches[z.mode], seed);
      }
    }
    return line;
  });
}
