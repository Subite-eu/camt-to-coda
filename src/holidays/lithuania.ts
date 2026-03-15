import { easterOffset } from "./holidays.js";

/**
 * Lithuanian holidays — TARGET closing days only.
 * Sources:
 *   https://www.ecb.europa.eu/ecb/contacts/working-hours/html/index.en.html
 *   https://www.sepaforcorporates.com/single-euro-payments-area/sepa-target-closing-days
 *
 * Only TARGET2/SEPA closing days are included (not all LT public holidays):
 *   Jan 1         New Year's Day
 *   Easter-2      Good Friday
 *   Easter+1      Easter Monday
 *   May 1         International Workers' Day
 *   Dec 25        Christmas Day
 *   Dec 26        St. Stephen's Day
 */
export function getLithuaniaHolidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`, // New Year's Day
    easterOffset(year, -2), // Good Friday
    easterOffset(year, 1), // Easter Monday
    `${year}-05-01`, // International Workers' Day
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`, // St. Stephen's Day
  ]);
}
