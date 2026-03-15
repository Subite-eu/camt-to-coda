import { describe, it, expect } from "vitest";
import { record9 } from "../../../src/core/records/record9.js";

describe("record9", () => {
  it("returns exactly 128 characters", () => {
    expect(record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 })).toHaveLength(128);
  });

  it("starts with record id '9'", () => {
    expect(record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 })[0]).toBe("9");
  });

  it("places 15 blanks at positions 1-15", () => {
    const r = record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 });
    expect(r.slice(1, 16)).toBe(" ".repeat(15));
  });

  it("places record count at positions 16-21 (6 chars, zero-padded)", () => {
    const r = record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 });
    expect(r.slice(16, 22)).toBe("000007");
  });

  it("places sum debits at positions 22-36 (15 chars)", () => {
    const r = record9({ recordCount: 5, sumDebits: 500.5, sumCredits: 1000 });
    expect(r.slice(22, 37)).toBe("000000000500500");
  });

  it("places sum credits at positions 37-51 (15 chars)", () => {
    const r = record9({ recordCount: 5, sumDebits: 0, sumCredits: 1234.56 });
    expect(r.slice(37, 52)).toBe("000000001234560");
  });

  it("places 75 blanks at positions 52-126", () => {
    const r = record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 });
    expect(r.slice(52, 127)).toBe(" ".repeat(75));
  });

  it("ends with '2' (last file code) at position 127", () => {
    expect(record9({ recordCount: 7, sumDebits: 0, sumCredits: 1000 })[127]).toBe("2");
  });

  it("handles zero counts and amounts", () => {
    const r = record9({ recordCount: 0, sumDebits: 0, sumCredits: 0 });
    expect(r).toHaveLength(128);
    expect(r.slice(16, 22)).toBe("000000");
    expect(r.slice(22, 37)).toBe("000000000000000");
    expect(r.slice(37, 52)).toBe("000000000000000");
  });
});
