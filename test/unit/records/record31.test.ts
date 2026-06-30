import { describe, it, expect } from "vitest";
import { record31 } from "../../../src/core/records/record31.js";

// Layout per CODA 2.6 Annexe I, Data record 3.1 (1-indexed positions):
//   11-31 bank ref · 32-39 transaction code · 40 comm type · 41-113 communication
//   114-125 blank · 126 next code · 127 blank · 128 link code
describe("record31", () => {
  const baseParams = {
    seqNum: "0001",
    detailNum: 1,
    bankRef: "E2E-001/TX001",
    txCode: "04500001",
    commType: "0",
    comm: "Payment for invoice 12345",
    hasRecord32: false,
  };

  it("returns exactly 128 characters", () => {
    expect(record31(baseParams).raw).toHaveLength(128);
  });

  it("starts with '31'", () => {
    expect(record31(baseParams).raw.slice(0, 2)).toBe("31");
  });

  it("places sequence number at positions 3-6", () => {
    expect(record31(baseParams).raw.slice(2, 6)).toBe("0001");
  });

  it("places detail number at positions 7-10 (zero-padded)", () => {
    expect(record31(baseParams).raw.slice(6, 10)).toBe("0001");
    expect(record31({ ...baseParams, detailNum: 5 }).raw.slice(6, 10)).toBe("0005");
  });

  it("places bank ref at positions 11-31 (21 chars)", () => {
    const r = record31(baseParams).raw;
    expect(r.slice(10, 31)).toHaveLength(21);
    expect(r.slice(10, 31).trimEnd()).toBe("E2E-001/TX001");
  });

  it("places txCode at positions 32-39 (8 chars)", () => {
    expect(record31(baseParams).raw.slice(31, 39)).toBe("04500001");
  });

  it("places commType at position 40", () => {
    expect(record31(baseParams).raw[39]).toBe("0");
    expect(record31({ ...baseParams, commType: "1" }).raw[39]).toBe("1");
  });

  it("places comm at positions 41-113 (73 chars)", () => {
    const r = record31(baseParams).raw;
    expect(r.slice(40, 113)).toHaveLength(73);
    expect(r.slice(40, 113).trimEnd()).toBe("Payment for invoice 12345");
  });

  it("leaves positions 114-125 blank (12 chars)", () => {
    expect(record31(baseParams).raw.slice(113, 125)).toBe(" ".repeat(12));
  });

  it("next code at position 126 reflects hasRecord32", () => {
    expect(record31(baseParams).raw[125]).toBe("0");
    expect(record31({ ...baseParams, hasRecord32: true }).raw[125]).toBe("1");
  });

  it("blank at position 127", () => {
    expect(record31(baseParams).raw[126]).toBe(" ");
  });

  it("link code '0' at position 128", () => {
    expect(record31(baseParams).raw[127]).toBe("0");
  });

  it("returns CodaLine with fields summing to 128", () => {
    const result = record31(baseParams);
    expect(result.recordType).toBe("3.1");
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
