import { describe, it, expect } from 'vitest';
import {
  isItemisedAllowance,
  resolveAllowanceAmountCents,
  sumAllowanceItemCents,
} from '@/lib/allowance-items';
import type { AllowanceItem, BudgetRule } from '@/lib/types';

const LASHES: AllowanceItem = { id: 'item-lashes', name: 'Lashes', amountCents: 8000 };
const NAILS: AllowanceItem = { id: 'item-nails', name: 'Nails', amountCents: 6000 };

function allowance(overrides: Partial<BudgetRule>): BudgetRule {
  return {
    id: 'allowance-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    categoryId: 'health-and-beauty',
    amountCents: 14000,
    cadence: 'monthly',
    ...overrides,
  };
}

describe('isItemisedAllowance', () => {
  it('is true for an allowance with items', () => {
    expect(isItemisedAllowance(allowance({ items: [LASHES, NAILS] }))).toBe(true);
  });

  it('is false for an allowance with no items field', () => {
    expect(isItemisedAllowance(allowance({}))).toBe(false);
  });

  it('is false for an allowance with an empty list of items', () => {
    expect(isItemisedAllowance(allowance({ items: [] }))).toBe(false);
  });

  it('is false when there is no allowance', () => {
    expect(isItemisedAllowance(null)).toBe(false);
    expect(isItemisedAllowance(undefined)).toBe(false);
  });
});

describe('sumAllowanceItemCents', () => {
  it('adds up every item', () => {
    expect(sumAllowanceItemCents([LASHES, NAILS])).toBe(14000);
  });

  it('is zero for no items', () => {
    expect(sumAllowanceItemCents([])).toBe(0);
  });
});

describe('resolveAllowanceAmountCents', () => {
  it('uses the sum of the items over the amount asked for', () => {
    expect(resolveAllowanceAmountCents(99999, [LASHES, NAILS])).toBe(14000);
  });

  it('uses the amount asked for when there are no items', () => {
    expect(resolveAllowanceAmountCents(25000, undefined)).toBe(25000);
    expect(resolveAllowanceAmountCents(25000, [])).toBe(25000);
  });
});
