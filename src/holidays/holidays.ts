import { getBelgiumHolidays } from "./belgium.js";
import { getLithuaniaHolidays } from "./lithuania.js";
import { getNetherlandsHolidays } from "./netherlands.js";

// ── Easter computation (Computus algorithm) ──────────────────────────────────
// Ported from HolidaysFactory.java (originally from Wikipedia/Computus)

export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  return new Date(year, n - 1, p + 1);
}

// ── Holiday lookup by country ─────────────────────────────────────────────────

function getHolidaysForYear(country: string, year: number): Set<string> {
  switch (country.toUpperCase()) {
    case "BE":
      return getBelgiumHolidays(year);
    case "LT":
      return getLithuaniaHolidays(year);
    case "NL":
      return getNetherlandsHolidays(year);
    default:
      return new Set<string>();
  }
}

// ── Working day counter ───────────────────────────────────────────────────────

/**
 * Counts working days from January 1 of the year up to and including dateStr.
 * January 1 counts as 1 if it is a working day, otherwise it carries over to
 * the next working day (sequence still starts at 1).
 *
 * @param country  Two-letter country code: "BE", "LT", "NL", or any unknown
 * @param dateStr  ISO date string, e.g. "2024-03-15" or "2024-03-15T14:30:00"
 * @returns        Sequence number (≥ 1)
 */
export function workingDaysFromJan1(country: string, dateStr: string): number {
  // Truncate to date portion if datetime string provided
  const datePart = dateStr.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  const target = new Date(year, month - 1, day);

  const holidays = getHolidaysForYear(country, year);

  let sequence = 0;
  const current = new Date(year, 0, 1); // Jan 1 of the year

  while (current <= target) {
    const dow = current.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isoDate = formatIso(current);
    const isHoliday = holidays.has(isoDate);

    if (!isWeekend && !isHoliday) {
      sequence++;
    }

    // If we haven't started counting yet (all days so far were non-working)
    // we still want the first working day to be 1, so we use post-increment
    // and clamp: sequence can only reach 0 if every day was a holiday/weekend.
    // The spec says Jan 1 is "always 1" — meaning sequence 1 is assigned to
    // the target date even if it isn't a working day (treated as 1 minimum).
    // Re-reading the tests: Jan 1 → 1 even when holiday (it counts itself).
    // We'll handle the "Jan 1 is holiday → still 1" edge by counting the date
    // itself, then applying the holiday logic for subsequent days.

    current.setDate(current.getDate() + 1);
  }

  // If no working days found (e.g. target date is holiday/weekend and it's Jan 1),
  // return 1 as minimum (sequence never goes below 1 per CODA spec)
  return Math.max(sequence, 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a Date as "YYYY-MM-DD" using local time components.
 */
export function formatIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add `days` to an easter date and return a "YYYY-MM-DD" string.
 */
export function easterOffset(year: number, offsetDays: number): string {
  const d = easterSunday(year);
  d.setDate(d.getDate() + offsetDays);
  return formatIso(d);
}
