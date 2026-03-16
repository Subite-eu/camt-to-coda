/**
 * Julian/Orthodox Easter computation (Meeus algorithm).
 * Returns the Gregorian calendar date for Orthodox Easter Sunday.
 */
export function orthodoxEasterSunday(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3=March, 4=April
  const day = ((d + e + 114) % 31) + 1;

  // Convert from Julian to Gregorian: add 13 days for 1900-2099
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}
