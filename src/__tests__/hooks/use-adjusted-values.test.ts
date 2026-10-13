import { describe, it, expect } from 'vitest';
import { adjustForecasts } from '@/hooks/use-adjusted-values';
import type { ExpandedForecast, ForecastRule } from '@/lib/types';

function rule(overrides: Partial<ForecastRule>): ForecastRule {
  return {
    id: 'salary',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    type: 'income',
    description: 'Salary',
    categoryId: null,
    savingsGoalId: null,
    amountCents: 100000,
    cadence: 'fortnightly',
    ...overrides,
  };
}

function forecast(overrides: Partial<ExpandedForecast>): ExpandedForecast {
  return {
    type: 'income',
    date: '2026-10-01',
    amountCents: 100000,
    description: 'Salary',
    categoryId: null,
    savingsGoalId: null,
    sourceType: 'rule',
    sourceId: 'salary',
    ...overrides,
  };
}

function amountsOf(forecasts: ExpandedForecast[]): number[] {
  return forecasts.map((item) => item.amountCents);
}

describe('adjustForecasts', () => {
  it('returns every forecast unchanged when there are no adjustments', () => {
    const forecasts = [forecast({}), forecast({ date: '2026-10-15' })];

    expect(adjustForecasts(forecasts, {}, [rule({})])).toEqual(forecasts);
  });

  it('scales every forecast of an adjusted rule by the same ratio as the rule', () => {
    const adjusted = adjustForecasts(
      [forecast({}), forecast({ date: '2026-10-15' })],
      { salary: 150000 },
      [rule({})],
    );

    expect(amountsOf(adjusted)).toEqual([150000, 150000]);
  });

  it('scales a forecast whose amount differs from its rule in proportion', () => {
    const adjusted = adjustForecasts([forecast({ amountCents: 50000 })], { salary: 150000 }, [
      rule({}),
    ]);

    expect(amountsOf(adjusted)).toEqual([75000]);
  });

  it('leaves the forecasts of other rules alone', () => {
    const adjusted = adjustForecasts(
      [forecast({}), forecast({ sourceId: 'side-job', amountCents: 20000 })],
      { salary: 150000 },
      [rule({}), rule({ id: 'side-job', amountCents: 20000 })],
    );

    expect(amountsOf(adjusted)).toEqual([150000, 20000]);
  });

  it('leaves interest alone, even when its source id matches an adjustment', () => {
    const interest = forecast({
      type: 'savings',
      amountCents: 5000,
      sourceType: 'interest',
      sourceId: 'holiday',
      savingsGoalId: 'holiday',
    });

    const adjusted = adjustForecasts([interest], { holiday: 99999 }, []);

    expect(adjusted).toEqual([interest]);
  });

  it('takes the adjusted amount outright when the rule had no amount to scale from', () => {
    const adjusted = adjustForecasts([forecast({ amountCents: 0 })], { salary: 150000 }, [
      rule({ amountCents: 0 }),
    ]);

    expect(amountsOf(adjusted)).toEqual([150000]);
  });

  it('takes the adjusted amount outright when the original rule cannot be found', () => {
    const adjusted = adjustForecasts([forecast({})], { salary: 150000 }, []);

    expect(amountsOf(adjusted)).toEqual([150000]);
  });

  it('does not change the forecasts it was given', () => {
    const original = forecast({});

    adjustForecasts([original], { salary: 150000 }, [rule({})]);

    expect(original.amountCents).toBe(100000);
  });
});
