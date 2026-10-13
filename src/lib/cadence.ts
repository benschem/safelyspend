import type { ExpandedForecast, ForecastRule } from '@/lib/types';
import { formatISODate, parseLocalDate } from '@/lib/dates';
import { getLastDayOfMonth } from '@/lib/utils';

/**
 * Expand a forecast rule into its dated occurrences between two dates
 * (inclusive).
 *
 * The rule's own start and end dates narrow the range, and any date in its
 * `excludedDates` is left out. An empty string counts as no date, because
 * imported data can hold one.
 *
 * A day of the month that a month does not have falls on that month's last
 * day, so a rule for the 31st lands on 28 February.
 */
export function expandForecastRule(
  rule: ForecastRule,
  rangeStart: string,
  rangeEnd: string,
): ExpandedForecast[] {
  const results: ExpandedForecast[] = [];

  // Determine effective start/end for the rule
  const effectiveStart =
    rule.startDate && rule.startDate > rangeStart ? rule.startDate : rangeStart;
  const effectiveEnd = rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) return results;

  // Parse as local dates to avoid timezone issues with date comparisons
  const start = parseLocalDate(effectiveStart);
  const end = parseLocalDate(effectiveEnd);

  // Build a Set of excluded dates for fast lookup
  const excludedSet = new Set(rule.excludedDates ?? []);

  switch (rule.cadence) {
    case 'weekly': {
      const targetDay = rule.dayOfWeek ?? 0;
      const current = new Date(start);
      // Move to first occurrence of target day
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      while (current <= end) {
        results.push({
          type: rule.type,
          date: formatISODate(current),
          amountCents: rule.amountCents,
          description: rule.description,
          categoryId: rule.categoryId,
          savingsGoalId: rule.savingsGoalId,
          sourceType: 'rule',
          sourceId: rule.id,
        });
        current.setDate(current.getDate() + 7);
      }
      break;
    }

    case 'fortnightly': {
      const targetDay = rule.dayOfWeek ?? 0;
      // Anchor the fortnightly cadence to the rule's own startDate so that
      // generated dates are consistent regardless of the query range.
      // Without this, querying Jan-Dec vs Mar-Mar produces different
      // fortnightly alignments within the same calendar month.
      const anchor = rule.startDate ? parseLocalDate(rule.startDate) : new Date(2020, 0, 1);
      const current = new Date(anchor);
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      // Skip forward to the effective start of the query range
      while (current < start) {
        current.setDate(current.getDate() + 14);
      }
      while (current <= end) {
        results.push({
          type: rule.type,
          date: formatISODate(current),
          amountCents: rule.amountCents,
          description: rule.description,
          categoryId: rule.categoryId,
          savingsGoalId: rule.savingsGoalId,
          sourceType: 'rule',
          sourceId: rule.id,
        });
        current.setDate(current.getDate() + 14);
      }
      break;
    }

    case 'monthly': {
      const targetDay = rule.dayOfMonth ?? 1;
      let year = start.getFullYear();
      let month = start.getMonth();

      while (true) {
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      break;
    }

    case 'quarterly': {
      const targetDay = rule.dayOfMonth ?? 1;
      const monthOffset = rule.monthOfQuarter ?? 0; // 0 = 1st month, 1 = 2nd month, 2 = 3rd month
      let year = start.getFullYear();
      let quarter = Math.floor(start.getMonth() / 3);

      while (true) {
        // Calculate the target month within the quarter
        const month = quarter * 3 + monthOffset;
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
        }

        quarter++;
        if (quarter > 3) {
          quarter = 0;
          year++;
        }
      }
      break;
    }

    case 'yearly': {
      const targetDay = rule.dayOfMonth ?? 1;
      const targetMonth = rule.monthOfYear ?? 0; // 0 = January, 11 = December
      let year = start.getFullYear();

      while (true) {
        const lastDay = getLastDayOfMonth(year, targetMonth);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, targetMonth, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
        }

        year++;
      }
      break;
    }
  }

  // Filter out excluded dates
  return results.filter((forecast) => !excludedSet.has(forecast.date));
}

/**
 * Every day a form can ask for when scheduling a rule. A saved rule keeps only
 * the ones its cadence uses: see `scheduleDaysForCadence`.
 */
export interface ScheduleDays {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayOfMonth: number; // 1-31
  monthOfYear: number; // 0-11 (Jan-Dec)
  monthOfQuarter: number; // 0-2
}

/** What a form starts on for a new rule: Monday, the 1st, January, first month */
export const DEFAULT_SCHEDULE_DAYS: ScheduleDays = {
  dayOfWeek: 1,
  dayOfMonth: 1,
  monthOfYear: 0,
  monthOfQuarter: 0,
};

/** A rule's days for editing, with the form's default for any it does not store */
export function scheduleDaysOf(
  rule: Pick<ForecastRule, 'dayOfWeek' | 'dayOfMonth' | 'monthOfYear' | 'monthOfQuarter'>,
): ScheduleDays {
  return {
    dayOfWeek: rule.dayOfWeek ?? DEFAULT_SCHEDULE_DAYS.dayOfWeek,
    dayOfMonth: rule.dayOfMonth ?? DEFAULT_SCHEDULE_DAYS.dayOfMonth,
    monthOfYear: rule.monthOfYear ?? DEFAULT_SCHEDULE_DAYS.monthOfYear,
    monthOfQuarter: rule.monthOfQuarter ?? DEFAULT_SCHEDULE_DAYS.monthOfQuarter,
  };
}

/**
 * The day fields a rule of this cadence stores: a weekday for weekly and
 * fortnightly, a day of the month for the rest, plus the month for yearly and
 * the month of the quarter for quarterly.
 */
export function scheduleDaysForCadence(
  cadence: ForecastRule['cadence'],
  days: ScheduleDays,
): Partial<ScheduleDays> {
  switch (cadence) {
    case 'weekly':
    case 'fortnightly':
      return { dayOfWeek: days.dayOfWeek };
    case 'monthly':
      return { dayOfMonth: days.dayOfMonth };
    case 'quarterly':
      return { dayOfMonth: days.dayOfMonth, monthOfQuarter: days.monthOfQuarter };
    case 'yearly':
      return { dayOfMonth: days.dayOfMonth, monthOfYear: days.monthOfYear };
  }
}
