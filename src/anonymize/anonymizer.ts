import { createHash } from "crypto";
import type { CodaLine } from "../core/field-defs/types.js";

// ── Position map (0-indexed, end is exclusive) ───────────────────────────────
//
// Record 0  (line[0] === '0'):
//   pos 60-70  (len 11): BIC
//
// Record 1  (line[0] === '1'):
//   pos 5-38   (len 34): account (IBAN / other)
//   pos 64-89  (len 26): owner name
//
// Record 2.2 (line[0] === '2', line[1] === '2'):
//   pos 98-108 (len 11): counterpart BIC
//
// Record 2.3 (line[0] === '2', line[1] === '3'):
//   pos 10-43  (len 34): counterpart IBAN
//   pos 47-81  (len 35): counterpart name
//
// Record 8  (line[0] === '8'):
//   pos 4-37   (len 34): account (IBAN / other)

// ── Deterministic fake generators ────────────────────────────────────────────

/** Hash (original + seed) → hex string */
function hash(value: string, seed: number): string {
  return createHash("sha256")
    .update(value + "\x00" + String(seed))
    .digest("hex");
}

/**
 * Generate a fake IBAN of a given length deterministically.
 * Preserves the country code (first 2 chars) so the output still looks like an IBAN,
 * and uses uppercase alphanumerics for the remainder.
 */
function fakeIban(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original; // nothing to anonymize
  const countryCode = trimmed.slice(0, 2).replace(/[^A-Z]/g, "XX");
  const body = trimmed.slice(2);
  if (body.length === 0) return original.padEnd(len);

  const h = hash(trimmed, seed);
  // Build replacement: keep country code, replace the rest with alphanumeric from hash
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let fake = countryCode;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === " ") {
      fake += " ";
    } else {
      // use two hex chars (0-255) mapped to our charset (36 chars)
      const byte = parseInt(h.slice((i * 2) % 60, (i * 2) % 60 + 2), 16);
      fake += chars[byte % chars.length];
    }
  }
  return fake.slice(0, len).padEnd(len);
}

/**
 * Generate a fake BIC of a given length deterministically.
 * A BIC is 8 or 11 uppercase letters/digits; we preserve the structure.
 */
function fakeBic(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original;

  const h = hash(trimmed, seed);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphaNum = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  // BIC structure: 4-letter bank code + 2-letter country + 2 alphanumeric location + optional 3 branch
  let fake = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === " ") {
      fake += " ";
    } else {
      const byte = parseInt(h.slice((i * 2) % 60, (i * 2) % 60 + 2), 16);
      fake += i < 4 ? chars[byte % chars.length] : alphaNum[byte % alphaNum.length];
    }
  }
  return fake.slice(0, len).padEnd(len);
}

/**
 * Generate a fake name of a given length deterministically.
 * Replaces with a plausible-looking uppercase name.
 */
function fakeName(original: string, seed: number, len: number): string {
  const trimmed = original.trimEnd();
  if (trimmed.length === 0) return original;

  const h = hash(trimmed, seed);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
  let fake = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === " ") {
      // preserve word breaks for plausibility
      fake += " ";
    } else {
      const byte = parseInt(h.slice((i * 2) % 60, (i * 2) % 60 + 2), 16);
      fake += chars[byte % chars.length];
    }
  }
  return fake.slice(0, len).padEnd(len);
}

// ── Cache for referential integrity ─────────────────────────────────────────

/**
 * Replace a slice of a fixed-width line with a fake value.
 * start/end are 0-indexed; end is exclusive.
 */
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

  if (fake.length !== len) {
    // Safety: should never happen but guard against it
    fake = fake.slice(0, len).padEnd(len);
  }

  return line.slice(0, start) + fake + line.slice(end);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Anonymize sensitive fields in a list of 128-char CODA lines.
 *
 * Uses SHA-256 of (original value + seed) for deterministic fakes.
 * Same input always produces the same output (referential integrity):
 * the same IBAN / BIC / name in different records maps to the same fake value.
 *
 * @param lines  Array of 128-character CODA lines
 * @param seed   Optional numeric seed (default 0)
 * @returns      New array with sensitive fields replaced
 */
export function anonymizeCodaLines(lines: (CodaLine | string)[], seed = 0): string[] {
  // Per-call caches keyed by field content so the same value always maps to the same fake
  const ibanCache = new Map<string, string>();
  const bicCache = new Map<string, string>();
  const nameCache = new Map<string, string>();

  return lines.map((lineOrObj) => {
    let line = typeof lineOrObj === "string" ? lineOrObj : lineOrObj.raw;
    if (line.length !== 128) return line; // skip malformed lines

    const rec = line[0];
    const art = line[1];

    if (rec === "0") {
      // pos 60-70 (len 11): BIC
      line = replacePart(line, 60, 71, fakeBic, bicCache, seed);
    } else if (rec === "1") {
      // pos 5-38 (len 34): account
      line = replacePart(line, 5, 39, fakeIban, ibanCache, seed);
      // pos 64-89 (len 26): owner name
      line = replacePart(line, 64, 90, fakeName, nameCache, seed);
    } else if (rec === "2" && art === "2") {
      // pos 98-108 (len 11): counterpart BIC
      line = replacePart(line, 98, 109, fakeBic, bicCache, seed);
    } else if (rec === "2" && art === "3") {
      // pos 10-43 (len 34): counterpart IBAN
      line = replacePart(line, 10, 44, fakeIban, ibanCache, seed);
      // pos 47-81 (len 35): counterpart name
      line = replacePart(line, 47, 82, fakeName, nameCache, seed);
    } else if (rec === "8") {
      // pos 4-37 (len 34): account
      line = replacePart(line, 4, 38, fakeIban, ibanCache, seed);
    }

    return line;
  });
}
