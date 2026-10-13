import { describe, it, expect } from 'vitest';
import {
  describeBillDue,
  groupExpensesByCategory,
  ruleDateRange,
  UNCATEGORISED_LABEL,
} from '@/lib/expenses';
import type { BudgetRule, Category, ForecastRule } from '@/lib/types';

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function category(id: string, name: string, isArchived = false): Category {
  return { ...BASE_FIELDS, id, name, isArchived };
}

function bill(id: string, categoryId: string | null): ForecastRule {
  return {
    ...BASE_FIELDS,
    id,
    scenarioId: 'scenario-1',
    type: 'expense',
    description: id,
    categoryId,
    savingsGoalId: null,
    amountCents: 5000,
    cadence: 'monthly',
    dayOfMonth: 15,
  };
}

function allowance(id: string, categoryId: string): BudgetRule {
  return {
    ...BASE_FIELDS,
    id,
    scenarioId: 'scenario-1',
    categoryId,
    amountCents: 20000,
    cadence: 'monthly',
  };
}

describe('groupExpensesByCategory', () => {
  const categories = [
    category('cat-phone', 'Phone'),
    category('cat-food', 'Food'),
    category('cat-old', 'Old hobby', true),
  ];

  it('puts a category’s bills and allowances in one group', () => {
    const groups = groupExpensesByCategory(
      [bill('phone-plan', 'cat-phone')],
      [allowance('phone-extras', 'cat-phone')],
      categories,
    );

    const phoneGroup = groups.find((group) => group.categoryId === 'cat-phone');
    expect(phoneGroup?.name).toBe('Phone');
    expect(phoneGroup?.bills.map((rule) => rule.id)).toEqual(['phone-plan']);
    expect(phoneGroup?.allowances.map((rule) => rule.id)).toEqual(['phone-extras']);
  });

  it('gives a category with no expenses an empty group, unless it is archived', () => {
    const groups = groupExpensesByCategory([], [], categories);

    expect(groups).toEqual([
      { categoryId: 'cat-food', name: 'Food', bills: [], allowances: [] },
      { categoryId: 'cat-phone', name: 'Phone', bills: [], allowances: [] },
    ]);
  });

  it('sorts groups by category name', () => {
    const groups = groupExpensesByCategory(
      [bill('phone-plan', 'cat-phone')],
      [allowance('groceries', 'cat-food')],
      categories,
    );

    expect(groups.map((group) => group.name)).toEqual(['Food', 'Phone']);
  });

  it('lists a bill whose category no longer exists as uncategorised', () => {
    const groups = groupExpensesByCategory(
      [bill('orphan', 'cat-deleted'), bill('no-category', null)],
      [],
      categories,
    );

    const uncategorisedGroup = groups.find((group) => group.categoryId === null);
    expect(uncategorisedGroup?.name).toBe(UNCATEGORISED_LABEL);
    expect(uncategorisedGroup?.bills).toHaveLength(2);
  });

  it('leaves out an allowance in an archived or missing category', () => {
    const groups = groupExpensesByCategory(
      [],
      [allowance('archived', 'cat-old'), allowance('orphan', 'cat-deleted')],
      categories,
    );

    expect(groups.flatMap((group) => group.allowances)).toEqual([]);
    expect(groups.map((group) => group.categoryId)).not.toContain('cat-old');
  });

  it('keeps a bill in an archived category', () => {
    const groups = groupExpensesByCategory(
      [bill('old-club-fees', 'cat-old')],
      [allowance('archived', 'cat-old')],
      categories,
    );

    const archivedGroup = groups.find((group) => group.categoryId === 'cat-old');
    expect(archivedGroup?.bills).toHaveLength(1);
    expect(archivedGroup?.allowances).toEqual([]);
  });
});

describe('describeBillDue', () => {
  it('names the weekday for weekly and fortnightly bills', () => {
    expect(describeBillDue({ cadence: 'weekly', dayOfWeek: 5 })).toBe('Due every Friday');
    expect(describeBillDue({ cadence: 'fortnightly', dayOfWeek: 1 })).toBe(
      'Due every second Monday',
    );
  });

  it('gives the day of the month with its ordinal', () => {
    expect(describeBillDue({ cadence: 'monthly', dayOfMonth: 1 })).toBe(
      'Due on the 1st of each month',
    );
    expect(describeBillDue({ cadence: 'monthly', dayOfMonth: 22 })).toBe(
      'Due on the 22nd of each month',
    );
    expect(describeBillDue({ cadence: 'monthly', dayOfMonth: 13 })).toBe(
      'Due on the 13th of each month',
    );
  });

  it('says which month of the quarter', () => {
    expect(describeBillDue({ cadence: 'quarterly', dayOfMonth: 3, monthOfQuarter: 1 })).toBe(
      'Due on the 3rd of the second month of each quarter',
    );
  });

  it('names the month for a yearly bill', () => {
    expect(describeBillDue({ cadence: 'yearly', dayOfMonth: 15, monthOfYear: 2 })).toBe(
      'Due on 15 March each year',
    );
  });

  it('falls back to the days cadence expansion uses when none is stored', () => {
    expect(describeBillDue({ cadence: 'weekly' })).toBe('Due every Sunday');
    expect(describeBillDue({ cadence: 'monthly' })).toBe('Due on the 1st of each month');
    expect(describeBillDue({ cadence: 'quarterly' })).toBe(
      'Due on the 1st of the first month of each quarter',
    );
    expect(describeBillDue({ cadence: 'yearly' })).toBe('Due on 1 January each year');
  });
});

describe('ruleDateRange', () => {
  it('carries over the dates a rule stores', () => {
    expect(ruleDateRange({ startDate: '2026-07-01', endDate: '2027-06-30' })).toEqual({
      startDate: '2026-07-01',
      endDate: '2027-06-30',
    });
  });

  it('leaves out a date the rule does not have', () => {
    expect(ruleDateRange({ startDate: '2026-07-01' })).toEqual({ startDate: '2026-07-01' });
    expect(ruleDateRange({})).toEqual({});
  });
});
