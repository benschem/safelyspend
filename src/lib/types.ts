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
// Account - Bank accounts with opening balance
// -----------------------------------------------------------------------------

export interface Account extends BaseEntity {
  name: string;
  openingBalanceCents: number;
  openingDate: string; // When tracking started for this account
  isArchived: boolean;
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

export type TransactionType = 'income' | 'expense' | 'savings';

export interface Transaction extends BaseEntity {
  accountId: string;
  type: TransactionType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null; // Optional for expenses, null for income/savings
  savingsGoalId: string | null; // Required if type === 'savings'
  notes?: string;
}

// -----------------------------------------------------------------------------
// Transfer - Between accounts (global facts)
// -----------------------------------------------------------------------------

export interface Transfer extends BaseEntity {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amountCents: number;
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
  accounts: Account[];
  categories: Category[];
  budgetRules: BudgetRule[];
  forecastRules: ForecastRule[];
  forecastEvents: ForecastEvent[];
  transactions: Transaction[];
  transfers: Transfer[];
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
