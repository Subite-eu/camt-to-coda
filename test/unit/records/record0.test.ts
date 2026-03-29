import { describe, it, expect } from "vitest";
import { record0 } from "../../../src/core/records/record0.js";
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
    ownerName: "Test Corp",
    bic: "TESTBE20",
  },
  openingBalance: { amount: 5000, creditDebit: "CRDT", date: "2024-06-15" },
  closingBalance: { amount: 6000, creditDebit: "CRDT", date: "2024-06-15" },
  entries: [],
};

describe("record0", () => {
  it("returns exactly 128 characters", () => {
    expect(record0(baseStmt).raw).toHaveLength(128);
  });

  it("starts with record id '0'", () => {
    expect(record0(baseStmt).raw[0]).toBe("0");
  });

  it("ends with version code '2' at position 127", () => {
    const r = record0(baseStmt).raw;
    expect(r[127]).toBe("2");
  });

  it("positions 1-4 are zeros", () => {
    expect(record0(baseStmt).raw.slice(1, 5)).toBe("0000");
  });

  it("places creation date at positions 5-10 (DDMMYY)", () => {
    const r = record0(baseStmt).raw;
    // 2024-06-15 → 150624
    expect(r.slice(5, 11)).toBe("150624");
  });

  it("places BIC at positions 60-70 (padded to 11)", () => {
    const r = record0(baseStmt).raw;
    expect(r.slice(60, 71)).toBe("TESTBE20   ");
  });

  it("handles missing BIC with spaces", () => {
    const stmt = { ...baseStmt, account: { ...baseStmt.account, bic: undefined } };
    const r = record0(stmt).raw;
    expect(r).toHaveLength(128);
    expect(r.slice(60, 71)).toBe("           ");
  });

  it("uses creationDate (not reportDate) for positions 5-10", () => {
    const stmt = {
      ...baseStmt,
      creationDate: "2025-01-20T08:00:00Z",
      reportDate: "2025-01-19T12:00:00Z",
    };
    const r = record0(stmt).raw;
    // creationDate 2025-01-20 → DDMMYY = 200125
    expect(r.slice(5, 11)).toBe("200125");
    // NOT reportDate 2025-01-19 → 190125
    expect(r.slice(5, 11)).not.toBe("190125");
  });

  it("places statementId in fileReference at positions 24-33", () => {
    const stmt = { ...baseStmt, statementId: "STMT-001" };
    const r = record0(stmt).raw;
    // fileReference: padRight("STMT-001", 10) = "STMT-001  "
    expect(r.slice(24, 34)).toBe("STMT-001  ");
  });

  it("falls back to messageId when statementId is empty", () => {
    const stmt = { ...baseStmt, statementId: "", messageId: "MSG001" };
    const r = record0(stmt).raw;
    expect(r.slice(24, 34)).toBe("MSG001    ");
  });

  it("truncates long statementId to 10 chars", () => {
    const stmt = { ...baseStmt, statementId: "ABCDEFGHIJKLMNOP" };
    const r = record0(stmt).raw;
    expect(r.slice(24, 34)).toBe("ABCDEFGHIJ");
    expect(r).toHaveLength(128);
  });

  it("returns CodaLine with fields array", () => {
    const result = record0(baseStmt);
    expect(result.recordType).toBe("0");
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
