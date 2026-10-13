import { describe, it, expect } from 'vitest';
import { sumForecastRulesForPeriod, toPeriodCents } from '@/lib/plan-amounts';
import { toMonthlyCents } from '@/lib/utils';
import type { ForecastRule } from '@/lib/types';

function rule(overrides: Partial<ForecastRule>): ForecastRule {
  return {
    id: 'rule-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    type: 'income',
    description: 'Salary',
    categoryId: null,
    savingsGoalId: null,
    amountCents: 100000,
    cadence: 'monthly',
    ...overrides,
  };
}

describe('toPeriodCents', () => {
  it('leaves an amount alone when the cadence and the period match', () => {
    expect(toPeriodCents(331600, 'fortnightly', 'fortnightly')).toBe(331600);
    expect(toPeriodCents(673600, 'monthly', 'monthly')).toBe(673600);
  });

  it('counts 26 fortnights in a year, never 27', () => {
    expect(toPeriodCents(331600, 'fortnightly', 'yearly')).toBe(331600 * 26);
    expect(toPeriodCents(331600, 'fortnightly', 'monthly')).toBe(718467);
  });

  it('converts each cadence to a monthly average', () => {
    expect(toPeriodCents(10000, 'weekly', 'monthly')).toBe(43333);
    expect(toPeriodCents(30000, 'quarterly', 'monthly')).toBe(10000);
    expect(toPeriodCents(90000, 'yearly', 'monthly')).toBe(7500);
  });

  it('converts a monthly amount to each shorter and longer period', () => {
    expect(toPeriodCents(120000, 'monthly', 'weekly')).toBe(27692);
    expect(toPeriodCents(120000, 'monthly', 'fortnightly')).toBe(55385);
    expect(toPeriodCents(120000, 'monthly', 'quarterly')).toBe(360000);
    expect(toPeriodCents(120000, 'monthly', 'yearly')).toBe(1440000);
  });

  // The default plan's totals use toMonthlyCents, and the Budget page shows
  // the difference between the two. They must agree to the cent.
  it('agrees with toMonthlyCents for every cadence', () => {
    const cadences = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'] as const;

    for (const cadence of cadences) {
      expect(toPeriodCents(331600, cadence, 'monthly')).toBe(toMonthlyCents(331600, cadence));
    }
  });
});

describe('sumForecastRulesForPeriod', () => {
  it('adds a fortnightly pay and a monthly pay into one monthly income', () => {
    const forecastRules = [
      rule({ amountCents: 331600, cadence: 'fortnightly' }),
      rule({ id: 'rule-2', amountCents: 673600, cadence: 'monthly' }),
    ];

    expect(sumForecastRulesForPeriod(forecastRules, 'income', 'monthly')).toBe(718467 + 673600);
  });

  it('counts only rules of the type asked for', () => {
    const forecastRules = [
      rule({ amountCents: 500000 }),
      rule({ id: 'rule-2', type: 'expense', amountCents: 200000 }),
      rule({ id: 'rule-3', type: 'savings', amountCents: 50000 }),
    ];

    expect(sumForecastRulesForPeriod(forecastRules, 'income', 'monthly')).toBe(500000);
    expect(sumForecastRulesForPeriod(forecastRules, 'savings', 'monthly')).toBe(50000);
  });

  it('counts a rule in full whatever its start, end and excluded dates', () => {
    const forecastRules = [
      rule({ startDate: '2030-01-01', endDate: '2030-12-31', excludedDates: ['2030-06-01'] }),
    ];

    expect(sumForecastRulesForPeriod(forecastRules, 'income', 'monthly')).toBe(100000);
  });

  it('is zero when there are no rules of that type', () => {
    expect(sumForecastRulesForPeriod([], 'income', 'monthly')).toBe(0);
    expect(sumForecastRulesForPeriod([rule({})], 'savings', 'monthly')).toBe(0);
  });
});
