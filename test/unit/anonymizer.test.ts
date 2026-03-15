import { describe, it, expect } from "vitest";
import { anonymizeCodaLines } from "../../src/anonymize/anonymizer.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a 128-char CODA line with specific content at given positions */
function makeLine(base: string): string {
  if (base.length > 128) throw new Error("base too long: " + base.length);
  return base.padEnd(128, " ");
}

/** Build a Record 0 line (BIC at pos 60-70) */
function makeRecord0(bic: string): string {
  const line =
    "0" +           // 0:  record id
    "0000" +        // 1-4
    "010125" +      // 5-10: date
    "000" +         // 11-13: bank id
    "05" +          // 14-15: app code
    " " +           // 16:  dup indicator
    " ".repeat(7) + // 17-23: blanks
    " ".repeat(10) +// 24-33: file ref
    " ".repeat(26) +// 34-59: addressee
    bic.padEnd(11); // 60-70: BIC
  return line.padEnd(128, " ");
}

/** Build a Record 1 line (account at 5-38, name at 64-89) */
function makeRecord1(account: string, name: string): string {
  const line =
    "1" +                    // 0
    "0" +                    // 1: account structure
    "001" +                  // 2-4: sequence
    account.padEnd(34) +     // 5-38: account
    "EUR" +                  // 39-41: currency
    "0" +                    // 42: sign
    "0".repeat(15) +         // 43-57: balance
    "010125" +               // 58-63: date
    name.padEnd(26);         // 64-89: name
  return line.padEnd(128, " ");
}

/** Build a Record 2.2 line (BIC at pos 98-108) */
function makeRecord22(bic: string): string {
  const line =
    "22" +           // 0-1
    "0001" +         // 2-5: sequence
    "0000" +         // 6-9: detail
    " ".repeat(53) + // 10-62: comm
    " ".repeat(35) + // 63-97: cust ref
    bic.padEnd(11);  // 98-108: BIC
  return line.padEnd(128, " ");
}

/** Build a Record 2.3 line (IBAN at 10-43, name at 47-81) */
function makeRecord23(iban: string, name: string): string {
  const line =
    "23" +           // 0-1
    "0001" +         // 2-5: sequence
    "0000" +         // 6-9: detail
    iban.padEnd(34) +// 10-43: IBAN
    "EUR" +          // 44-46: currency
    name.padEnd(35); // 47-81: name
  return line.padEnd(128, " ");
}

/** Build a Record 8 line (account at 4-37) */
function makeRecord8(account: string): string {
  const line =
    "8" +                 // 0
    "001" +               // 1-3: sequence
    account.padEnd(34);  // 4-37: account
  return line.padEnd(128, " ");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("anonymizeCodaLines()", () => {
  it("returns same number of lines as input", () => {
    const lines = [
      makeRecord0("GEBABEBB   "),
      makeRecord1("BE68539007547034              ", "JOHN DOE                  "),
      makeRecord8("BE68539007547034              "),
    ];
    const result = anonymizeCodaLines(lines);
    expect(result).toHaveLength(lines.length);
  });

  it("preserves 128-char line length on all records", () => {
    const lines = [
      makeRecord0("GEBABEBB   "),
      makeRecord1("BE68539007547034              ", "JOHN DOE                  "),
      makeRecord22("GEBABEBB   "),
      makeRecord23("BE68539007547034              ", "COUNTERPART NAME           "),
      makeRecord8("BE68539007547034              "),
    ];
    const result = anonymizeCodaLines(lines);
    for (const line of result) {
      expect(line).toHaveLength(128);
    }
  });

  it("replaces BIC in Record 0 (pos 60-70)", () => {
    const bic = "GEBABEBB   ";
    const line = makeRecord0(bic);
    const [result] = anonymizeCodaLines([line]);
    const resultBic = result.slice(60, 71);
    expect(resultBic).not.toBe(bic);
    // rest of line outside BIC field should be unchanged
    expect(result.slice(0, 60)).toBe(line.slice(0, 60));
    expect(result.slice(71)).toBe(line.slice(71));
  });

  it("replaces account in Record 1 (pos 5-38)", () => {
    const account = "BE68539007547034              ";
    const line = makeRecord1(account, "JOHN DOE                  ");
    const [result] = anonymizeCodaLines([line]);
    const resultAcct = result.slice(5, 39);
    expect(resultAcct).not.toBe(account);
    expect(result).toHaveLength(128);
  });

  it("replaces owner name in Record 1 (pos 64-89)", () => {
    const name = "JOHN DOE                  ";
    const line = makeRecord1("BE68539007547034              ", name);
    const [result] = anonymizeCodaLines([line]);
    const resultName = result.slice(64, 90);
    expect(resultName).not.toBe(name);
    expect(result).toHaveLength(128);
  });

  it("replaces BIC in Record 2.2 (pos 98-108)", () => {
    const bic = "GEBABEBB   ";
    const line = makeRecord22(bic);
    const [result] = anonymizeCodaLines([line]);
    const resultBic = result.slice(98, 109);
    expect(resultBic).not.toBe(bic);
    expect(result).toHaveLength(128);
  });

  it("replaces IBAN in Record 2.3 (pos 10-43)", () => {
    const iban = "BE68539007547034              ";
    const line = makeRecord23(iban, "COUNTERPART                ");
    const [result] = anonymizeCodaLines([line]);
    const resultIban = result.slice(10, 44);
    expect(resultIban).not.toBe(iban);
    expect(result).toHaveLength(128);
  });

  it("replaces name in Record 2.3 (pos 47-81)", () => {
    const name = "COUNTERPART NAME           ";
    const line = makeRecord23("BE68539007547034              ", name);
    const [result] = anonymizeCodaLines([line]);
    const resultName = result.slice(47, 82);
    expect(resultName).not.toBe(name);
    expect(result).toHaveLength(128);
  });

  it("replaces account in Record 8 (pos 4-37)", () => {
    const account = "BE68539007547034              ";
    const line = makeRecord8(account);
    const [result] = anonymizeCodaLines([line]);
    const resultAcct = result.slice(4, 38);
    expect(resultAcct).not.toBe(account);
    expect(result).toHaveLength(128);
  });

  it("is deterministic: same input produces same output", () => {
    const lines = [
      makeRecord0("GEBABEBB   "),
      makeRecord1("BE68539007547034              ", "JOHN DOE                  "),
    ];
    const r1 = anonymizeCodaLines(lines, 42);
    const r2 = anonymizeCodaLines(lines, 42);
    expect(r1).toEqual(r2);
  });

  it("produces different output for different seeds", () => {
    const lines = [makeRecord0("GEBABEBB   ")];
    const r1 = anonymizeCodaLines(lines, 0);
    const r2 = anonymizeCodaLines(lines, 999);
    expect(r1[0].slice(60, 71)).not.toBe(r2[0].slice(60, 71));
  });

  it("preserves referential integrity: same IBAN maps to same fake IBAN", () => {
    const iban = "BE68539007547034              ";
    const lines = [
      makeRecord1(iban, "JOHN DOE                  "),
      makeRecord8(iban),
    ];
    const result = anonymizeCodaLines(lines);
    // Record 1 account at pos 5-38, Record 8 account at pos 4-37 (different offsets, different lengths via slice)
    // Both should produce the same fake for the same input value
    const fakeFromRec1 = result[0].slice(5, 39);
    const fakeFromRec8 = result[1].slice(4, 38);
    // Both fake IBANs are derived from the same original value — they should be equal
    expect(fakeFromRec1).toBe(fakeFromRec8);
  });

  it("referential integrity: same IBAN in rec23 and rec1 maps to same fake", () => {
    const iban = "BE68539007547034              ";
    const rec1 = makeRecord1(iban, "OWNER NAME                ");
    const rec23 = makeRecord23(iban, "COUNTERPART                ");
    const result = anonymizeCodaLines([rec1, rec23]);
    const fakeFromRec1 = result[0].slice(5, 39);
    const fakeFromRec23 = result[1].slice(10, 44);
    expect(fakeFromRec1).toBe(fakeFromRec23);
  });

  it("passes through lines that are not 128 chars unchanged", () => {
    const short = "bad line";
    const lines = [short, makeRecord0("GEBABEBB   ")];
    const result = anonymizeCodaLines(lines);
    expect(result[0]).toBe(short);
  });

  it("preserves non-sensitive records (2.1, 3.x, 9) unchanged", () => {
    const rec21 = makeLine("21");
    const rec9  = makeLine("9");
    const lines = [rec21, rec9];
    const result = anonymizeCodaLines(lines);
    expect(result[0]).toBe(rec21);
    expect(result[1]).toBe(rec9);
  });

  it("preserves country code in anonymized IBAN (Record 1)", () => {
    const iban = "BE68539007547034              ";
    const line = makeRecord1(iban, "OWNER                     ");
    const [result] = anonymizeCodaLines([line]);
    const fakeIban = result.slice(5, 39).trim();
    expect(fakeIban.slice(0, 2)).toBe("BE");
  });
});
