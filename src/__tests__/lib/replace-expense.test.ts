import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceExpenseWithOtherKind } from '@/lib/replace-expense';
import type { BudgetRule, ForecastRule } from '@/lib/types';

// The test environment has no IndexedDB, so each table is stood in for by an
// array with the two Dexie methods the move calls, and a transaction just runs
// its callback. That covers which rows are written. It cannot cover the
// rollback a real transaction gives when a write fails.
const { storedBudgetRules, storedForecastRules, fakeDb } = vi.hoisted(() => {
  const storedBudgetRules: BudgetRule[] = [];
  const storedForecastRules: ForecastRule[] = [];

  const tableOver = <Row extends { id: string }>(rows: Row[]) => ({
    add: vi.fn(async (row: Row) => {
      rows.push(row);
    }),
    delete: vi.fn(async (id: string) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index !== -1) rows.splice(index, 1);
    }),
  });

  const fakeDb = {
    budgetRules: tableOver(storedBudgetRules),
    forecastRules: tableOver(storedForecastRules),
    transaction: vi.fn(async (_mode: string, _tables: unknown[], run: () => Promise<void>) =>
      run(),
    ),
  };
  return { storedBudgetRules, storedForecastRules, fakeDb };
});

vi.mock('@/lib/db', () => ({ db: fakeDb }));

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const allowance: BudgetRule = {
  ...BASE_FIELDS,
  id: 'allowance-1',
  scenarioId: 'scenario-1',
  categoryId: 'cat-transport',
  name: 'Car rego',
  amountCents: 30000,
  cadence: 'quarterly',
};

const bill: ForecastRule = {
  ...BASE_FIELDS,
  id: 'bill-1',
  scenarioId: 'scenario-1',
  type: 'expense',
  description: 'Car rego',
  categoryId: 'cat-transport',
  savingsGoalId: null,
  amountCents: 30000,
  cadence: 'quarterly',
  dayOfMonth: 15,
  monthOfQuarter: 1,
};

beforeEach(() => {
  storedBudgetRules.length = 0;
  storedForecastRules.length = 0;
  vi.clearAllMocks();
});

describe('replaceExpenseWithOtherKind', () => {
  it('turns an allowance into a bill under a new id', async () => {
    storedBudgetRules.push(allowance);

    await replaceExpenseWithOtherKind(
      { kind: 'allowance', rule: allowance },
      {
        kind: 'bill',
        data: {
          scenarioId: 'scenario-1',
          type: 'expense',
          description: 'Car rego',
          categoryId: 'cat-transport',
          savingsGoalId: null,
          amountCents: 30000,
          cadence: 'quarterly',
          dayOfMonth: 15,
          monthOfQuarter: 1,
        },
      },
    );

    expect(storedBudgetRules).toEqual([]);
    expect(storedForecastRules).toHaveLength(1);
    const newBill = storedForecastRules[0]!;
    expect(newBill).toMatchObject({
      userId: 'local',
      type: 'expense',
      description: 'Car rego',
      categoryId: 'cat-transport',
      amountCents: 30000,
      cadence: 'quarterly',
      dayOfMonth: 15,
      monthOfQuarter: 1,
    });
    expect(newBill.id).not.toBe(allowance.id);
    expect(newBill.createdAt).toBe(newBill.updatedAt);
    expect(newBill.createdAt).not.toBe(allowance.createdAt);
  });

  it('turns a bill into an allowance under a new id', async () => {
    storedForecastRules.push(bill);

    await replaceExpenseWithOtherKind(
      { kind: 'bill', rule: bill },
      {
        kind: 'allowance',
        data: {
          scenarioId: 'scenario-1',
          categoryId: 'cat-transport',
          name: 'Car rego',
          amountCents: 30000,
          cadence: 'quarterly',
        },
      },
    );

    expect(storedForecastRules).toEqual([]);
    expect(storedBudgetRules).toHaveLength(1);
    const newAllowance = storedBudgetRules[0]!;
    expect(newAllowance).toMatchObject({
      userId: 'local',
      categoryId: 'cat-transport',
      name: 'Car rego',
      amountCents: 30000,
      cadence: 'quarterly',
    });
    expect(newAllowance.id).not.toBe(bill.id);
    expect(newAllowance).not.toHaveProperty('dayOfMonth');
  });

  it('leaves every other rule in both tables alone', async () => {
    const otherAllowance: BudgetRule = { ...allowance, id: 'allowance-2', name: 'Fuel' };
    const otherBill: ForecastRule = { ...bill, id: 'bill-2', description: 'Insurance' };
    storedBudgetRules.push(allowance, otherAllowance);
    storedForecastRules.push(otherBill);

    await replaceExpenseWithOtherKind(
      { kind: 'allowance', rule: allowance },
      { kind: 'bill', data: { ...bill, description: 'Car rego' } },
    );

    expect(storedBudgetRules).toEqual([otherAllowance]);
    expect(storedForecastRules.map((rule) => rule.description)).toEqual(['Insurance', 'Car rego']);
  });

  it('gives the replacement a new id even when its data carries an old one', async () => {
    storedBudgetRules.push(allowance);

    await replaceExpenseWithOtherKind(
      { kind: 'allowance', rule: allowance },
      { kind: 'bill', data: { ...bill } },
    );

    expect(storedForecastRules[0]?.id).not.toBe(bill.id);
    expect(storedForecastRules[0]?.createdAt).not.toBe(bill.createdAt);
  });

  it('makes both writes inside one transaction over both tables', async () => {
    storedBudgetRules.push(allowance);

    await replaceExpenseWithOtherKind(
      { kind: 'allowance', rule: allowance },
      { kind: 'bill', data: { ...bill } },
    );

    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(fakeDb.transaction).toHaveBeenCalledWith(
      'rw',
      [fakeDb.budgetRules, fakeDb.forecastRules],
      expect.any(Function),
    );
  });

  it('refuses a replacement of the same kind and writes nothing', async () => {
    storedBudgetRules.push(allowance);

    await expect(
      replaceExpenseWithOtherKind(
        { kind: 'allowance', rule: allowance },
        { kind: 'allowance', data: { ...allowance } },
      ),
    ).rejects.toThrow('other kind');

    expect(storedBudgetRules).toEqual([allowance]);
    expect(fakeDb.transaction).not.toHaveBeenCalled();
  });
});
