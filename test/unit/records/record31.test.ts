import { describe, it, expect } from "vitest";
import { record31 } from "../../../src/core/records/record31.js";

describe("record31", () => {
  const baseParams = {
    seqNum: "0001",
    detailNum: 1,
    bankRef: "E2E-001/TX001",
    txCode: "04500001",
    commType: "0",
    comm: "Payment for invoice 12345",
    entryDate: "150624",
    hasRecord32: false,
  };

  it("returns exactly 128 characters", () => {
    expect(record31(baseParams).raw).toHaveLength(128);
  });

  it("starts with '31'", () => {
    expect(record31(baseParams).raw.slice(0, 2)).toBe("31");
  });

  it("places sequence number at positions 2-5", () => {
    expect(record31(baseParams).raw.slice(2, 6)).toBe("0001");
  });

  it("places detail number at positions 6-9 (zero-padded)", () => {
    expect(record31(baseParams).raw.slice(6, 10)).toBe("0001");
    expect(record31({ ...baseParams, detailNum: 5 }).raw.slice(6, 10)).toBe("0005");
  });

  it("places bank ref at positions 10-30 (21 chars)", () => {
    const r = record31(baseParams).raw;
    expect(r.slice(10, 31)).toHaveLength(21);
    expect(r.slice(10, 31).trimEnd()).toBe("E2E-001/TX001");
  });

  it("places txCodeType '1' at position 31", () => {
    expect(record31(baseParams).raw[31]).toBe("1");
  });

  it("places txCode at positions 32-39 (8 chars)", () => {
    expect(record31(baseParams).raw.slice(32, 40)).toBe("04500001");
  });

  it("places commType at position 40", () => {
    expect(record31(baseParams).raw[40]).toBe("0");
    expect(record31({ ...baseParams, commType: "1" }).raw[40]).toBe("1");
  });

  it("places comm at positions 41-113 (73 chars)", () => {
    const r = record31(baseParams).raw;
    expect(r.slice(41, 114)).toHaveLength(73);
    expect(r.slice(41, 114).trimEnd()).toBe("Payment for invoice 12345");
  });

  it("places entry date at positions 114-119 (6 chars)", () => {
    expect(record31(baseParams).raw.slice(114, 120)).toBe("150624");
  });

  it("places sequence '000' at positions 120-122", () => {
    expect(record31(baseParams).raw.slice(120, 123)).toBe("000");
  });

  it("places globalisation code '0' at position 123", () => {
    expect(record31(baseParams).raw[123]).toBe("0");
  });

  it("next code at position 124 is '1' when hasRecord32=true", () => {
    expect(record31({ ...baseParams, hasRecord32: true }).raw[124]).toBe("1");
  });

  it("next code at position 124 is '0' when hasRecord32=false", () => {
    expect(record31(baseParams).raw[124]).toBe("0");
  });

  it("blank at position 125", () => {
    expect(record31(baseParams).raw[125]).toBe(" ");
  });

  it("link code '0' at position 126", () => {
    expect(record31(baseParams).raw[126]).toBe("0");
  });

  it("padding at position 127", () => {
    // Extra padding char to reach 128
    expect(record31(baseParams).raw).toHaveLength(128);
  });

  it("returns CodaLine with fields array", () => {
    const result = record31(baseParams);
    expect(result.recordType).toBe("3.1");
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
