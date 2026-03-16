import { describe, it, expect } from "vitest";
import { record22 } from "../../../src/core/records/record22.js";

describe("record22", () => {
  it("returns exactly 128 characters", () => {
    expect(record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false })).toHaveLength(128);
  });

  it("starts with '22'", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false });
    expect(r.slice(0, 2)).toBe("22");
  });

  it("places sequence number at positions 2-5", () => {
    const r = record22({ seqNum: "0042", comm: "", counterpartBic: "", hasMore: false });
    expect(r.slice(2, 6)).toBe("0042");
  });

  it("places detail number '0000' at positions 6-9", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false });
    expect(r.slice(6, 10)).toBe("0000");
  });

  it("places comm at positions 10-62 (53 chars)", () => {
    const comm = "continuation communication text here";
    const r = record22({ seqNum: "0001", comm, counterpartBic: "", hasMore: false });
    expect(r.slice(10, 63)).toHaveLength(53);
    expect(r.slice(10, 63).trimEnd()).toBe(comm);
  });

  it("places counterpart BIC at positions 98-108 (11 chars)", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "SNDRBEBB", hasMore: false });
    expect(r.slice(98, 109)).toBe("SNDRBEBB   ");
  });

  it("sets next code to '1' at position 125 when hasMore=true", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: true });
    expect(r[125]).toBe("1");
  });

  it("sets next code to '0' at position 125 when hasMore=false", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false });
    expect(r[125]).toBe("0");
  });

  it("blank at position 126", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false });
    expect(r[126]).toBe(" ");
  });

  it("link code at position 127 is '0'", () => {
    const r = record22({ seqNum: "0001", comm: "", counterpartBic: "", hasMore: false });
    expect(r[127]).toBe("0");
  });
});
