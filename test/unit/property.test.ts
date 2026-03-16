import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatBalance, formatDate, padLeft, padRight } from "../../src/core/formatting.js";
import { record0 } from "../../src/core/records/record0.js";
import { record1 } from "../../src/core/records/record1.js";
import { record8 } from "../../src/core/records/record8.js";
import { record9 } from "../../src/core/records/record9.js";
import type { CamtStatement } from "../../src/core/model.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { parseCoda } from "../../src/core/coda-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { extractFields } from "../../src/core/field-defs/extract.js";
import {
  RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
  RECORD23_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
} from "../../src/core/field-defs/index.js";

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
        expect(record0(stmt).raw).toHaveLength(128);
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
        expect(record1(stmt, "001").raw).toHaveLength(128);
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
        expect(record8(stmt, "001").raw).toHaveLength(128);
      }
    ));
  });

  it("record9 always returns 128 chars", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 999999 }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 999999999, noNaN: true, noDefaultInfinity: true }),
      (recordCount, sumDebits, sumCredits) => {
        expect(record9({ recordCount, sumDebits, sumCredits }).raw).toHaveLength(128);
      }
    ));
  });

  it("record0 always starts with '0'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 11 }),
      (bic) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, bic } };
        expect(record0(stmt).raw[0]).toBe("0");
      }
    ));
  });

  it("record1 always starts with '1'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      (iban) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, iban } };
        expect(record1(stmt, "001").raw[0]).toBe("1");
      }
    ));
  });

  it("record8 always starts with '8'", () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 34 }),
      (iban) => {
        const stmt = { ...arbStmt, account: { ...arbStmt.account, iban } };
        expect(record8(stmt, "001").raw[0]).toBe("8");
      }
    ));
  });

  it("record9 always starts with '9'", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 999999 }),
      (recordCount) => {
        expect(record9({ recordCount, sumDebits: 0, sumCredits: 0 }).raw[0]).toBe("9");
      }
    ));
  });
});

describe("property: field-defs", () => {
  const allFieldDefs = [
    RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
    RECORD23_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
  ];

  it("extractFields always produces fields summing to 128 chars", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allFieldDefs),
        (defs) => {
          const line = "X".repeat(128);
          const fields = extractFields(line, defs);
          const total = fields.reduce((s, f) => s + f.value.length, 0);
          return total === 128;
        }
      )
    );
  });
});

describe("property: round-trip", () => {
  it("forward-then-reverse preserves account IBAN", () => {
    fc.assert(
      fc.property(
        fc.record({
          iban: fc.stringMatching(/^[A-Z]{2}\d{14,30}$/).filter(s => s.length <= 34),
          currency: fc.constantFrom("EUR", "USD", "GBP"),
          amount: fc.integer({ min: 0, max: 999999999 }),
        }),
        ({ iban, currency, amount }) => {
          const stmt = {
            camtVersion: "053" as const,
            messageId: "M",
            creationDate: "2024-01-01",
            statementId: "S",
            account: { iban, currency, bic: "TESTBEBB" },
            openingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            closingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            entries: [],
            reportDate: "2024-01-01",
          };

          const coda = statementToCoda(stmt);
          const codaContent = coda.lines.map(l => l.raw).join("\n");
          const reverse = codaToCamt(codaContent);
          return reverse.statement.account.iban === iban;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("parseCoda always succeeds on statementToCoda output", () => {
    fc.assert(
      fc.property(
        fc.record({
          iban: fc.stringMatching(/^[A-Z]{2}\d{14,30}$/).filter(s => s.length <= 34),
          currency: fc.constantFrom("EUR", "USD", "GBP"),
          amount: fc.integer({ min: 0, max: 999999999 }),
        }),
        ({ iban, currency, amount }) => {
          const stmt = {
            camtVersion: "053" as const,
            messageId: "M",
            creationDate: "2024-01-01",
            statementId: "S",
            account: { iban, currency, bic: "TESTBEBB" },
            openingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            closingBalance: { amount, creditDebit: "CRDT" as const, date: "2024-01-01" },
            entries: [],
            reportDate: "2024-01-01",
          };

          const coda = statementToCoda(stmt);
          const codaContent = coda.lines.map(l => l.raw).join("\n");
          // Must not throw — parser accepts anything the builder produces
          const parsed = parseCoda(codaContent);
          return parsed.length === coda.lines.length;
        }
      ),
      { numRuns: 50 }
    );
  });
});
