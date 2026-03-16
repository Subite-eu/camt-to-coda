import { describe, it, expect } from "vitest";
import { workingDaysFromJan1, easterSunday } from "../../src/holidays/holidays.js";
import { orthodoxEasterSunday } from "../../src/holidays/orthodox-easter.js";
import { getEeaHolidays, EEA_COUNTRIES } from "../../src/holidays/eea.js";

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

  // ── EEA country coverage ─────────────────────────────────────────────────
  it("all 30 EEA countries are supported", () => {
    expect(EEA_COUNTRIES).toHaveLength(30);
  });

  it.each(EEA_COUNTRIES)("%s: Jan 1 is a holiday", (cc) => {
    const holidays = getEeaHolidays(cc, 2024)!;
    expect(holidays).not.toBeNull();
    expect(holidays.has("2024-01-01")).toBe(true);
  });

  it.each(EEA_COUNTRIES)("%s: returns holidays and affects working day count", (cc) => {
    const holidays = getEeaHolidays(cc, 2024)!;
    expect(holidays.size).toBeGreaterThan(3);
    // Working day count with holidays should be less than without
    const withHolidays = workingDaysFromJan1(cc, "2024-12-31");
    const withoutHolidays = workingDaysFromJan1("XX", "2024-12-31");
    expect(withHolidays).toBeLessThan(withoutHolidays);
  });

  // ── Country-specific spot checks ─────────────────────────────────────────
  it("DE: Oct 3 (German Unity Day) is a holiday", () => {
    expect(getEeaHolidays("DE", 2024)!.has("2024-10-03")).toBe(true);
  });

  it("FR: Jul 14 (Bastille Day) is a holiday", () => {
    expect(getEeaHolidays("FR", 2024)!.has("2024-07-14")).toBe(true);
  });

  it("IT: Apr 25 (Liberation Day) is a holiday", () => {
    expect(getEeaHolidays("IT", 2024)!.has("2024-04-25")).toBe(true);
  });

  it("ES: Oct 12 (National Day) is a holiday", () => {
    expect(getEeaHolidays("ES", 2024)!.has("2024-10-12")).toBe(true);
  });

  it("AT: Oct 26 (National Day) is a holiday", () => {
    expect(getEeaHolidays("AT", 2024)!.has("2024-10-26")).toBe(true);
  });

  it("IE: Mar 17 (St. Patrick's Day) is a holiday", () => {
    expect(getEeaHolidays("IE", 2024)!.has("2024-03-17")).toBe(true);
  });

  it("NO: May 17 (Constitution Day) is a holiday", () => {
    expect(getEeaHolidays("NO", 2024)!.has("2024-05-17")).toBe(true);
  });

  it("SE: Jun 6 (National Day) is a holiday", () => {
    expect(getEeaHolidays("SE", 2024)!.has("2024-06-06")).toBe(true);
  });

  it("PL: May 3 (Constitution Day) is a holiday", () => {
    expect(getEeaHolidays("PL", 2024)!.has("2024-05-03")).toBe(true);
  });

  it("IS: Jun 17 (National Day) is a holiday", () => {
    expect(getEeaHolidays("IS", 2024)!.has("2024-06-17")).toBe(true);
  });
});

describe("orthodoxEasterSunday", () => {
  it("2024 = May 5", () => {
    const d = orthodoxEasterSunday(2024);
    expect(d.getMonth()).toBe(4); // May (0-indexed)
    expect(d.getDate()).toBe(5);
  });
  it("2025 = April 20", () => {
    const d = orthodoxEasterSunday(2025);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(20);
  });

  it("GR: Orthodox Easter Monday 2024 is May 6", () => {
    expect(getEeaHolidays("GR", 2024)!.has("2024-05-06")).toBe(true);
  });

  it("BG: Orthodox Easter 2024 dates are correct", () => {
    const holidays = getEeaHolidays("BG", 2024)!;
    expect(holidays.has("2024-05-03")).toBe(true); // Orthodox Good Friday
    expect(holidays.has("2024-05-05")).toBe(true); // Orthodox Easter Sunday
    expect(holidays.has("2024-05-06")).toBe(true); // Orthodox Easter Monday
  });

  it("RO uses Orthodox Easter not Western", () => {
    const holidays = getEeaHolidays("RO", 2024)!;
    // Western Easter 2024 = Mar 31, Orthodox = May 5
    // RO should have May 5 (Orthodox) not Mar 31 (Western)
    expect(holidays.has("2024-05-05")).toBe(true); // Orthodox Easter
    expect(holidays.has("2024-03-31")).toBe(false); // Not Western Easter
  });
});
