import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatBalance, formatDate, padLeft, padRight } from "../../src/core/formatting.js";
import { record0 } from "../../src/core/records/record0.js";
import { record1 } from "../../src/core/records/record1.js";
import { record8 } from "../../src/core/records/record8.js";
import { record9 } from "../../src/core/records/record9.js";
import type { CamtStatement } from "../../src/core/model.js";

describe("property: formatting invariants", () => {
  it("formatBalance always returns 15 chars", () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 999999999999.999, noNaN: true, noDefaultInfinity: true }),
      (n) => { expect(formatBalance(n)).toHaveLength(15); }
    ));
  });

  it("padLeft always returns exactly n chars", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 50 }),
      fc.integer({ min: 1, max: 100 }),
      (s, n) => { expect(padLeft(s, n, "0")).toHaveLength(n); }
    ));
  });

  it("padRight always returns exactly n chars", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 50 }),
      fc.integer({ min: 1, max: 100 }),
      (s, n) => { expect(padRight(s, n)).toHaveLength(n); }
    ));
  });

  it("formatDate always returns exactly 6 chars", () => {
    fc.assert(fc.property(
      fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }),
      (d) => {
        const iso = d.toISOString().slice(0, 10);
        expect(formatDate(iso)).toHaveLength(6);
      }
    ));
  });

  it("padLeft result starts with pad character when input is shorter than n", () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 20 }),
      (n) => {
        // Empty string padded left always starts with the pad char
        const result = padLeft("", n, "0");
        expect(result[0]).toBe("0");
      }
    ));
  });

  it("padRight result ends with pad character when input is shorter than n", () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 20 }),
      (n) => {
        // Empty string padded right always ends with the pad char
        const result = padRight("", n, "X");
        expect(result[result.length - 1]).toBe("X");
      }
    ));
  });
});

describe("property: record length invariants", () => {
  const arbStmt: CamtStatement = {
    messageId: "M", creationDate: "2024-01-01T00:00:00Z",
    statementId: "S", reportDate: "2024-01-01T00:00:00Z",
    camtVersion: "053",
    account: { currency: "EUR" },
    openingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-01-01" },
    closingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-01-01" },
    entries: [],
  };

  it("record0 always returns 128 chars", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 11 }),
      (bic) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, bic } };
        expect(record0(stmt)).toHaveLength(128);
      }
    ));
  });

  it("record1 always returns 128 chars", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      (iban, amount) => {
        const stmt = {
          ...arbStmt,
          account: { ...arbStmt.account, iban },
          openingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
        };
        expect(record1(stmt, "001")).toHaveLength(128);
      }
    ));
  });

  it("record8 always returns 128 chars", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      (iban, amount) => {
        const stmt = {
          ...arbStmt,
          account: { ...arbStmt.account, iban },
          closingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
        };
        expect(record8(stmt, "001")).toHaveLength(128);
      }
    ));
  });

  it("record9 always returns 128 chars", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 999999 }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      (recordCount, sumDebits, sumCredits) => {
        expect(record9({ recordCount, sumDebits, sumCredits })).toHaveLength(128);
      }
    ));
  });

  it("record0 always starts with '0'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 11 }),
      (bic) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, bic } };
        expect(record0(stmt)[0]).toBe("0");
      }
    ));
  });

  it("record1 always starts with '1'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      (iban) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, iban } };
        expect(record1(stmt, "001")[0]).toBe("1");
      }
    ));
  });

  it("record8 always starts with '8'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      (iban) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, iban } };
        expect(record8(stmt, "001")[0]).toBe("8");
      }
    ));
  });

  it("record9 always starts with '9'", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 999999 }),
      (recordCount) => {
        expect(record9({ recordCount, sumDebits: 0, sumCredits: 0 })[0]).toBe("9");
      }
    ));
  });
});
