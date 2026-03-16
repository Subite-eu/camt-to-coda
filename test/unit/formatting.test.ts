import { describe, it, expect } from "vitest";
import { padRight, padLeft, formatBalance, formatDate, signCode, movementSign, accountStructure } from "../../src/core/formatting.js";

describe("padRight", () => {
  it("pads short string", () => expect(padRight("AB", 5)).toBe("AB   "));
  it("truncates long string", () => expect(padRight("ABCDEF", 3)).toBe("ABC"));
  it("returns exact fit", () => expect(padRight("ABC", 3)).toBe("ABC"));
  it("pads with custom char", () => expect(padRight("1", 4, "0")).toBe("1000"));
});

describe("padLeft", () => {
  it("pads short string", () => expect(padLeft("1", 4, "0")).toBe("0001"));
  it("truncates long string", () => expect(padLeft("12345", 3, "0")).toBe("123"));
});

describe("formatBalance", () => {
  it("formats zero", () => expect(formatBalance(0)).toBe("000000000000000"));
  it("formats integer", () => expect(formatBalance(1000)).toBe("000000001000000"));
  it("formats decimals", () => expect(formatBalance(123.45)).toBe("000000000123450"));
  it("always 15 chars", () => {
    for (const n of [0, 0.01, 1, 99.99, 1000000, 123456789.123])
      expect(formatBalance(n)).toHaveLength(15);
  });
  it("handles negative (uses absolute)", () => expect(formatBalance(-500)).toBe("000000000500000"));
});

describe("formatDate", () => {
  it("formats ISO date", () => expect(formatDate("2024-03-07")).toBe("070324"));
  it("formats datetime", () => expect(formatDate("2024-11-30T23:59:59Z")).toBe("301124"));
  it("handles empty", () => expect(formatDate("")).toBe("000000"));
});

describe("signCode", () => {
  it("positive is 0 (credit in CODA)", () => expect(signCode(100)).toBe("0"));
  it("zero is 0", () => expect(signCode(0)).toBe("0"));
  it("negative is 1 (debit in CODA)", () => expect(signCode(-100)).toBe("1"));
});

describe("movementSign", () => {
  it("CRDT is 0", () => expect(movementSign("CRDT")).toBe("0"));
  it("DBIT is 1", () => expect(movementSign("DBIT")).toBe("1"));
});

describe("accountStructure", () => {
  it("BE is 2", () => expect(accountStructure("BE68793230773034")).toBe("2"));
  it("LT is 3", () => expect(accountStructure("LT625883379695428516")).toBe("3"));
  it("non-IBAN is 0", () => expect(accountStructure("1234567890")).toBe("0"));
});
