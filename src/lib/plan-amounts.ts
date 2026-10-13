import type { Cadence, ForecastRule, ForecastType } from '@/lib/types';

const OCCURRENCES_PER_YEAR: Record<Cadence, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/**
 * Convert an amount paid at one cadence into the average amount for another
 * period, by way of a year: $100 a fortnight is $2,600 a year, so $216.67 a
 * month.
 *
 * This is an average, which is what a plan wants. It takes no dates on
 * purpose: counting the real pay dates in a window gives 27 fortnights in some
 * twelve-month windows and 26 in others, so the same pay would be worth a
 * different monthly amount depending on the day it was looked at.
 */
export function toPeriodCents(amountCents: number, cadence: Cadence, period: Cadence): number {
  const yearlyCents = amountCents * OCCURRENCES_PER_YEAR[cadence];
  return Math.round(yearlyCents / OCCURRENCES_PER_YEAR[period]);
}

/**
 * What every forecast rule of one type comes to over a period, from each
 * rule's amount and cadence alone.
 *
 * Only rules count. Interest forecast for a savings goal is not a rule, so it
 * is never part of planned savings: it is money the bank adds, not money set
 * aside from income.
 *
 * A rule's start date, end date and excluded dates are ignored, as they are
 * for bills on the Budget page and for the default plan's totals.
 */
export function sumForecastRulesForPeriod(
  forecastRules: ForecastRule[],
  type: ForecastType,
  period: Cadence,
): number {
  return forecastRules
    .filter((forecastRule) => forecastRule.type === type)
    .reduce(
      (sum, forecastRule) =>
        sum + toPeriodCents(forecastRule.amountCents, forecastRule.cadence, period),
      0,
    );
}
