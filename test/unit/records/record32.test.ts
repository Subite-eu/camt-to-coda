import { describe, it, expect } from "vitest";
import { record32 } from "../../../src/core/records/record32.js";

describe("record32", () => {
  const baseParams = {
    seqNum: "0001",
    detailNum: 1,
    comm: "continuation of communication text from record 3.1 overflow here",
    hasRecord33: false,
  };

  it("returns exactly 128 characters", () => {
    expect(record32(baseParams)).toHaveLength(128);
  });

  it("starts with '32'", () => {
    expect(record32(baseParams).slice(0, 2)).toBe("32");
  });

  it("places sequence number at positions 2-5", () => {
    expect(record32(baseParams).slice(2, 6)).toBe("0001");
  });

  it("places detail number at positions 6-9 (zero-padded)", () => {
    expect(record32(baseParams).slice(6, 10)).toBe("0001");
    expect(record32({ ...baseParams, detailNum: 3 }).slice(6, 10)).toBe("0003");
  });

  it("places comm at positions 10-114 (105 chars)", () => {
    const r = record32(baseParams);
    expect(r.slice(10, 115)).toHaveLength(105);
    expect(r.slice(10, 115).trimEnd()).toBe(baseParams.comm);
  });

  it("places 10 blank chars at positions 115-124", () => {
    const r = record32(baseParams);
    expect(r.slice(115, 125)).toBe("          ");
  });

  it("next code at position 125 is '1' when hasRecord33=true", () => {
    expect(record32({ ...baseParams, hasRecord33: true })[125]).toBe("1");
  });

  it("next code at position 125 is '0' when hasRecord33=false", () => {
    expect(record32(baseParams)[125]).toBe("0");
  });

  it("blank at position 126", () => {
    expect(record32(baseParams)[126]).toBe(" ");
  });

  it("link code '0' at position 127", () => {
    expect(record32(baseParams)[127]).toBe("0");
  });
});
