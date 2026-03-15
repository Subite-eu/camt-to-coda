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
    expect(record0(baseStmt)).toHaveLength(128);
  });

  it("starts with record id '0'", () => {
    expect(record0(baseStmt)[0]).toBe("0");
  });

  it("ends with version code '2' at position 127", () => {
    const r = record0(baseStmt);
    expect(r[127]).toBe("2");
  });

  it("positions 1-4 are zeros", () => {
    expect(record0(baseStmt).slice(1, 5)).toBe("0000");
  });

  it("places creation date at positions 5-10 (DDMMYY)", () => {
    const r = record0(baseStmt);
    // 2024-06-15 → 150624
    expect(r.slice(5, 11)).toBe("150624");
  });

  it("places BIC at positions 60-70 (padded to 11)", () => {
    const r = record0(baseStmt);
    expect(r.slice(60, 71)).toBe("TESTBE20   ");
  });

  it("handles missing BIC with spaces", () => {
    const stmt = { ...baseStmt, account: { ...baseStmt.account, bic: undefined } };
    const r = record0(stmt);
    expect(r).toHaveLength(128);
    expect(r.slice(60, 71)).toBe("           ");
  });
});
