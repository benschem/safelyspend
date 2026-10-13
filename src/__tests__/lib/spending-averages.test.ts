import { describe, it, expect } from 'vitest';
import { averageMonthlySpendingByCategory, describeAverageSpending } from '@/lib/spending-averages';
import type { Transaction } from '@/lib/types';

const TODAY = '2026-10-13';

let nextTransactionNumber = 1;

function expense(overrides: Partial<Transaction>): Transaction {
  return {
    id: `transaction-${nextTransactionNumber++}`,
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    type: 'expense',
    date: TODAY,
    amountCents: 10000,
    description: 'Something',
    categoryId: 'groceries',
    savingsGoalId: null,
    ...overrides,
  };
}

describe('averageMonthlySpendingByCategory', () => {
  it('spreads a single yearly bill across the whole year', () => {
    const averages = averageMonthlySpendingByCategory(
      [
        expense({ date: '2025-10-14', categoryId: 'groceries', amountCents: 5000 }),
        expense({ date: '2026-06-02', categoryId: 'car', amountCents: 170000 }),
      ],
      TODAY,
    );

    expect(averages?.monthsOfHistory).toBe(12);
    expect(averages?.monthlyCentsByCategory['car']).toBe(14167);
  });

  it('averages a category over all the history, not only its own', () => {
    // Four months of groceries, and one car bill last week
    const averages = averageMonthlySpendingByCategory(
      [
        expense({ date: '2026-06-14', categoryId: 'groceries', amountCents: 40000 }),
        expense({ date: '2026-10-06', categoryId: 'car', amountCents: 170000 }),
      ],
      TODAY,
    );

    expect(averages?.monthsOfHistory).toBe(4);
    // 122 days of history is just over four months, so about $424 a month
    expect(averages?.monthlyCentsByCategory['car']).toBe(42384);
  });

  it('leaves out spending from more than a year ago', () => {
    const averages = averageMonthlySpendingByCategory(
      [
        expense({ date: '2024-03-01', categoryId: 'car', amountCents: 500000 }),
        expense({ date: '2026-03-01', categoryId: 'car', amountCents: 120000 }),
      ],
      TODAY,
    );

    expect(averages?.monthsOfHistory).toBe(12);
    expect(averages?.monthlyCentsByCategory['car']).toBe(10000);
  });

  it('counts expenses only, and only ones that have happened', () => {
    const averages = averageMonthlySpendingByCategory(
      [
        expense({ date: '2025-10-14', categoryId: 'groceries', amountCents: 120000 }),
        expense({ date: '2026-02-01', type: 'income', categoryId: null, amountCents: 900000 }),
        expense({ date: '2026-02-01', type: 'savings', categoryId: null, amountCents: 50000 }),
        expense({ date: '2026-11-01', categoryId: 'groceries', amountCents: 999900 }),
      ],
      TODAY,
    );

    expect(averages?.monthlyCentsByCategory).toEqual({ groceries: 10000 });
  });

  it('ignores expenses with no category', () => {
    const averages = averageMonthlySpendingByCategory(
      [expense({ date: '2025-10-14', categoryId: null, amountCents: 120000 })],
      TODAY,
    );

    expect(averages?.monthlyCentsByCategory).toEqual({});
  });

  it('returns null with no spending at all', () => {
    expect(averageMonthlySpendingByCategory([], TODAY)).toBeNull();
  });

  it('returns null with under a month of spending', () => {
    const averages = averageMonthlySpendingByCategory([expense({ date: '2026-09-20' })], TODAY);

    expect(averages).toBeNull();
  });
});

describe('describeAverageSpending', () => {
  const averages = { monthsOfHistory: 12, monthlyCentsByCategory: { car: 14167 } };

  it('gives the figure at the frequency of the allowance', () => {
    expect(describeAverageSpending(averages, 'car', 'monthly')).toBe(
      "You've spent about $142 per month here over the last 12 months",
    );
    expect(describeAverageSpending(averages, 'car', 'fortnightly')).toBe(
      "You've spent about $65 per fortnight here over the last 12 months",
    );
  });

  it('says "the last month" for a single month of history', () => {
    expect(describeAverageSpending({ ...averages, monthsOfHistory: 1 }, 'car', 'monthly')).toBe(
      "You've spent about $142 per month here over the last month",
    );
  });

  it('says nothing for a category with no spending', () => {
    expect(describeAverageSpending(averages, 'holidays', 'monthly')).toBeNull();
  });

  it('says nothing when there is no history to average', () => {
    expect(describeAverageSpending(null, 'car', 'monthly')).toBeNull();
  });
});
