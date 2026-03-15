import { easterOffset, formatIso } from "./holidays.js";

/**
 * Dutch public and bank holidays.
 * Source: https://www.officeholidays.com/countries/netherlands
 *
 * Includes:
 *   Jan 1         New Year's Day
 *   Easter-2      Good Friday (bank holiday)
 *   Easter+1      Easter Monday
 *   Apr 27        King's Day (or Apr 26 if Apr 27 is a Sunday)
 *   May 5         Liberation Day
 *   Easter+39     Ascension Day
 *   Easter+50     Pentecost Monday
 *   Dec 25        Christmas Day
 *   Dec 26        Boxing Day (bank holiday)
 */
export function getNetherlandsHolidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`, // New Year's Day
    easterOffset(year, -2), // Good Friday
    easterOffset(year, 1), // Easter Monday
    dutchKingDay(year), // King's Day
    `${year}-05-05`, // Liberation Day
    easterOffset(year, 39), // Ascension Day
    easterOffset(year, 50), // Pentecost Monday
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`, // Boxing Day
  ]);
}

/**
 * King's Day is April 27. If April 27 falls on a Sunday, it is observed on
 * Saturday April 26 instead.
 */
function dutchKingDay(year: number): string {
  const kingDay = new Date(year, 3, 27); // April 27
  if (kingDay.getDay() === 0) {
    // Sunday → observe on Saturday April 26
    return `${year}-04-26`;
  }
  return formatIso(kingDay);
}
