import { describe, it, expect } from "vitest";
import { toMillis, fromMillis, addMillis, formatMillis } from "../../src/core/money.js";

describe("money (3-decimal fixed point, CODA 2.6 Annexe I: amount = 12 int + 3 dec)", () => {
  it("converts to integer thousandths without float error", () => {
    expect(toMillis(0.1)).toBe(100);
    expect(toMillis(1234.567)).toBe(1234567);
    expect(toMillis(0)).toBe(0);
  });

  it("sums exactly where naive float accumulation drifts", () => {
    let acc = 0;
    for (let i = 0; i < 10; i++) acc = addMillis(acc, toMillis(0.1));
    expect(fromMillis(acc)).toBe(1); // 0.1*10 === 1, not 0.9999999999999999

    // The classic drift case the old code suffered from:
    let naive = 0;
    for (let i = 0; i < 10; i++) naive += 0.1;
    expect(naive).not.toBe(1); // demonstrates why we needed this
  });

  it("formats to 12 integer + 3 decimal digits (15 chars)", () => {
    expect(formatMillis(toMillis(1234.5))).toBe("000000001234500");
    expect(formatMillis(toMillis(0))).toBe("000000000000000");
    expect(formatMillis(toMillis(0.001))).toBe("000000000000001");
    expect(formatMillis(toMillis(999999999999.999))).toBe("999999999999999");
    expect(formatMillis(toMillis(1234.5)).length).toBe(15);
  });

  it("uses absolute value when formatting (sign lives in a separate field)", () => {
    expect(formatMillis(toMillis(-12.34))).toBe("000000000012340");
  });

  it("rounds half-up at the 3rd decimal", () => {
    expect(toMillis(1.2345)).toBe(1235);
    expect(toMillis(1.2344)).toBe(1234);
  });
});
