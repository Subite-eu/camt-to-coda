import { describe, it, expect } from "vitest";
import { record8 } from "../../../src/core/records/record8.js";
import type { CamtStatement } from "../../../src/core/model.js";

const baseStmt: CamtStatement = {
  camtVersion: "053",
  messageId: "MSG001",
  creationDate: "2024-06-15T12:00:00Z",
  statementId: "STMT-001",
  reportDate: "2024-06-15T12:00:00Z",
  account: {
    iban: "BE68793230773034",
    currency: "EUR",
  },
  openingBalance: { amount: 5000, creditDebit: "CRDT", date: "2024-06-14" },
  closingBalance: { amount: 6000, creditDebit: "CRDT", date: "2024-06-15" },
  entries: [],
};

describe("record8", () => {
  it("returns exactly 128 characters", () => {
    expect(record8(baseStmt, "001").raw).toHaveLength(128);
  });

  it("starts with record id '8'", () => {
    expect(record8(baseStmt, "001").raw[0]).toBe("8");
  });

  it("places sequence at positions 1-3", () => {
    expect(record8(baseStmt, "042").raw.slice(1, 4)).toBe("042");
  });

  it("places IBAN at positions 4-37 (34 chars)", () => {
    const r = record8(baseStmt, "001").raw;
    expect(r.slice(4, 38)).toHaveLength(34);
    expect(r.slice(4, 38).trimEnd()).toBe("BE68793230773034");
  });

  it("places currency at positions 38-40 (3 chars)", () => {
    expect(record8(baseStmt, "001").raw.slice(38, 41)).toBe("EUR");
  });

  it("places sign at position 41 (0 = credit)", () => {
    expect(record8(baseStmt, "001").raw[41]).toBe("0");
  });

  it("places sign at position 41 (1 = debit)", () => {
    const stmt = {
      ...baseStmt,
      closingBalance: { amount: 200, creditDebit: "DBIT" as const, date: "2024-06-15" },
    };
    expect(record8(stmt, "001").raw[41]).toBe("1");
  });

  it("places closing balance at positions 42-56 (15 chars)", () => {
    const r = record8(baseStmt, "001").raw;
    expect(r.slice(42, 57)).toBe("000000006000000");
  });

  it("places closing balance date at positions 57-62 (DDMMYY)", () => {
    const r = record8(baseStmt, "001").raw;
    expect(r.slice(57, 63)).toBe("150624");
  });

  it("places 64 blanks at positions 63-126", () => {
    const r = record8(baseStmt, "001").raw;
    expect(r.slice(63, 127)).toBe(" ".repeat(64));
  });

  it("link code '0' at position 127", () => {
    expect(record8(baseStmt, "001").raw[127]).toBe("0");
  });

  it("returns CodaLine with fields array", () => {
    const result = record8(baseStmt, "001");
    expect(result.recordType).toBe("8");
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
