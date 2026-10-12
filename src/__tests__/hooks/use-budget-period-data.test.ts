import { describe, it, expect } from 'vitest';
import {
  calculatePeriodCashFlow,
  calculatePeriodSpending,
  calculateSummary,
} from '@/hooks/use-budget-period-data';
import { buildMonthlyLimitsByCategory } from '@/lib/category-limits';
import type {
  BudgetRule,
  Category,
  ExpandedForecast,
  ForecastRule,
  Transaction,
} from '@/lib/types';

const BASE_FIELDS = {
  userId: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// October 2026, viewed after it has finished unless a test says otherwise
const SELECTED_YEAR = 2026;
const SELECTED_MONTH_INDEX = 9;
const MONTH_START = '2026-10-01';
const MONTH_END = '2026-10-31';

function allowance(overrides: Partial<BudgetRule>): BudgetRule {
  return {
    ...BASE_FIELDS,
    id: 'allowance-1',
    scenarioId: 'scenario-1',
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
    scenarioId: 'scenario-1',
    type: 'expense',
    description: 'Netflix',
    categoryId: 'entertainment',
    savingsGoalId: null,
    amountCents: 2100,
    cadence: 'monthly',
    ...overrides,
  };
}

function expense(overrides: Partial<Transaction>): Transaction {
  return {
    ...BASE_FIELDS,
    id: 'transaction-1',
    type: 'expense',
    date: '2026-10-05',
    amountCents: 5000,
    description: 'Cinema',
    categoryId: 'entertainment',
    savingsGoalId: null,
    ...overrides,
  };
}

function category(id: string, name: string): Category {
  return { ...BASE_FIELDS, id, name, isArchived: false };
}

function forecast(overrides: Partial<ExpandedForecast>): ExpandedForecast {
  return {
    type: 'expense',
    date: '2026-10-01',
    amountCents: 2100,
    description: 'Netflix',
    categoryId: 'entertainment',
    savingsGoalId: null,
    sourceType: 'rule',
    sourceId: 'bill-1',
    ...overrides,
  };
}

interface PeriodInputs {
  budgetRules?: BudgetRule[];
  forecastRules?: ForecastRule[];
  periodForecasts?: ExpandedForecast[];
  transactions?: Transaction[];
  /** Defaults to the last day of the month, with the month already finished */
  effectiveDate?: string;
  isCurrentPeriod?: boolean;
}

function summaryFor(inputs: PeriodInputs) {
  return calculateSummary(
    'month',
    SELECTED_YEAR,
    SELECTED_MONTH_INDEX,
    MONTH_START,
    MONTH_END,
    inputs.effectiveDate ?? MONTH_END,
    inputs.isCurrentPeriod ?? false,
    inputs.budgetRules ?? [],
    inputs.forecastRules ?? [],
    inputs.periodForecasts ?? [],
    inputs.transactions ?? [],
  );
}

function spendingFor(inputs: PeriodInputs, activeCategories: Category[]) {
  return calculatePeriodSpending(
    'month',
    MONTH_START,
    MONTH_END,
    inputs.effectiveDate ?? MONTH_END,
    inputs.budgetRules ?? [],
    inputs.forecastRules ?? [],
    activeCategories,
    inputs.transactions ?? [],
  );
}

function cashFlowFor(inputs: PeriodInputs) {
  const periodForecasts = inputs.periodForecasts ?? [];
  return calculatePeriodCashFlow(
    'month',
    SELECTED_YEAR,
    SELECTED_MONTH_INDEX,
    MONTH_START,
    MONTH_END,
    inputs.effectiveDate ?? MONTH_END,
    inputs.isCurrentPeriod ?? false,
    false,
    inputs.budgetRules ?? [],
    periodForecasts,
    periodForecasts.filter((periodForecast) => periodForecast.type === 'savings'),
    inputs.transactions ?? [],
  );
}

describe('calculateSummary', () => {
  it('counts spending between the allowance and the full limit as on track', () => {
    const summary = summaryFor({
      budgetRules: [allowance({})],
      forecastRules: [bill({})],
      transactions: [expense({ amountCents: 11000 })],
    });

    expect(summary).toMatchObject({ overCount: 0, overspendingCount: 0, goodCount: 1 });
  });

  it('counts spending that reaches the full limit as over', () => {
    const summary = summaryFor({
      budgetRules: [allowance({})],
      forecastRules: [bill({})],
      transactions: [expense({ amountCents: 12100 })],
    });

    expect(summary).toMatchObject({ overCount: 1, overspendingCount: 0, goodCount: 0 });
  });

  it('counts a category spending well ahead of the month as spending fast', () => {
    const summary = summaryFor({
      budgetRules: [allowance({})],
      transactions: [expense({ amountCents: 5000 })],
      effectiveDate: '2026-10-10',
      isCurrentPeriod: true,
    });

    expect(summary).toMatchObject({ overCount: 0, overspendingCount: 1, goodCount: 0 });
  });

  it('does not track a category whose allowance has ended', () => {
    const summary = summaryFor({
      budgetRules: [allowance({ endDate: '2026-09-30' })],
      transactions: [expense({ amountCents: 20000 })],
    });

    expect(summary.trackedCount).toBe(0);
    expect(summary.overCount).toBe(0);
  });

  it('does not track a category that only has bills', () => {
    const summary = summaryFor({
      forecastRules: [bill({})],
      transactions: [expense({ amountCents: 20000 })],
    });

    expect(summary.trackedCount).toBe(0);
  });

  it('tracks a category with two allowances once, against both added together', () => {
    const summary = summaryFor({
      budgetRules: [allowance({}), allowance({ id: 'allowance-2', amountCents: 5000 })],
      transactions: [expense({ amountCents: 12000 })],
    });

    expect(summary.trackedCount).toBe(1);
    expect(summary).toMatchObject({ overCount: 0, goodCount: 1 });
  });

  it('ignores spending outside the period and transactions that are not expenses', () => {
    const summary = summaryFor({
      budgetRules: [allowance({})],
      transactions: [
        expense({ amountCents: 9000 }),
        expense({ id: 'transaction-2', amountCents: 9000, date: '2026-09-30' }),
        expense({ id: 'transaction-3', amountCents: 9000, type: 'income' }),
      ],
    });

    expect(summary).toMatchObject({ overCount: 0, goodCount: 1 });
  });

  it('adds up the savings planned for the period', () => {
    const summary = summaryFor({
      periodForecasts: [
        forecast({ type: 'savings', amountCents: 30000 }),
        forecast({ type: 'savings', amountCents: 20000 }),
        forecast({}),
      ],
    });

    expect(summary.totalSavingsForecasted).toBe(50000);
  });
});

describe('calculatePeriodSpending', () => {
  const categories = [
    category('entertainment', 'Entertainment'),
    category('groceries', 'Groceries'),
    category('transport', 'Transport'),
  ];

  it('gives each category its bills plus its allowance as the budget', () => {
    const spending = spendingFor(
      {
        budgetRules: [allowance({})],
        forecastRules: [bill({})],
        transactions: [expense({})],
      },
      categories,
    );

    expect(spending.categorySpending).toEqual([
      { id: 'entertainment', name: 'Entertainment', amount: 5000, budget: 12100 },
    ]);
  });

  it('lists categories by spending, largest first, and leaves out ones with none', () => {
    const spending = spendingFor(
      {
        budgetRules: [allowance({ categoryId: 'transport' })],
        transactions: [
          expense({ amountCents: 3000 }),
          expense({ id: 'transaction-2', categoryId: 'groceries', amountCents: 8000 }),
        ],
      },
      categories,
    );

    expect(spending.categorySpending.map((row) => row.id)).toEqual(['groceries', 'entertainment']);
  });

  it('puts spending with no category in its own row, with no budget', () => {
    const spending = spendingFor(
      {
        transactions: [expense({}), expense({ id: 'transaction-2', categoryId: null })],
      },
      categories,
    );

    expect(spending.categorySpending).toContainEqual({
      id: 'uncategorized',
      name: 'Uncategorised',
      amount: 5000,
      budget: 0,
    });
    expect(spending.total).toBe(10000);
  });

  it('leaves out spending after the effective date', () => {
    const spending = spendingFor(
      {
        transactions: [expense({}), expense({ id: 'transaction-2', date: '2026-10-20' })],
        effectiveDate: '2026-10-10',
        isCurrentPeriod: true,
      },
      categories,
    );

    expect(spending.total).toBe(5000);
  });
});

describe('calculatePeriodCashFlow', () => {
  it('plans day-to-day spending as the sum of every category allowance', () => {
    const budgetRules = [
      allowance({ amountCents: 10000, cadence: 'weekly' }),
      allowance({
        id: 'allowance-2',
        categoryId: 'groceries',
        amountCents: 15000,
        cadence: 'fortnightly',
      }),
    ];

    const limits = buildMonthlyLimitsByCategory(budgetRules, [], MONTH_START, MONTH_END);
    const sumOfRows = Object.values(limits).reduce((sum, limit) => sum + limit.allowanceCents, 0);

    expect(cashFlowFor({ budgetRules }).budgeted.expected).toBe(sumOfRows);
    expect(sumOfRows).toBe(43333 + 32500);
  });

  it('leaves an ended allowance out of planned day-to-day spending', () => {
    const cashFlow = cashFlowFor({
      budgetRules: [
        allowance({}),
        allowance({ id: 'allowance-2', categoryId: 'groceries', endDate: '2026-09-30' }),
      ],
    });

    expect(cashFlow.budgeted.expected).toBe(10000);
  });

  it('totals expected income, bills and savings from the forecasts', () => {
    const cashFlow = cashFlowFor({
      periodForecasts: [
        forecast({ type: 'income', amountCents: 500000 }),
        forecast({ amountCents: 182000 }),
        forecast({ amountCents: 2100 }),
        forecast({ type: 'savings', amountCents: 50000 }),
      ],
    });

    expect(cashFlow.income.expected).toBe(500000);
    expect(cashFlow.expenses.expected).toBe(184100);
    expect(cashFlow.savings.expected).toBe(50000);
  });

  it('counts every expense in the period as actual spending, with or without a category', () => {
    const cashFlow = cashFlowFor({
      transactions: [
        expense({ amountCents: 4000 }),
        expense({ id: 'transaction-2', categoryId: null, amountCents: 1500 }),
        expense({ id: 'transaction-3', date: '2026-11-01', amountCents: 9000 }),
      ],
    });

    expect(cashFlow.expenses.actual).toBe(5500);
  });

  it('treats spending beyond the bills due as day-to-day spending', () => {
    const cashFlow = cashFlowFor({
      periodForecasts: [forecast({ amountCents: 2100 })],
      transactions: [expense({ amountCents: 7100 })],
    });

    expect(cashFlow.projection.variableActual).toBe(5000);
  });
});
