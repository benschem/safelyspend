import { describe, it, expect } from 'vitest';
import { findSimilarTransactions, findSimilarForecastRules } from '@/lib/duplicate-detection';
import type { Transaction, ForecastRule } from '@/lib/types';

// Helper to create a minimal transaction
function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    type: 'expense',
    date: '2026-01-15',
    amountCents: 5000,
    description: 'Groceries',
    categoryId: null,
    savingsGoalId: null,
    ...overrides,
  };
}

// Helper to create a minimal forecast rule
function makeRule(overrides: Partial<ForecastRule> = {}): ForecastRule {
  return {
    id: 'rule-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    type: 'expense',
    amountCents: 10000,
    cadence: 'monthly',
    description: 'Rent',
    categoryId: null,
    savingsGoalId: null,
    ...overrides,
  };
}

describe('findSimilarTransactions', () => {
  it('finds exact match', () => {
    const existing = [makeTx()];
    const result = findSimilarTransactions('Groceries', 5000, '2026-01-15', existing);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('tx-1');
  });

  it('matches case-insensitively', () => {
    const existing = [makeTx({ description: 'GROCERIES' })];
    const result = findSimilarTransactions('groceries', 5000, '2026-01-15', existing);
    expect(result).toHaveLength(1);
  });

  it('matches date within ±3 days', () => {
    const existing = [makeTx({ date: '2026-01-15' })];

    // 3 days before
    expect(findSimilarTransactions('Groceries', 5000, '2026-01-12', existing)).toHaveLength(1);

    // 3 days after
    expect(findSimilarTransactions('Groceries', 5000, '2026-01-18', existing)).toHaveLength(1);
  });

  it('does not match date outside ±3 days', () => {
    const existing = [makeTx({ date: '2026-01-15' })];

    // 4 days before
    expect(findSimilarTransactions('Groceries', 5000, '2026-01-11', existing)).toHaveLength(0);

    // 4 days after
    expect(findSimilarTransactions('Groceries', 5000, '2026-01-19', existing)).toHaveLength(0);
  });

  it('does not match different amount', () => {
    const existing = [makeTx({ amountCents: 5000 })];
    const result = findSimilarTransactions('Groceries', 9999, '2026-01-15', existing);
    expect(result).toHaveLength(0);
  });

  it('does not match different description', () => {
    const existing = [makeTx({ description: 'Rent' })];
    const result = findSimilarTransactions('Groceries', 5000, '2026-01-15', existing);
    expect(result).toHaveLength(0);
  });

  it('excludes item by id', () => {
    const existing = [makeTx({ id: 'tx-1' })];
    const result = findSimilarTransactions('Groceries', 5000, '2026-01-15', existing, 'tx-1');
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty existing list', () => {
    const result = findSimilarTransactions('Groceries', 5000, '2026-01-15', []);
    expect(result).toHaveLength(0);
  });

  it('returns empty for blank description', () => {
    const existing = [makeTx()];
    const result = findSimilarTransactions('', 5000, '2026-01-15', existing);
    expect(result).toHaveLength(0);
  });

  it('returns empty for zero amount', () => {
    const existing = [makeTx()];
    const result = findSimilarTransactions('Groceries', 0, '2026-01-15', existing);
    expect(result).toHaveLength(0);
  });

  it('matches absolute amounts (handles negative savings)', () => {
    const existing = [makeTx({ amountCents: -5000, type: 'savings' })];
    const result = findSimilarTransactions('Groceries', 5000, '2026-01-15', existing);
    expect(result).toHaveLength(1);
  });
});

describe('findSimilarForecastRules', () => {
  it('finds exact match', () => {
    const existing = [makeRule()];
    const result = findSimilarForecastRules('Rent', 10000, existing);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('rule-1');
  });

  it('matches case-insensitively', () => {
    const existing = [makeRule({ description: 'RENT' })];
    const result = findSimilarForecastRules('rent', 10000, existing);
    expect(result).toHaveLength(1);
  });

  it('does not match different amount', () => {
    const existing = [makeRule({ amountCents: 10000 })];
    const result = findSimilarForecastRules('Rent', 5000, existing);
    expect(result).toHaveLength(0);
  });

  it('does not match different description', () => {
    const existing = [makeRule({ description: 'Salary' })];
    const result = findSimilarForecastRules('Rent', 10000, existing);
    expect(result).toHaveLength(0);
  });

  it('excludes item by id', () => {
    const existing = [makeRule({ id: 'rule-1' })];
    const result = findSimilarForecastRules('Rent', 10000, existing, 'rule-1');
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty existing list', () => {
    const result = findSimilarForecastRules('Rent', 10000, []);
    expect(result).toHaveLength(0);
  });

  it('returns empty for blank description', () => {
    const existing = [makeRule()];
    const result = findSimilarForecastRules('', 10000, existing);
    expect(result).toHaveLength(0);
  });

  it('returns empty for zero amount', () => {
    const existing = [makeRule()];
    const result = findSimilarForecastRules('Rent', 0, existing);
    expect(result).toHaveLength(0);
  });
});
