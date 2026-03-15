import { easterOffset, formatIso } from "./holidays.js";

/**
 * Belgian public and bank holidays.
 * Source: https://www.febelfin.be/nl/banksluitingsdagen
 *
 * Includes:
 *   Jan 1         New Year's Day
 *   Easter-2      Good Friday (bank holiday)
 *   Easter+1      Easter Monday
 *   May 1         Labour Day
 *   Easter+39     Ascension Day
 *   Easter+40     Ascension Friday (bank holiday)
 *   Easter+50     Pentecost Monday
 *   Jul 21        Belgian National Day
 *   Aug 15        Assumption Day
 *   Nov 1         All Saints' Day
 *   Nov 11        Armistice Day
 *   Dec 25        Christmas Day
 *   Dec 26        Boxing Day (bank holiday)
 */
export function getBelgiumHolidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`, // New Year's Day
    easterOffset(year, -2), // Good Friday
    easterOffset(year, 1), // Easter Monday
    `${year}-05-01`, // Labour Day
    easterOffset(year, 39), // Ascension Day
    easterOffset(year, 40), // Ascension Friday
    easterOffset(year, 50), // Pentecost Monday
    `${year}-07-21`, // Belgian National Day
    `${year}-08-15`, // Assumption Day
    `${year}-11-01`, // All Saints' Day
    `${year}-11-11`, // Armistice Day
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`, // Boxing Day
  ]);
}
