// =============================================================================
// Domain Types
// =============================================================================
// All amounts are stored as integer cents (e.g., $12.34 = 1234)
// All dates are ISO 8601 strings (e.g., "2025-07-01")
// All timestamps are ISO 8601 with time (e.g., "2025-07-01T10:30:00.000Z")
// =============================================================================

/** Base fields present on all entities */
interface BaseEntity {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Scenario - A set of budget rules and forecast rules/events (a "plan")
// -----------------------------------------------------------------------------

export interface Scenario extends BaseEntity {
  name: string;
  description?: string;
  isDefault: boolean;
}

// -----------------------------------------------------------------------------
// Category - Expense categorization
// -----------------------------------------------------------------------------

export interface Category extends BaseEntity {
  name: string;
  isArchived: boolean;
}

// -----------------------------------------------------------------------------
// Cadence - Frequency for recurring rules
// -----------------------------------------------------------------------------

export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

// -----------------------------------------------------------------------------
// Budget Rule - Spending limits per category with cadence
// -----------------------------------------------------------------------------

export interface BudgetRule extends BaseEntity {
  scenarioId: string;
  categoryId: string;
  amountCents: number;
  cadence: Cadence;
  startDate?: string; // Optional, omit = always active
  endDate?: string;
}

// -----------------------------------------------------------------------------
// Forecast Rule - Recurring income/expense/savings patterns
// -----------------------------------------------------------------------------

export type ForecastType = 'income' | 'expense' | 'savings';

export interface ForecastRule extends BaseEntity {
  scenarioId: string;
  type: ForecastType;
  amountCents: number;
  cadence: Cadence;
  dayOfMonth?: number; // 1-31 for monthly/quarterly/yearly
  dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly/fortnightly
  monthOfYear?: number; // 0-11 (Jan-Dec) for yearly
  monthOfQuarter?: number; // 0-2 (1st, 2nd, 3rd month of quarter) for quarterly
  startDate?: string;
  endDate?: string;
  description: string;
  categoryId: string | null; // Required if type === 'expense'
  savingsGoalId: string | null; // Required if type === 'savings'
  notes?: string;
}

// -----------------------------------------------------------------------------
// Forecast Event - One-off forecast items with specific dates
// -----------------------------------------------------------------------------

export interface ForecastEvent extends BaseEntity {
  scenarioId: string;
  type: ForecastType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null; // Required if type === 'expense'
  savingsGoalId: string | null; // Required if type === 'savings'
  notes?: string;
}

// -----------------------------------------------------------------------------
// Transaction - Actual income, expenses, and savings (global facts)
// -----------------------------------------------------------------------------

export type TransactionType = 'income' | 'expense' | 'savings' | 'adjustment';

export interface Transaction extends BaseEntity {
  type: TransactionType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null; // Optional for expenses, null for income/savings
  savingsGoalId: string | null; // Required if type === 'savings'
  notes?: string;
}

// -----------------------------------------------------------------------------
// Savings Goal - Global savings targets
// -----------------------------------------------------------------------------

export interface SavingsGoal extends BaseEntity {
  name: string;
  targetAmountCents: number;
  deadline?: string;
}

// -----------------------------------------------------------------------------
// View State - UI state for date range selection (not persisted as entity)
// -----------------------------------------------------------------------------

export interface ViewState {
  startDate: string;
  endDate: string;
}

// -----------------------------------------------------------------------------
// Aggregate Types
// -----------------------------------------------------------------------------

export interface BudgetData {
  scenarios: Scenario[];
  categories: Category[];
  budgetRules: BudgetRule[];
  forecastRules: ForecastRule[];
  forecastEvents: ForecastEvent[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
}

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

export type CreateEntity<T extends BaseEntity> = Omit<
  T,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'userId' | 'createdAt'>>;

// -----------------------------------------------------------------------------
// Expanded Forecast - A materialized forecast for a specific date (computed)
// -----------------------------------------------------------------------------

export interface ExpandedForecast {
  type: ForecastType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null;
  savingsGoalId: string | null;
  sourceType: 'rule' | 'event';
  sourceId: string;
}
