import { describe, it, expect } from 'vitest';
import { buildMonthlyLimitsByCategory, isRuleActiveBetween } from '@/lib/category-limits';
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

  it('averages other cadences to a monthly figure', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({ amountCents: 12000, cadence: 'weekly' })],
      [bill({ amountCents: 30000, cadence: 'quarterly' })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']).toEqual({
      billsCents: 10000,
      allowanceCents: 52000,
      totalCents: 62000,
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

  it('counts a bill in full when it is active for only part of the month', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ startDate: '2026-10-20' }), bill({ id: 'bill-2', endDate: '2026-10-05' })],
      MONTH_START,
      MONTH_END,
    );

    expect(limits['entertainment']?.billsCents).toBe(4200);
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
