import { describe, it, expect } from 'vitest';
import {
  buildMonthlyLimitsByCategory,
  isRuleActiveBetween,
  sumMonthlyAllowanceCents,
} from '@/lib/category-limits';
import type { BudgetRule, ForecastRule } from '@/lib/types';

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  scenarioId: 'scenario-1',
};

const MONTH_START = '2026-10-01';
const MONTH_END = '2026-10-31';

function allowance(overrides: Partial<BudgetRule>): BudgetRule {
  return {
    ...BASE_FIELDS,
    id: 'allowance-1',
    categoryId: 'entertainment',
    amountCents: 10000,
    cadence: 'monthly',
    ...overrides,
  };
}

function bill(overrides: Partial<ForecastRule>): ForecastRule {
  return {
    ...BASE_FIELDS,
    id: 'bill-1',
    type: 'expense',
    description: 'Netflix',
    categoryId: 'entertainment',
    savingsGoalId: null,
    amountCents: 2100,
    cadence: 'monthly',
    ...overrides,
  };
}

describe('buildMonthlyLimitsByCategory', () => {
  it('uses the allowance alone when a category has no bills', () => {
    const limits = buildMonthlyLimitsByCategory([allowance({})], [], MONTH_START, MONTH_END);

    expect(limits['entertainment']).toEqual({
      billsCents: 0,
      allowanceCents: 10000,
      totalCents: 10000,
    });
  });

  it('uses the bills alone when a category has no allowance', () => {
    const limits = buildMonthlyLimitsByCategory([], [bill({})], MONTH_START, MONTH_END);

    expect(limits['entertainment']).toEqual({
      billsCents: 2100,
      allowanceCents: 0,
      totalCents: 2100,
    });
  });

  it('adds bills to the allowance when a category has both', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({})],
      [bill({})],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 2100,
      allowanceCents: 10000,
      totalCents: 12100,
    });
  });

  it('adds up several bills in one category', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({}), bill({ id: 'bill-2', description: 'Spotify', amountCents: 1300 })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.billsCents).toBe(3400);
  });

  it('adds up several allowances in one category', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({}), allowance({ id: 'allowance-2', amountCents: 5000 })],
      [],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 0,
      allowanceCents: 15000,
      totalCents: 15000,
    });
  });

  it('averages an allowance to a monthly figure whatever its cadence', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({ amountCents: 12000, cadence: 'weekly' })],
      [],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.allowanceCents).toBe(52000);
  });

  it('counts a quarterly bill in full in the month it falls due', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ amountCents: 30000, cadence: 'quarterly', monthOfQuarter: 0, dayOfMonth: 15 })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.billsCents).toBe(30000);
  });

  it('counts nothing for a quarterly bill in a month it is not due', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ amountCents: 30000, cadence: 'quarterly', monthOfQuarter: 1, dayOfMonth: 15 })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits).toEqual({});
  });

  it('counts a yearly bill only in the month it falls due', () => {
    const MARCH = 2;
    const registration = bill({
      description: 'Car registration',
      categoryId: 'car',
      amountCents: 90000,
      cadence: 'yearly',
      monthOfYear: MARCH,
      dayOfMonth: 10,
    });

    const october = buildMonthlyLimitsByCategory([], [registration], MONTH_START, MONTH_END);
    const march = buildMonthlyLimitsByCategory([], [registration], '2027-03-01', '2027-03-31');

    expect(october).toEqual({});
    expect(march['car']?.billsCents).toBe(90000);
  });

  it('counts each payment of a weekly bill that falls in the month', () => {
    const THURSDAY = 4;
    const weeklyBill = bill({ amountCents: 1000, cadence: 'weekly', dayOfWeek: THURSDAY });

    // October 2026 has five Thursdays and November has four
    const october = buildMonthlyLimitsByCategory([], [weeklyBill], MONTH_START, MONTH_END);
    const november = buildMonthlyLimitsByCategory([], [weeklyBill], '2026-11-01', '2026-11-30');

    expect(october['entertainment']?.billsCents).toBe(5000);
    expect(november['entertainment']?.billsCents).toBe(4000);
  });

  it('keeps the allowance when the category has a bill that is not due this month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({})],
      [bill({ amountCents: 30000, cadence: 'quarterly', monthOfQuarter: 1 })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 0,
      allowanceCents: 10000,
      totalCents: 10000,
    });
  });

  it('leaves out an occurrence the bill excludes', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ dayOfMonth: 1, excludedDates: ['2026-10-01'] })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits).toEqual({});
  });

  it('counts every bill due in a range longer than a month, and one month of allowance', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({})],
      [bill({})],
      '2026-10-01',
      '2026-12-31',
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 6300,
      allowanceCents: 10000,
      totalCents: 16300,
    });
  });

  it('keeps categories separate', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({ categoryId: 'groceries', amountCents: 80000 })],
      [bill({})],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['groceries']?.totalCents).toBe(80000);
    expect(limits['entertainment']?.totalCents).toBe(2100);
  });

  it('ignores income and savings rules', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ type: 'income' }), bill({ id: 'bill-2', type: 'savings' })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits).toEqual({});
  });

  it('ignores a bill with no category', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ categoryId: null })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits).toEqual({});
  });

  it('leaves out a bill that ended before the month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({})],
      [bill({ endDate: '2026-09-30' })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 0,
      allowanceCents: 10000,
      totalCents: 10000,
    });
  });

  it('leaves out a bill that starts after the month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ startDate: '2026-11-01' })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits).toEqual({});
  });

  it('leaves out an allowance that is not active in the month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({ endDate: '2026-09-30' })],
      [bill({})],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 2100,
      allowanceCents: 0,
      totalCents: 2100,
    });
  });

  it('counts a bill only when its due date falls inside its own start and end dates', () => {
    // Both are due on the 1st. One starts after that day; the other ends after it.
    const limits = buildMonthlyLimitsByCategory(
      [],
      [
        bill({ dayOfMonth: 1, startDate: '2026-10-20' }),
        bill({ id: 'bill-2', dayOfMonth: 1, endDate: '2026-10-05' }),
      ],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.billsCents).toBe(2100);
  });

  it('counts an allowance in full when it is active for only part of the month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({ startDate: '2026-10-20' })],
      [],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.allowanceCents).toBe(10000);
  });
});

describe('sumMonthlyAllowanceCents', () => {
  it('equals the sum of every category allowance from the limits', () => {
    const allowances = [
      allowance({ amountCents: 10000, cadence: 'weekly' }),
      allowance({
        id: 'allowance-2',
        categoryId: 'groceries',
        amountCents: 15000,
        cadence: 'fortnightly',
      }),
      allowance({ id: 'allowance-3', categoryId: 'transport', amountCents: 28000 }),
    ];

    const limits = buildMonthlyLimitsByCategory(allowances, [bill({})], MONTH_START, MONTH_END);
    const sumOfRows = Object.values(limits).reduce((sum, limit) => sum + limit.allowanceCents, 0);

    expect(sumMonthlyAllowanceCents(allowances, MONTH_START, MONTH_END)).toBe(sumOfRows);
  });

  it('converts a weekly allowance as 52 weeks over 12 months', () => {
    const total = sumMonthlyAllowanceCents(
      [allowance({ amountCents: 10000, cadence: 'weekly' })],
      MONTH_START,
      MONTH_END,
    );

    expect(total).toBe(43333);
  });

  it('leaves out an allowance that is not active in the month', () => {
    const total = sumMonthlyAllowanceCents(
      [
        allowance({}),
        allowance({ id: 'allowance-2', categoryId: 'groceries', endDate: '2026-09-30' }),
      ],
      MONTH_START,
      MONTH_END,
    );

    expect(total).toBe(10000);
  });

  it('is zero when there are no allowances', () => {
    expect(sumMonthlyAllowanceCents([], MONTH_START, MONTH_END)).toBe(0);
  });
});

describe('isRuleActiveBetween', () => {
  it('treats a rule with no dates as always active', () => {
    expect(isRuleActiveBetween({}, MONTH_START, MONTH_END)).toBe(true);
  });

  it('treats an empty date as no date, as imported data can hold one', () => {
    expect(isRuleActiveBetween({ startDate: '', endDate: '' }, MONTH_START, MONTH_END)).toBe(true);
  });

  it('includes a rule that starts on the last day or ends on the first day', () => {
    expect(isRuleActiveBetween({ startDate: MONTH_END }, MONTH_START, MONTH_END)).toBe(true);
    expect(isRuleActiveBetween({ endDate: MONTH_START }, MONTH_START, MONTH_END)).toBe(true);
  });

  it('excludes a rule that ended the day before or starts the day after', () => {
    expect(isRuleActiveBetween({ endDate: '2026-09-30' }, MONTH_START, MONTH_END)).toBe(false);
    expect(isRuleActiveBetween({ startDate: '2026-11-01' }, MONTH_START, MONTH_END)).toBe(false);
  });
});
