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
  dayOfWeek?: number; // 0-6 for weekly/fortnightly
  dayOfMonth?: number; // 1-31 for monthly/quarterly/yearly
  monthOfQuarter?: number; // 0-2 (1st, 2nd, 3rd month of quarter) for quarterly
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
  excludedDates?: string[]; // ISO dates to skip when expanding (for "delete this occurrence")
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

  // Import tracking
  importFingerprint?: string; // For deduplication
  importSource?: string; // e.g., 'up-csv', 'manual'
  importedAt?: string; // Timestamp of import
}

// -----------------------------------------------------------------------------
// Balance Anchor - Declarative balance snapshot at a point in time
// -----------------------------------------------------------------------------

export interface BalanceAnchor extends BaseEntity {
  date: string; // ISO date (YYYY-MM-DD) - balance as of START of this date
  balanceCents: number;
  label?: string; // e.g., "Opening balance", "After reconciliation"
}

// -----------------------------------------------------------------------------
// Category Rule - Auto-categorization rules for imported transactions
// -----------------------------------------------------------------------------

export type CategoryRuleMatchType = 'contains' | 'startsWith' | 'equals';

export interface CategoryRule extends BaseEntity {
  name: string;
  matchField: 'description' | 'payee';
  matchType: CategoryRuleMatchType;
  matchValue: string; // Case-insensitive matching
  categoryId: string;
  amountMinCents?: number;
  amountMaxCents?: number;
  transactionType?: 'income' | 'expense';
  priority: number; // Lower = higher priority
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// Savings Goal - Global savings targets
// -----------------------------------------------------------------------------

export type CompoundingFrequency = 'daily' | 'monthly' | 'yearly';

export interface SavingsGoal extends BaseEntity {
  name: string;
  targetAmountCents: number;
  deadline?: string;
  annualInterestRate?: number; // Percentage, e.g., 4.5 for 4.5%
  compoundingFrequency?: CompoundingFrequency; // Defaults to 'monthly' if rate is set
  isEmergencyFund?: boolean; // Only one goal can be marked as emergency fund
}

// -----------------------------------------------------------------------------
// Timeline Picker Types
// -----------------------------------------------------------------------------

export type TimelineMode = 'past' | 'around-present' | 'future' | 'custom';
export type TimelineUnit = 'months' | 'years';

// -----------------------------------------------------------------------------
// View State - UI state for date range selection (not persisted as entity)
// -----------------------------------------------------------------------------

export type PresetTimelineMode = 'past' | 'around-present' | 'future';

export interface ViewState {
  mode: TimelineMode;
  amount: number;
  unit: TimelineUnit;
  lastPresetMode?: PresetTimelineMode; // Remember last non-custom mode
  customStartDate?: string;
  customEndDate?: string;
}

// -----------------------------------------------------------------------------
// Aggregate Types
// -----------------------------------------------------------------------------

export interface BudgetData {
  scenarios: Scenario[];
  categories: Category[];
  budgetRules: BudgetRule[];
  forecastRules: ForecastRule[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  balanceAnchors: BalanceAnchor[];
  categoryRules: CategoryRule[];
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
  sourceType: 'rule' | 'interest';
  sourceId: string;
}
