import type { ExpandedForecast, ForecastRule } from '@/lib/types';
import { formatISODate, getLastDayOfMonth } from '@/lib/utils';

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC)
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

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
