import { describe, it, expect } from "vitest";
import { record1 } from "../../../src/core/records/record1.js";
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
  },
  openingBalance: { amount: 5000, creditDebit: "CRDT", date: "2024-06-15" },
  closingBalance: { amount: 6000, creditDebit: "CRDT", date: "2024-06-15" },
  entries: [],
};

describe("record1", () => {
  it("returns exactly 128 characters", () => {
    expect(record1(baseStmt, "001")).toHaveLength(128);
  });

  it("starts with record id '1'", () => {
    expect(record1(baseStmt, "001")[0]).toBe("1");
  });

  it("places account structure at position 1", () => {
    // BE IBAN → '2'
    expect(record1(baseStmt, "001")[1]).toBe("2");
  });

  it("places sequence at positions 2-4", () => {
    expect(record1(baseStmt, "042").slice(2, 5)).toBe("042");
  });

  it("places IBAN at positions 5-38", () => {
    const r = record1(baseStmt, "001");
    expect(r.slice(5, 39)).toContain("BE68793230773034");
  });

  it("places currency at positions 39-41", () => {
    const r = record1(baseStmt, "001");
    expect(r.slice(39, 42)).toBe("EUR");
  });

  it("places sign at position 42 (0 = credit)", () => {
    const r = record1(baseStmt, "001");
    expect(r[42]).toBe("0"); // credit balance
  });

  it("places opening balance amount at positions 43-57", () => {
    const r = record1(baseStmt, "001");
    // 5000 → 000000005000000
    expect(r.slice(43, 58)).toBe("000000005000000");
  });

  it("ends sequence at positions 125-127", () => {
    const r = record1(baseStmt, "007");
    expect(r.slice(125, 128)).toBe("007");
  });

  it("handles non-IBAN account with structure 0", () => {
    const stmt = {
      ...baseStmt,
      account: { ...baseStmt.account, iban: undefined, otherId: "1234567890" },
    };
    const r = record1(stmt, "001");
    expect(r).toHaveLength(128);
    expect(r[1]).toBe("0");
  });
});
