/**
 * Calendar dates.
 *
 * A date is stored as a `YYYY-MM-DD` string and means that day wherever the
 * device is. Everything here works in the device's timezone. Do not build a
 * date string from `toISOString()`, which is UTC, and do not parse one with
 * `new Date('YYYY-MM-DD')`, which reads it as UTC midnight.
 */

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Month names in the order `Date.getMonth()` numbers them, from 0 */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Today's date as YYYY-MM-DD
 */
export function today(): string {
  return formatISODate(new Date());
}

/**
 * Turn a YYYY-MM-DD string into a Date at midnight, local time
 */
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

/**
 * Format a Date as YYYY-MM-DD
 */
export function formatISODate(date: Date): string {
  return `${formatYearMonth(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Format a Date as YYYY-MM
 */
export function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Whole days from one YYYY-MM-DD date to another. Negative when the second
 * date is earlier.
 */
export function daysBetween(fromDate: string, toDate: string): number {
  const milliseconds = parseLocalDate(toDate).getTime() - parseLocalDate(fromDate).getTime();
  // A day that daylight saving starts or ends on is 23 or 25 hours long, so
  // the division is not always whole.
  return Math.round(milliseconds / MILLISECONDS_PER_DAY);
}

/**
 * The YYYY-MM-DD date a number of days after another. A negative number
 * counts back.
 */
export function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

/**
 * Whether a string is YYYY-MM-DD and names a day that exists. `2025-02-31`
 * does not.
 */
export function isRealDate(isoDate: string): boolean {
  if (!ISO_DATE_PATTERN.test(isoDate)) return false;
  // Date rolls a day that does not exist into the next month, so a real date
  // is one that survives the round trip.
  return formatISODate(parseLocalDate(isoDate)) === isoDate;
}
