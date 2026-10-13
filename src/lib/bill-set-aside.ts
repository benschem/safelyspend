import { expandForecastRule } from '@/lib/cadence';
import type { ForecastRule } from '@/lib/types';
import { formatISODate } from '@/lib/utils';

/**
 * How much of the cash balance is spoken for by one bill that is not due yet.
 */
export interface BillSetAside {
  ruleId: string;
  description: string;
  categoryId: string | null;
  /** The bill's full amount, due on nextDueDate */
  amountCents: number;
  /** How much of that amount should already be put aside */
  setAsideCents: number;
  nextDueDate: string;
}

// How far either side of a date to look for a bill's due dates. Three years
// reaches the previous and next occurrence of a yearly bill even when one of
// them has been excluded.
const YEARS_TO_SEARCH = 3;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** The same day of the year, a number of years away. Negative goes back. */
function shiftYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatISODate(new Date(year! + years, month! - 1, day));
}

function dayBefore(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatISODate(new Date(year!, month! - 1, day! - 1));
}

/** Whole days from one YYYY-MM-DD date to another. Negative if the end is first. */
function daysBetween(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY);
}

/** Only bills with more than a month between due dates build up a reserve */
function buildsUpBetweenDueDates(forecastRule: ForecastRule): boolean {
  return forecastRule.cadence === 'quarterly' || forecastRule.cadence === 'yearly';
}

/**
 * The day a bill starts building towards its next due date: the latest of its
 * previous due date, the day the rule was created, and the rule's start date.
 *
 * Using the day it was created means a bill added part-way through its cycle
 * is spread over the time that is left, and does not ask for a catch-up on the
 * day it is added.
 */
function buildUpStartDate(forecastRule: ForecastRule, asOfDate: string): string {
  const createdDate = formatISODate(new Date(forecastRule.createdAt));
  const candidates = [createdDate];

  if (forecastRule.startDate) candidates.push(forecastRule.startDate);

  const earlierDueDates = expandForecastRule(
    forecastRule,
    shiftYears(asOfDate, -YEARS_TO_SEARCH),
    dayBefore(asOfDate),
  );
  const previousDueDate = earlierDueDates.at(-1)?.date;
  if (previousDueDate) candidates.push(previousDueDate);

  return candidates.reduce((latest, candidate) => (candidate > latest ? candidate : latest));
}

/**
 * Work out, for each quarterly and yearly bill, how much should already be set
 * aside for its next due date as of a given day.
 *
 * A bill's reserve grows by the day, from nothing at the start of its build-up
 * to the full amount on the day it is due, then starts again. A $900 yearly
 * bill is about $450 six months after it was last due.
 *
 * Weekly, fortnightly and monthly bills are left out. They come round every
 * month, so each month's income already pays for them.
 *
 * Income and savings rules are ignored. A bill past its end date has no next
 * due date and is left out. An excluded occurrence is skipped, so the bill
 * builds towards the one after it.
 *
 * Everything comes from the rules and the date. Nothing is stored and no money
 * moves, so this only knows due dates, not whether a bill has been paid.
 */
export function calculateBillsSetAside(
  forecastRules: ForecastRule[],
  asOfDate: string,
): BillSetAside[] {
  const billsSetAside: BillSetAside[] = [];

  for (const forecastRule of forecastRules) {
    if (forecastRule.type !== 'expense' || !buildsUpBetweenDueDates(forecastRule)) continue;

    const upcomingDueDates = expandForecastRule(
      forecastRule,
      asOfDate,
      shiftYears(asOfDate, YEARS_TO_SEARCH),
    );
    const nextOccurrence = upcomingDueDates[0];
    if (!nextOccurrence) continue;

    const startDate = buildUpStartDate(forecastRule, asOfDate);
    const daysInBuildUp = daysBetween(startDate, nextOccurrence.date);
    const daysElapsed = daysBetween(startDate, asOfDate);

    // A bill created and due on the same day has no build-up: all of it is owed
    const shareElapsed =
      daysInBuildUp > 0 ? Math.min(1, Math.max(0, daysElapsed / daysInBuildUp)) : 1;

    billsSetAside.push({
      ruleId: forecastRule.id,
      description: forecastRule.description,
      categoryId: forecastRule.categoryId,
      amountCents: nextOccurrence.amountCents,
      setAsideCents: Math.round(nextOccurrence.amountCents * shareElapsed),
      nextDueDate: nextOccurrence.date,
    });
  }

  return billsSetAside.sort((earlier, later) =>
    earlier.nextDueDate.localeCompare(later.nextDueDate),
  );
}

/** The total set aside across every bill */
export function sumSetAsideCents(billsSetAside: BillSetAside[]): number {
  return billsSetAside.reduce((sum, billSetAside) => sum + billSetAside.setAsideCents, 0);
}
