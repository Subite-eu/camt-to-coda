import { easterOffset, formatIso, easterSunday } from "./holidays.js";
import { orthodoxEasterSunday } from "./orthodox-easter.js";

// ── Holiday definition types ─────────────────────────────────────────────────

interface HolidayDef {
  /** Fixed dates as "MM-DD" strings */
  fixed: string[];
  /** Offsets from Western Easter Sunday (e.g., -2 = Good Friday, 1 = Easter Monday) */
  easterOffsets?: number[];
  /** Offsets from Orthodox Easter Sunday (BG, CY, GR, RO) */
  orthodoxOffsets?: number[];
  /** Dynamic holidays requiring computation */
  special?: (year: number) => string[];
}

// ── Helper: first/last weekday of month ──────────────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month - 1, 1);
  let dayOfMonth = 1 + ((weekday - first.getDay() + 7) % 7);
  dayOfMonth += (n - 1) * 7;
  return formatIso(new Date(year, month - 1, dayOfMonth));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const last = new Date(year, month, 0); // last day of month
  const diff = (last.getDay() - weekday + 7) % 7;
  return formatIso(new Date(year, month - 1, last.getDate() - diff));
}

/** Friday before the Saturday falling in Jun 20-26 (Swedish/Finnish midsummer eve) */
function midsummerEve(year: number): string {
  // Midsummer Day (Sweden) = Saturday between Jun 20-26
  // Midsummer Eve = the Friday before
  for (let d = 20; d <= 26; d++) {
    const date = new Date(year, 5, d); // June
    if (date.getDay() === 6) { // Saturday
      return formatIso(new Date(year, 5, d - 1)); // Friday before
    }
  }
  return `${year}-06-19`; // fallback
}

/** Iceland: First Day of Summer = first Thursday on or after April 19 */
function icelandFirstDayOfSummer(year: number): string {
  for (let d = 19; d <= 25; d++) {
    const date = new Date(year, 3, d); // April
    if (date.getDay() === 4) return formatIso(date); // Thursday
  }
  return `${year}-04-19`;
}

/** Netherlands: King's Day = Apr 27 (or Apr 26 if Sunday) */
function dutchKingDay(year: number): string {
  const d = new Date(year, 3, 27);
  if (d.getDay() === 0) return `${year}-04-26`;
  return formatIso(d);
}

// ── EEA country holiday registry ─────────────────────────────────────────────
// Sources: ECB TARGET closing days, national bank calendars, government sites
//
// Easter offsets: -3=Maundy Thu, -2=Good Fri, 0=Easter Sun, 1=Easter Mon,
//                 39=Ascension, 49=Whit Sun, 50=Whit Mon, 60=Corpus Christi

const EEA_HOLIDAYS: Record<string, HolidayDef> = {
  // ── EU member states ───────────────────────────────────────────────────────

  AT: { // Austria
    fixed: ["01-01", "01-06", "05-01", "08-15", "10-26", "11-01", "12-08", "12-25", "12-26"],
    easterOffsets: [1, 39, 50, 60], // Easter Mon, Ascension, Whit Mon, Corpus Christi
  },
  BE: { // Belgium
    fixed: ["01-01", "05-01", "07-21", "08-15", "11-01", "11-11", "12-25", "12-26"],
    easterOffsets: [-2, 1, 39, 40, 50], // Good Fri, Easter Mon, Ascension, Ascension Fri, Whit Mon
  },
  BG: { // Bulgaria — uses Orthodox Easter
    fixed: ["01-01", "03-03", "05-01", "05-06", "05-24", "09-06", "09-22", "12-24", "12-25", "12-26"],
    orthodoxOffsets: [-2, 0, 1], // Good Fri, Easter Sun, Easter Mon
  },
  HR: { // Croatia
    fixed: ["01-01", "01-06", "05-01", "05-30", "06-22", "08-05", "08-15", "11-01", "11-18", "12-25", "12-26"],
    easterOffsets: [1, 60], // Easter Mon, Corpus Christi
  },
  CY: { // Cyprus — uses Orthodox Easter
    fixed: ["01-01", "01-06", "03-25", "04-01", "05-01", "08-15", "10-01", "10-28", "12-25", "12-26"],
    orthodoxOffsets: [-48, -2, 1, 50], // Clean Monday, Good Fri, Easter Mon, Whit Mon
  },
  CZ: { // Czech Republic
    fixed: ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"],
    easterOffsets: [-2, 1], // Good Fri, Easter Mon
  },
  DK: { // Denmark
    fixed: ["01-01", "06-05", "12-24", "12-25", "12-26"],
    easterOffsets: [-3, -2, 1, 39, 50], // Maundy Thu, Good Fri, Easter Mon, Ascension, Whit Mon
  },
  EE: { // Estonia
    fixed: ["01-01", "02-24", "05-01", "06-23", "06-24", "08-20", "12-24", "12-25", "12-26"],
    easterOffsets: [-2, 0, 49], // Good Fri, Easter Sun, Whit Sun
  },
  FI: { // Finland
    fixed: ["01-01", "01-06", "05-01", "12-06", "12-24", "12-25", "12-26"],
    easterOffsets: [-2, 1, 39], // Good Fri, Easter Mon, Ascension
    special: (year) => [midsummerEve(year)],
  },
  FR: { // France
    fixed: ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"],
    easterOffsets: [1, 39, 50], // Easter Mon, Ascension, Whit Mon
  },
  DE: { // Germany
    fixed: ["01-01", "05-01", "10-03", "12-25", "12-26"],
    easterOffsets: [-2, 1, 39, 50], // Good Fri, Easter Mon, Ascension, Whit Mon
  },
  GR: { // Greece — uses Orthodox Easter
    fixed: ["01-01", "01-06", "03-25", "05-01", "08-15", "10-28", "12-25", "12-26"],
    orthodoxOffsets: [-48, -2, 1, 50], // Clean Monday, Good Fri, Easter Mon, Whit Mon
  },
  HU: { // Hungary
    fixed: ["01-01", "03-15", "05-01", "08-20", "10-23", "11-01", "12-25", "12-26"],
    easterOffsets: [-2, 1, 50], // Good Fri, Easter Mon, Whit Mon
  },
  IE: { // Ireland
    fixed: ["01-01", "03-17", "12-25", "12-26"],
    easterOffsets: [1], // Easter Mon
    special: (year) => [
      nthWeekdayOfMonth(year, 5, 1, 1),  // May first Monday
      nthWeekdayOfMonth(year, 6, 1, 1),  // June first Monday
      nthWeekdayOfMonth(year, 8, 1, 1),  // August first Monday
      lastWeekdayOfMonth(year, 10, 1),   // October last Monday
    ],
  },
  IT: { // Italy
    fixed: ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
    easterOffsets: [1], // Easter Mon
  },
  LV: { // Latvia
    fixed: ["01-01", "05-01", "05-04", "06-23", "06-24", "11-18", "12-24", "12-25", "12-26", "12-31"],
    easterOffsets: [-2, 1], // Good Fri, Easter Mon
  },
  LT: { // Lithuania — TARGET2 closing days
    fixed: ["01-01", "05-01", "12-25", "12-26"],
    easterOffsets: [-2, 1], // Good Fri, Easter Mon
  },
  LU: { // Luxembourg
    fixed: ["01-01", "05-01", "06-23", "08-15", "11-01", "12-25", "12-26"],
    easterOffsets: [1, 39, 50], // Easter Mon, Ascension, Whit Mon
  },
  MT: { // Malta
    fixed: ["01-01", "02-10", "03-19", "03-31", "05-01", "06-07", "06-29", "08-15", "09-08", "09-21", "12-08", "12-13", "12-25"],
    easterOffsets: [-2], // Good Fri
  },
  NL: { // Netherlands
    fixed: ["01-01", "05-05", "12-25", "12-26"],
    easterOffsets: [-2, 1, 39, 50], // Good Fri, Easter Mon, Ascension, Whit Mon
    special: (year) => [dutchKingDay(year)],
  },
  PL: { // Poland
    fixed: ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26"],
    easterOffsets: [1, 60], // Easter Mon, Corpus Christi
  },
  PT: { // Portugal
    fixed: ["01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25"],
    easterOffsets: [-2, 0, 60], // Good Fri, Easter Sun, Corpus Christi
  },
  RO: { // Romania — uses Orthodox Easter
    fixed: ["01-01", "01-02", "01-24", "05-01", "06-01", "08-15", "11-30", "12-01", "12-25", "12-26"],
    orthodoxOffsets: [-2, 0, 1, 50], // Good Fri, Easter Sun, Easter Mon, Whit Mon
  },
  SK: { // Slovakia
    fixed: ["01-01", "01-06", "05-01", "05-08", "07-05", "08-29", "09-01", "09-15", "11-01", "11-17", "12-24", "12-25", "12-26"],
    easterOffsets: [-2, 1], // Good Fri, Easter Mon
  },
  SI: { // Slovenia
    fixed: ["01-01", "01-02", "02-08", "04-27", "05-01", "05-02", "06-25", "08-15", "10-31", "11-01", "12-25", "12-26"],
    easterOffsets: [1], // Easter Mon
  },
  ES: { // Spain
    fixed: ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"],
    easterOffsets: [-2], // Good Fri
  },
  SE: { // Sweden
    fixed: ["01-01", "01-06", "05-01", "06-06", "12-24", "12-25", "12-26"],
    easterOffsets: [-2, 1, 39], // Good Fri, Easter Mon, Ascension
    special: (year) => [midsummerEve(year)],
  },

  // ── EEA non-EU members ─────────────────────────────────────────────────────

  IS: { // Iceland
    fixed: ["01-01", "05-01", "06-17", "12-24", "12-25", "12-26", "12-31"],
    easterOffsets: [-3, -2, 1, 39, 50], // Maundy Thu, Good Fri, Easter Mon, Ascension, Whit Mon
    special: (year) => [
      icelandFirstDayOfSummer(year),
      nthWeekdayOfMonth(year, 8, 1, 1), // Commerce Day: August first Monday
    ],
  },
  LI: { // Liechtenstein
    fixed: ["01-01", "01-02", "01-06", "02-02", "03-19", "05-01", "08-15", "09-08", "11-01", "12-08", "12-24", "12-25", "12-26", "12-31"],
    easterOffsets: [-47, -2, 1, 39, 50, 60], // Shrove Tue, Good Fri, Easter Mon, Ascension, Whit Mon, Corpus Christi
  },
  NO: { // Norway
    fixed: ["01-01", "05-01", "05-17", "12-25", "12-26"],
    easterOffsets: [-3, -2, 1, 39, 50], // Maundy Thu, Good Fri, Easter Mon, Ascension, Whit Mon
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

function orthodoxEasterOffset(year: number, offsetDays: number): string {
  const d = orthodoxEasterSunday(year);
  d.setDate(d.getDate() + offsetDays);
  return formatIso(d);
}

/**
 * Returns the set of bank holidays for any EEA country.
 * Returns null if the country is not in the registry.
 */
export function getEeaHolidays(country: string, year: number): Set<string> | null {
  const def = EEA_HOLIDAYS[country.toUpperCase()];
  if (!def) return null;

  const dates: string[] = [];

  // Fixed dates
  for (const md of def.fixed) {
    dates.push(`${year}-${md}`);
  }

  // Western Easter offsets
  if (def.easterOffsets) {
    for (const offset of def.easterOffsets) {
      dates.push(easterOffset(year, offset));
    }
  }

  // Orthodox Easter offsets
  if (def.orthodoxOffsets) {
    for (const offset of def.orthodoxOffsets) {
      dates.push(orthodoxEasterOffset(year, offset));
    }
  }

  // Special computed holidays
  if (def.special) {
    dates.push(...def.special(year));
  }

  return new Set(dates);
}

/** List of all supported EEA country codes */
export const EEA_COUNTRIES = Object.keys(EEA_HOLIDAYS).sort();
