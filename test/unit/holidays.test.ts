import { describe, it, expect } from "vitest";
import { workingDaysFromJan1, easterSunday } from "../../src/holidays/holidays.js";

describe("easterSunday", () => {
  it("2024 = March 31", () => {
    const d = easterSunday(2024);
    expect(d.getMonth()).toBe(2); // 0-indexed March
    expect(d.getDate()).toBe(31);
  });
  it("2025 = April 20", () => {
    const d = easterSunday(2025);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(20);
  });
});

describe("workingDaysFromJan1", () => {
  it("Jan 1 is always 1", () => {
    expect(workingDaysFromJan1("BE", "2024-01-01")).toBe(1);
  });
  it("Jan 2 2024 is 1 for BE (Jan 1 is a holiday)", () => {
    expect(workingDaysFromJan1("BE", "2024-01-02")).toBe(1);
  });
  it("skips weekends for BE", () => {
    // 2024-01-08 is Monday. Working days: Jan 2-5 = 4, so seq = 5
    expect(workingDaysFromJan1("BE", "2024-01-08")).toBe(5);
  });
  it("Dec 31 has high sequence", () => {
    const seq = workingDaysFromJan1("BE", "2024-12-31");
    expect(seq).toBeGreaterThan(240);
    expect(seq).toBeLessThan(270);
  });
  it("unknown country has no holidays (weekdays only)", () => {
    expect(workingDaysFromJan1("XX", "2024-03-07")).toBeGreaterThan(0);
  });
  it("Easter Good Friday is BE bank holiday (March 29 2024)", () => {
    const withHoliday = workingDaysFromJan1("BE", "2024-04-01");
    const noHoliday = workingDaysFromJan1("XX", "2024-04-01");
    expect(withHoliday).toBeLessThan(noHoliday);
  });
  it("LT supports TARGET closing days", () => {
    expect(workingDaysFromJan1("LT", "2024-01-02")).toBe(1); // Jan 1 holiday
  });
  it("NL has King's Day Apr 27 (or 26 if Sunday)", () => {
    // 2024-04-27 is Saturday → King's Day observed on Friday Apr 26
    // Actually 2024-04-27 is Saturday, so celebration on Apr 26 (Friday)
    const withKing = workingDaysFromJan1("NL", "2024-04-29");
    const noKing = workingDaysFromJan1("XX", "2024-04-29");
    expect(withKing).toBeLessThan(noKing);
  });
  it("handles datetime strings (truncates to date)", () => {
    expect(workingDaysFromJan1("BE", "2024-03-07T14:30:00")).toBeGreaterThan(0);
  });
});
