import { describe, it, expect } from 'vitest';
import { buildMonthlyLimitsByCategory } from '@/lib/category-limits';
import type { BudgetRule, ForecastRule } from '@/lib/types';

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  scenarioId: 'scenario-1',
};

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
    const limits = buildMonthlyLimitsByCategory([allowance({})], []);

    expect(limits['entertainment']).toEqual({
      billsCents: 0,
      allowanceCents: 10000,
      totalCents: 10000,
    });
  });

  it('uses the bills alone when a category has no allowance', () => {
    const limits = buildMonthlyLimitsByCategory([], [bill({})]);

    expect(limits['entertainment']).toEqual({
      billsCents: 2100,
      allowanceCents: 0,
      totalCents: 2100,
    });
  });

  it('adds bills to the allowance when a category has both', () => {
    const limits = buildMonthlyLimitsByCategory([allowance({})], [bill({})]);

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
    );

    expect(limits['entertainment']?.billsCents).toBe(3400);
  });

  it('adds up several allowances in one category', () => {
    const limits = buildMonthlyLimitsByCategory(
      [allowance({}), allowance({ id: 'allowance-2', amountCents: 5000 })],
      [],
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
    );

    expect(limits['groceries']?.totalCents).toBe(80000);
    expect(limits['entertainment']?.totalCents).toBe(2100);
  });

  it('ignores income and savings rules', () => {
    const limits = buildMonthlyLimitsByCategory(
      [],
      [bill({ type: 'income' }), bill({ id: 'bill-2', type: 'savings' })],
    );

    expect(limits).toEqual({});
  });

  it('ignores a bill with no category', () => {
    const limits = buildMonthlyLimitsByCategory([], [bill({ categoryId: null })]);

    expect(limits).toEqual({});
  });
});
