import { describe, it, expect } from "vitest";
import { record23 } from "../../../src/core/records/record23.js";

describe("record23", () => {
  const baseParams = {
    seqNum: "0001",
    comm: "comm overflow text",
    counterpartIban: "BE91516952884376",
    currency: "EUR",
    counterpartName: "Acme Corp",
    needRecord3: false,
  };

  it("returns exactly 128 characters", () => {
    expect(record23(baseParams).raw).toHaveLength(128);
  });

  it("starts with '23'", () => {
    expect(record23(baseParams).raw.slice(0, 2)).toBe("23");
  });

  it("places sequence at positions 2-5", () => {
    expect(record23(baseParams).raw.slice(2, 6)).toBe("0001");
  });

  it("places detail number '0000' at positions 6-9", () => {
    expect(record23(baseParams).raw.slice(6, 10)).toBe("0000");
  });

  it("places counterpart IBAN at positions 10-43 (34 chars)", () => {
    const r = record23(baseParams).raw;
    expect(r.slice(10, 44)).toHaveLength(34);
    expect(r.slice(10, 44).trimEnd()).toBe("BE91516952884376");
  });

  it("places currency at positions 44-46 (3 chars)", () => {
    const r = record23(baseParams).raw;
    expect(r.slice(44, 47)).toBe("EUR");
  });

  it("places counterpart name at positions 47-81 (35 chars)", () => {
    const r = record23(baseParams).raw;
    expect(r.slice(47, 82)).toHaveLength(35);
    expect(r.slice(47, 82).trimEnd()).toBe("Acme Corp");
  });

  it("places comm at positions 82-124 (43 chars)", () => {
    const r = record23(baseParams).raw;
    expect(r.slice(82, 125)).toHaveLength(43);
    expect(r.slice(82, 125).trimEnd()).toBe("comm overflow text");
  });

  it("next code at position 125 is always '0'", () => {
    expect(record23(baseParams).raw[125]).toBe("0");
  });

  it("blank at position 126", () => {
    expect(record23(baseParams).raw[126]).toBe(" ");
  });

  it("link code at position 127 is '1' when needRecord3=true", () => {
    expect(record23({ ...baseParams, needRecord3: true }).raw[127]).toBe("1");
  });

  it("link code at position 127 is '0' when needRecord3=false", () => {
    expect(record23({ ...baseParams, needRecord3: false }).raw[127]).toBe("0");
  });

  it("returns CodaLine with fields array", () => {
    const result = record23(baseParams);
    expect(result.recordType).toBe("2.3");
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
