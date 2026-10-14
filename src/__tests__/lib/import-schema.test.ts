import { describe, it, expect } from 'vitest';
import {
  sanitizeObject,
  validateImport,
  getImportErrorMessage,
  budgetDataSchema,
  CURRENT_DATA_VERSION,
} from '@/lib/import-schema';
import { z } from 'zod';
import type { BudgetBackup } from '@/lib/db';
import type {
  BalanceAnchor,
  BudgetRule,
  Category,
  CategoryRule,
  ForecastRule,
  SavingsAnchor,
  SavingsGoal,
  Scenario,
  Transaction,
} from '@/lib/types';

// =============================================================================
// sanitizeObject Tests
// =============================================================================

describe('sanitizeObject', () => {
  it('passes through primitive values unchanged', () => {
    expect(sanitizeObject(null)).toBe(null);
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject('hello')).toBe('hello');
    expect(sanitizeObject(true)).toBe(true);
  });

  it('passes through clean objects', () => {
    const obj = { name: 'Test', value: 123 };
    expect(sanitizeObject(obj)).toEqual(obj);
  });

  it('passes through arrays', () => {
    const arr = [1, 2, { name: 'test' }];
    expect(sanitizeObject(arr)).toEqual(arr);
  });

  it('removes __proto__ keys', () => {
    const malicious = JSON.parse('{"name": "test", "__proto__": {"admin": true}}');
    const result = sanitizeObject(malicious) as Record<string, unknown>;
    expect(result['name']).toBe('test');
    expect(Object.hasOwn(result, '__proto__')).toBe(false);
  });

  it('removes constructor keys', () => {
    const malicious = { name: 'test', constructor: { evil: true } };
    const result = sanitizeObject(malicious) as Record<string, unknown>;
    expect(result['name']).toBe('test');
    expect(Object.hasOwn(result, 'constructor')).toBe(false);
  });

  it('removes prototype keys', () => {
    const malicious = { name: 'test', prototype: { evil: true } };
    const result = sanitizeObject(malicious) as Record<string, unknown>;
    expect(result['name']).toBe('test');
    expect(Object.hasOwn(result, 'prototype')).toBe(false);
  });

  it('recursively sanitizes nested objects', () => {
    const malicious = {
      level1: {
        level2: {
          __proto__: { evil: true },
          safe: 'value',
        },
      },
    };
    const result = sanitizeObject(malicious) as { level1: { level2: { safe: string } } };
    expect(result.level1.level2.safe).toBe('value');
    expect(Object.hasOwn(result.level1.level2, '__proto__')).toBe(false);
  });

  it('sanitizes arrays containing objects', () => {
    const malicious = [{ __proto__: { evil: true }, name: 'test' }];
    const result = sanitizeObject(malicious) as Array<Record<string, unknown>>;
    expect(result[0]!['name']).toBe('test');
    expect(Object.hasOwn(result[0]!, '__proto__')).toBe(false);
  });
});

// =============================================================================
// validateImport Tests
// =============================================================================

describe('validateImport', () => {
  const validMinimalData = {
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    forecastEvents: [],
    savingsGoals: [],
  };

  it('accepts minimal valid data', () => {
    expect(() => validateImport(validMinimalData)).not.toThrow();
  });

  it('accepts data with version and exportedAt', () => {
    const data = {
      ...validMinimalData,
      version: 1,
      exportedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects data missing required arrays', () => {
    expect(() => validateImport({})).toThrow();
    expect(() => validateImport({ scenarios: [] })).toThrow();
  });

  it('validates scenario structure', () => {
    const validScenario = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      name: 'Test Scenario',
      isDefault: true,
    };

    const data = {
      ...validMinimalData,
      scenarios: [validScenario],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects scenarios with empty names', () => {
    const invalidScenario = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      name: '',
      isDefault: true,
    };

    const data = {
      ...validMinimalData,
      scenarios: [invalidScenario],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('validates transaction amountCents is a non-negative integer', () => {
    const validTransaction = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      type: 'expense',
      date: '2025-01-01',
      amountCents: 1000,
      description: 'Test',
      categoryId: null,
      savingsGoalId: null,
    };

    const data = {
      ...validMinimalData,
      transactions: [validTransaction],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts negative amountCents for savings withdrawals', () => {
    const withdrawalTransaction = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      type: 'savings',
      date: '2025-01-01',
      amountCents: -1000,
      description: 'Withdrawal',
      categoryId: null,
      savingsGoalId: 'goal-1',
    };

    const data = {
      ...validMinimalData,
      transactions: [withdrawalTransaction],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects non-integer amountCents', () => {
    const invalidTransaction = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      type: 'expense',
      date: '2025-01-01',
      amountCents: 10.5,
      description: 'Test',
      categoryId: null,
      savingsGoalId: null,
    };

    const data = {
      ...validMinimalData,
      transactions: [invalidTransaction],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('validates cadence enum values', () => {
    const validRule = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 10000,
      cadence: 'monthly',
    };

    const data = {
      ...validMinimalData,
      budgetRules: [validRule],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects invalid cadence values', () => {
    const invalidRule = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 10000,
      cadence: 'biweekly', // invalid
    };

    const data = {
      ...validMinimalData,
      budgetRules: [invalidRule],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('accepts a budget rule from an older backup and drops its day and month fields', () => {
    // Allowances used to store a day and month that nothing read
    const ruleFromOlderBackup = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 10000,
      cadence: 'quarterly',
      dayOfWeek: 1,
      dayOfMonth: 15,
      monthOfQuarter: 2,
      monthOfYear: 6,
    };

    const result = validateImport({
      ...validMinimalData,
      budgetRules: [ruleFromOlderBackup],
    });

    expect(result.budgetRules[0]).toEqual({
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 10000,
      cadence: 'quarterly',
    });
  });

  it('turns the items of an itemised budget rule from a version 3 backup into rules', () => {
    const ruleFields = {
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      cadence: 'fortnightly',
    };
    const itemisedRule = {
      ...ruleFields,
      id: '1',
      amountCents: 14000,
      items: [
        { id: 'item-1', name: 'Lashes', amountCents: 8000 },
        { id: 'item-2', name: 'Nails', amountCents: 6000 },
      ],
    };

    const result = validateImport({
      ...validMinimalData,
      version: 3,
      budgetRules: [itemisedRule],
    });

    expect(result.budgetRules).toEqual([
      { ...ruleFields, id: '1', name: 'Lashes', amountCents: 8000 },
      { ...ruleFields, id: '1:item-2', name: 'Nails', amountCents: 6000 },
    ]);
    expect(result.version).toBe(CURRENT_DATA_VERSION);
  });

  it('turns items into rules in a file marked as the current version', () => {
    const itemisedRule = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 8000,
      cadence: 'monthly',
      items: [{ id: 'item-1', name: 'Lashes', amountCents: 8000 }],
    };

    const result = validateImport({
      ...validMinimalData,
      version: CURRENT_DATA_VERSION,
      budgetRules: [itemisedRule],
    });

    expect(result.budgetRules).toHaveLength(1);
    expect(result.budgetRules[0]).toMatchObject({ id: '1', name: 'Lashes', amountCents: 8000 });
    expect(result.budgetRules[0]).not.toHaveProperty('items');
  });

  it('keeps the name of a budget rule', () => {
    const namedRule = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      name: 'Lashes',
      amountCents: 8000,
      cadence: 'fortnightly',
    };

    const result = validateImport({
      ...validMinimalData,
      version: CURRENT_DATA_VERSION,
      budgetRules: [namedRule],
    });

    expect(result.budgetRules[0]).toEqual(namedRule);
  });

  it('rejects a budget rule item with no name', () => {
    const ruleWithUnnamedItem = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioId: 'scenario-1',
      categoryId: 'cat-1',
      amountCents: 8000,
      cadence: 'monthly',
      items: [{ id: 'item-1', name: '', amountCents: 8000 }],
    };

    expect(() =>
      validateImport({ ...validMinimalData, budgetRules: [ruleWithUnnamedItem] }),
    ).toThrow();
  });

  it('sanitizes prototype pollution attempts during validation', () => {
    const malicious = JSON.parse(
      JSON.stringify({
        ...validMinimalData,
        __proto__: { isAdmin: true },
      }),
    );
    // Should not throw - sanitization happens first
    const result = validateImport(malicious);
    expect(result).toBeDefined();
    expect((result as Record<string, unknown>)['isAdmin']).toBeUndefined();
  });
});

// =============================================================================
// Round trip of every field
// =============================================================================

// Zod drops keys a schema does not list, so a field in types.ts that is missing
// from import-schema.ts is stripped by every restore and every sync pull.
// `Required<>` makes this fixture stop compiling when a field is added to a
// type, and the round trip then fails until the schema lists it too.
describe('a backup with every field set', () => {
  const baseFields = {
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };

  const scenario: Required<Scenario> = {
    ...baseFields,
    id: 'scenario-1',
    name: 'Main plan',
    description: 'The plan we follow',
    isDefault: true,
  };

  const category: Required<Category> = {
    ...baseFields,
    id: 'category-1',
    name: 'Groceries',
    isArchived: false,
  };

  const savingsGoal: Required<SavingsGoal> = {
    ...baseFields,
    id: 'goal-1',
    name: 'Emergency fund',
    targetAmountCents: 1000000,
    deadline: '2027-06-30',
    annualInterestRate: 4.5,
    compoundingFrequency: 'monthly',
    isEmergencyFund: true,
    interestRateSchedule: [{ effectiveDate: '2026-07-01', annualRate: 4.25 }],
  };

  const budgetRule: Required<BudgetRule> = {
    ...baseFields,
    id: 'budget-rule-1',
    scenarioId: scenario.id,
    categoryId: category.id,
    name: 'Weekly shop',
    amountCents: 20000,
    cadence: 'weekly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  const forecastRule: Required<ForecastRule> = {
    ...baseFields,
    id: 'forecast-rule-1',
    scenarioId: scenario.id,
    type: 'savings',
    amountCents: 50000,
    cadence: 'quarterly',
    dayOfMonth: 15,
    dayOfWeek: 3,
    monthOfYear: 6,
    monthOfQuarter: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    description: 'Top up the emergency fund',
    categoryId: category.id,
    savingsGoalId: savingsGoal.id,
    notes: 'Raise this after the pay rise',
    excludedDates: ['2026-04-15'],
  };

  const transaction: Required<Transaction> = {
    ...baseFields,
    id: 'transaction-1',
    type: 'expense',
    date: '2026-01-10',
    amountCents: 8450,
    description: 'Supermarket',
    categoryId: category.id,
    savingsGoalId: savingsGoal.id,
    notes: 'Included the party food',
    importFingerprint: '2026-01-10|8450|supermarket',
    importSource: 'up-csv',
    importedAt: '2026-01-11T09:00:00.000Z',
  };

  const balanceAnchor: Required<BalanceAnchor> = {
    ...baseFields,
    id: 'balance-anchor-1',
    date: '2026-01-01',
    balanceCents: 250000,
    label: 'Opening balance',
  };

  const savingsAnchor: Required<SavingsAnchor> = {
    ...baseFields,
    id: 'savings-anchor-1',
    savingsGoalId: savingsGoal.id,
    date: '2026-01-01',
    balanceCents: 300000,
    label: 'Bank statement balance',
  };

  const categoryRule: Required<CategoryRule> = {
    ...baseFields,
    id: 'category-rule-1',
    name: 'Supermarkets',
    matchField: 'description',
    matchType: 'contains',
    matchValue: 'supermarket',
    categoryId: category.id,
    amountMinCents: 100,
    amountMaxCents: 50000,
    transactionType: 'expense',
    priority: 1,
    enabled: true,
  };

  const backup: Required<BudgetBackup> = {
    version: CURRENT_DATA_VERSION,
    exportedAt: '2026-02-01T12:00:00.000Z',
    activeScenarioId: scenario.id,
    checkInCadence: 'fortnightly',
    lastCheckInDate: '2026-01-25',
    scenarios: [scenario],
    categories: [category],
    budgetRules: [budgetRule],
    forecastRules: [forecastRule],
    transactions: [transaction],
    savingsGoals: [savingsGoal],
    balanceAnchors: [balanceAnchor],
    savingsAnchors: [savingsAnchor],
    categoryRules: [categoryRule],
  };

  it('comes back from validateImport unchanged', () => {
    expect(validateImport(backup)).toStrictEqual(backup);
  });
});

// =============================================================================
// getImportErrorMessage Tests
// =============================================================================

describe('getImportErrorMessage', () => {
  it('returns path and message for nested errors', () => {
    const result = budgetDataSchema.safeParse({
      scenarios: [{ id: '', name: '' }],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
    });

    if (!result.success) {
      const message = getImportErrorMessage(result.error);
      expect(message).toContain('scenarios');
    }
  });

  it('returns generic message when no issues exist', () => {
    // Create an empty ZodError manually
    const emptyError = new z.ZodError([]);
    const message = getImportErrorMessage(emptyError);
    expect(message).toContain('valid budget export');
  });
});

// =============================================================================
// Balance Anchors Tests
// =============================================================================

describe('balance anchors validation', () => {
  const validMinimalData = {
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    forecastEvents: [],
    savingsGoals: [],
  };

  it('accepts valid balance anchor', () => {
    const validAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      date: '2025-01-01',
      balanceCents: 100000,
      label: 'Opening balance',
    };

    const data = {
      ...validMinimalData,
      balanceAnchors: [validAnchor],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts balance anchor without optional label', () => {
    const validAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      date: '2025-01-01',
      balanceCents: 50000,
    };

    const data = {
      ...validMinimalData,
      balanceAnchors: [validAnchor],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts negative balance anchor (overdraft)', () => {
    const validAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      date: '2025-01-01',
      balanceCents: -5000,
    };

    const data = {
      ...validMinimalData,
      balanceAnchors: [validAnchor],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects balance anchor with non-integer balanceCents', () => {
    const invalidAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      date: '2025-01-01',
      balanceCents: 100.5,
    };

    const data = {
      ...validMinimalData,
      balanceAnchors: [invalidAnchor],
    };
    expect(() => validateImport(data)).toThrow();
  });
});

// =============================================================================
// Savings Anchors Tests
// =============================================================================

describe('savings anchors validation', () => {
  const validMinimalData = {
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    forecastEvents: [],
    savingsGoals: [],
  };

  it('accepts valid savings anchor', () => {
    const validAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      savingsGoalId: 'goal-1',
      date: '2025-01-01',
      balanceCents: 50000,
      label: 'Starting balance',
    };

    const data = {
      ...validMinimalData,
      savingsAnchors: [validAnchor],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts savings anchor without optional label', () => {
    const validAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      savingsGoalId: 'goal-1',
      date: '2025-01-01',
      balanceCents: 25000,
    };

    const data = {
      ...validMinimalData,
      savingsAnchors: [validAnchor],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts multiple savings anchors for different goals', () => {
    const anchors = [
      {
        id: '1',
        userId: 'local',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        savingsGoalId: 'goal-1',
        date: '2025-01-01',
        balanceCents: 50000,
      },
      {
        id: '2',
        userId: 'local',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        savingsGoalId: 'goal-2',
        date: '2025-01-01',
        balanceCents: 75000,
      },
    ];

    const data = {
      ...validMinimalData,
      savingsAnchors: anchors,
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts multiple savings anchors for same goal on different dates', () => {
    const anchors = [
      {
        id: '1',
        userId: 'local',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        savingsGoalId: 'goal-1',
        date: '2025-01-01',
        balanceCents: 50000,
      },
      {
        id: '2',
        userId: 'local',
        createdAt: '2025-06-01T00:00:00.000Z',
        updatedAt: '2025-06-01T00:00:00.000Z',
        savingsGoalId: 'goal-1',
        date: '2025-06-01',
        balanceCents: 75000,
      },
    ];

    const data = {
      ...validMinimalData,
      savingsAnchors: anchors,
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects savings anchor with non-integer balanceCents', () => {
    const invalidAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      savingsGoalId: 'goal-1',
      date: '2025-01-01',
      balanceCents: 50.5,
    };

    const data = {
      ...validMinimalData,
      savingsAnchors: [invalidAnchor],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('rejects savings anchor without savingsGoalId', () => {
    const invalidAnchor = {
      id: '1',
      userId: 'local',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      date: '2025-01-01',
      balanceCents: 50000,
    };

    const data = {
      ...validMinimalData,
      savingsAnchors: [invalidAnchor],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('accepts data without savingsAnchors field (backwards compatibility)', () => {
    // v1 data won't have savingsAnchors
    expect(() => validateImport(validMinimalData)).not.toThrow();
  });
});

// =============================================================================
// Interest Rate Schedule Tests
// =============================================================================

describe('interest rate schedule validation', () => {
  const validMinimalData = {
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    forecastEvents: [],
    savingsGoals: [],
  };

  const makeGoal = (overrides: Record<string, unknown> = {}) => ({
    id: 'goal-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test Goal',
    targetAmountCents: 1000000,
    ...overrides,
  });

  it('accepts savings goal with interestRateSchedule', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          annualInterestRate: 4.5,
          interestRateSchedule: [
            { effectiveDate: '2026-03-01', annualRate: 5.0 },
            { effectiveDate: '2026-07-01', annualRate: 4.25 },
          ],
        }),
      ],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts savings goal without interestRateSchedule (backwards compatibility)', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [makeGoal({ annualInterestRate: 4.5 })],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('accepts savings goal with empty interestRateSchedule', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [makeGoal({ interestRateSchedule: [] })],
    };
    expect(() => validateImport(data)).not.toThrow();
  });

  it('rejects interestRateSchedule entry with rate above 100', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          interestRateSchedule: [{ effectiveDate: '2026-03-01', annualRate: 150 }],
        }),
      ],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('rejects interestRateSchedule entry with negative rate', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          interestRateSchedule: [{ effectiveDate: '2026-03-01', annualRate: -1 }],
        }),
      ],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('rejects interestRateSchedule entry missing effectiveDate', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          interestRateSchedule: [{ annualRate: 5.0 }],
        }),
      ],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('rejects interestRateSchedule entry missing annualRate', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          interestRateSchedule: [{ effectiveDate: '2026-03-01' }],
        }),
      ],
    };
    expect(() => validateImport(data)).toThrow();
  });

  it('accepts interestRateSchedule with rate of 0', () => {
    const data = {
      ...validMinimalData,
      savingsGoals: [
        makeGoal({
          interestRateSchedule: [{ effectiveDate: '2026-03-01', annualRate: 0 }],
        }),
      ],
    };
    expect(() => validateImport(data)).not.toThrow();
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('import schema constants', () => {
  it('CURRENT_DATA_VERSION is defined', () => {
    expect(CURRENT_DATA_VERSION).toBe(4);
  });
});
