import { describe, it, expect } from "vitest";
import { record33 } from "../../../src/core/records/record33.js";

describe("record33", () => {
  const baseParams = {
    seqNum: "0001",
    detailNum: 1,
    comm: "final communication overflow text for record 3.3 continuation here",
  };

  it("returns exactly 128 characters", () => {
    expect(record33(baseParams)).toHaveLength(128);
  });

  it("starts with '33'", () => {
    expect(record33(baseParams).slice(0, 2)).toBe("33");
  });

  it("places sequence number at positions 2-5", () => {
    expect(record33(baseParams).slice(2, 6)).toBe("0001");
  });

  it("places detail number at positions 6-9 (zero-padded)", () => {
    expect(record33(baseParams).slice(6, 10)).toBe("0001");
    expect(record33({ ...baseParams, detailNum: 2 }).slice(6, 10)).toBe("0002");
  });

  it("places comm at positions 10-99 (90 chars)", () => {
    const r = record33(baseParams);
    expect(r.slice(10, 100)).toHaveLength(90);
    expect(r.slice(10, 100).trimEnd()).toBe(baseParams.comm);
  });

  it("places 25 blank chars at positions 100-124", () => {
    const r = record33(baseParams);
    expect(r.slice(100, 125)).toBe("                         ");
  });

  it("next code at position 125 is always '0'", () => {
    expect(record33(baseParams)[125]).toBe("0");
  });

  it("blank at position 126", () => {
    expect(record33(baseParams)[126]).toBe(" ");
  });

  it("link code '0' at position 127", () => {
    expect(record33(baseParams)[127]).toBe("0");
  });
});
