import { describe, it, expect } from 'vitest';
import { groupForecastsByType } from '@/hooks/use-forecasts';
import type { ExpandedForecast, SavingsGoal, Transaction } from '@/lib/types';

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Mid-month to mid-month, so the range holds exactly one month end (31 October)
const RANGE_START = '2026-10-15';
const RANGE_END = '2026-11-15';

function forecast(overrides: Partial<ExpandedForecast>): ExpandedForecast {
  return {
    type: 'savings',
    date: '2026-10-20',
    amountCents: 50000,
    description: 'Holiday fund',
    categoryId: null,
    savingsGoalId: 'holiday',
    sourceType: 'rule',
    sourceId: 'rule-1',
    ...overrides,
  };
}

function savingsGoal(overrides: Partial<SavingsGoal>): SavingsGoal {
  return {
    ...BASE_FIELDS,
    id: 'holiday',
    name: 'Holiday',
    targetAmountCents: 2000000,
    ...overrides,
  };
}

/** A deposit made before the range starts, so it is the goal's opening balance */
function earlierDeposit(amountCents: number): Transaction {
  return {
    ...BASE_FIELDS,
    id: 'deposit-1',
    type: 'savings',
    date: '2026-09-01',
    amountCents,
    description: 'Holiday fund',
    categoryId: null,
    savingsGoalId: 'holiday',
  };
}

describe('groupForecastsByType', () => {
  it('splits dated forecasts into income, bills and savings contributions', () => {
    const grouped = groupForecastsByType(
      [
        forecast({ type: 'income', amountCents: 331600, savingsGoalId: null }),
        forecast({ type: 'expense', amountCents: 220000, savingsGoalId: null }),
        forecast({ amountCents: 50000 }),
      ],
      [],
      [],
      RANGE_START,
      RANGE_END,
    );

    expect(grouped.incomeForecasts.map((item) => item.amountCents)).toEqual([331600]);
    expect(grouped.expenseForecasts.map((item) => item.amountCents)).toEqual([220000]);
    expect(grouped.savingsForecasts.map((item) => item.amountCents)).toEqual([50000]);
    expect(grouped.interestForecasts).toEqual([]);
  });

  it('forecasts a month of interest on a goal that has a balance and a rate', () => {
    const grouped = groupForecastsByType(
      [],
      [savingsGoal({ annualInterestRate: 6 })],
      [earlierDeposit(1000000)],
      RANGE_START,
      RANGE_END,
    );

    // $10,000 at 6% a year is $50 for the month
    expect(grouped.interestForecasts).toHaveLength(1);
    expect(grouped.interestForecasts[0]).toMatchObject({
      date: '2026-10-31',
      amountCents: 5000,
      savingsGoalId: 'holiday',
      sourceType: 'interest',
    });
  });

  it('keeps interest out of the savings contributions', () => {
    const grouped = groupForecastsByType(
      [forecast({ amountCents: 50000 })],
      [savingsGoal({ annualInterestRate: 6 })],
      [earlierDeposit(1000000)],
      RANGE_START,
      RANGE_END,
    );

    expect(grouped.interestForecasts.length).toBeGreaterThan(0);
    expect(grouped.savingsForecasts).toHaveLength(1);
    expect(grouped.savingsForecasts.every((item) => item.sourceType === 'rule')).toBe(true);

    const plannedSavingsCents = grouped.savingsForecasts.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    expect(plannedSavingsCents).toBe(50000);
  });

  it('forecasts no interest for a goal without a rate', () => {
    const grouped = groupForecastsByType(
      [],
      [savingsGoal({})],
      [earlierDeposit(1000000)],
      RANGE_START,
      RANGE_END,
    );

    expect(grouped.interestForecasts).toEqual([]);
  });

  it('forecasts no interest when there is no date range', () => {
    const grouped = groupForecastsByType(
      [],
      [savingsGoal({ annualInterestRate: 6 })],
      [earlierDeposit(1000000)],
    );

    expect(grouped.interestForecasts).toEqual([]);
  });
});
