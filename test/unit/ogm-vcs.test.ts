import { describe, it, expect } from "vitest";
import { mod97, isOgmVcs, isValidOgmVcs, formatVisual } from "../../src/core/ogm-vcs.js";

describe("OGM-VCS structured communication (FEBELFIN AOS1)", () => {
  it("computes mod-97 check digits, with the 0->97 rule", () => {
    // AOS1 example: reference 010806817183, first 10 = 0108068171, check = 83
    expect(mod97("0108068171")).toBe(83);
    // remainder 0 maps to 97 (97 * 10_000_000 = 970000000)
    expect(mod97("0970000000")).toBe(97);
  });

  it("validates a full 12-digit OGM-VCS reference", () => {
    expect(isValidOgmVcs("010806817183")).toBe(true); // AOS1 example
    expect(isValidOgmVcs("010806817100")).toBe(false); // wrong check digits
    expect(isValidOgmVcs("12345")).toBe(false); // too short
    expect(isValidOgmVcs("RF18539007547034")).toBe(false); // ISO RF, not OGM-VCS
  });

  it("structurally recognizes a 12-digit OGM-VCS candidate", () => {
    expect(isOgmVcs("010806817183")).toBe(true);
    expect(isOgmVcs("12345678901")).toBe(false); // 11 digits
    expect(isOgmVcs("RF18539007547034")).toBe(false); // not numeric
  });

  it("formats the visual +++ddd/dddd/ddddd+++ representation", () => {
    expect(formatVisual("010806817183")).toBe("+++010/8068/17183+++");
  });
});
