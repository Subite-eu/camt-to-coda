import { describe, it, expect } from "vitest";
import { anonymizeCodaLines } from "../../src/anonymize/anonymizer.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import type { CamtStatement } from "../../src/core/model.js";

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

  it("leaves genuinely non-sensitive records (9) unchanged", () => {
    const rec9 = makeLine("9");
    expect(anonymizeCodaLines([rec9])[0]).toBe(rec9);
  });
});

// ── Free-text / identifier leak prevention (regression for the PII leak) ───────

describe("anonymizeCodaLines() — fail-closed free-text scrubbing", () => {
  function lineWith(prefix: string, value: string, start: number): string {
    const base = prefix.padEnd(start, " ") + value;
    return base.padEnd(128, " ");
  }

  it("blanks the Record 0 addressee (35-60) and company number (72-82)", () => {
    const line = lineWith("0", "", 0)
      .split("")
      .map((c, i) => (i >= 34 && i < 60 ? "X" : i >= 71 && i < 82 ? "9" : c))
      .join("");
    const [out] = anonymizeCodaLines([line]);
    expect(out.slice(34, 60)).not.toContain("X"); // addressee scrubbed
    expect(out.slice(71, 82).trim()).toBe(""); // company number blanked
    expect(out).toHaveLength(128);
  });

  it("blanks the Record 2.1 communication zone (63-115) and bank reference (11-31)", () => {
    const line = lineWith("21", "JOHN DOE KERKSTRAAT 12 9000 GENT INV 2024/0042", 62);
    const ref = line.slice(0, 10) + "SECRETREF1234567890XX" + line.slice(31);
    const [out] = anonymizeCodaLines([ref]);
    expect(out.slice(62, 115).trim()).toBe("");
    expect(out.slice(10, 31).trim()).toBe("");
    expect(out).not.toContain("JOHN DOE");
    expect(out).not.toContain("SECRETREF");
  });

  it("blanks the Record 2.2 communication (11-63) and customer reference (64-98)", () => {
    const comm = lineWith("22", "MARIE DUBOIS RUE DE LA LOI 1", 10);
    const withRef = comm.slice(0, 63) + "ENDTOENDID-MARIE-DUBOIS-001".padEnd(35) + comm.slice(98);
    const [out] = anonymizeCodaLines([withRef]);
    expect(out).not.toContain("MARIE DUBOIS");
    expect(out).not.toContain("ENDTOENDID");
  });

  it("end-to-end: PII in remittance does NOT survive --anonymize (the original leak)", () => {
    const stmt: CamtStatement = {
      camtVersion: "053", messageId: "M", creationDate: "2024-03-15", statementId: "S",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "GEBABEBB", ownerName: "JAN JANSSEN" },
      openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-03-15" },
      closingBalance: { amount: 1500, creditDebit: "CRDT", date: "2024-03-15" },
      reportDate: "2024-03-15",
      entries: [{
        amount: 500, currency: "EUR", creditDebit: "CRDT", bookingDate: "2024-03-15", valueDate: "2024-03-15",
        details: [{
          counterparty: { name: "MARIE DUBOIS", iban: "BE91516952884376" },
          remittanceInfo: { unstructured: "Payment MARIE DUBOIS Kerkstraat 12 9000 GENT inv 2024/0042 BE91516952884376" },
        }],
      }],
    };
    const text = anonymizeCodaLines(statementToCoda(stmt).lines).join("\n");
    expect(text).not.toContain("JAN JANSSEN");
    expect(text).not.toContain("MARIE DUBOIS");
    expect(text).not.toContain("Kerkstraat 12 9000 GENT");
    expect(text).not.toContain("BE91516952884376");
    expect(text).not.toContain("inv 2024/0042");
  });

  it("preserves country code in anonymized IBAN (Record 1)", () => {
    const iban = "BE68539007547034              ";
    const line = makeRecord1(iban, "OWNER                     ");
    const [result] = anonymizeCodaLines([line]);
    const fakeIban = result.slice(5, 39).trim();
    expect(fakeIban.slice(0, 2)).toBe("BE");
  });
});
