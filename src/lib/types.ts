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
// Period - Primary aggregate root / workspace
// -----------------------------------------------------------------------------

export interface Period extends BaseEntity {
  name: string;
  startDate: string;
  endDate: string;
}

// -----------------------------------------------------------------------------
// Account
// -----------------------------------------------------------------------------

export interface Account extends BaseEntity {
  name: string;
  isArchived: boolean;
}

// -----------------------------------------------------------------------------
// Opening Balance - Per account, per period
// -----------------------------------------------------------------------------

export interface OpeningBalance extends BaseEntity {
  accountId: string;
  periodId: string;
  amountCents: number;
}

// -----------------------------------------------------------------------------
// Category
// -----------------------------------------------------------------------------

export interface Category extends BaseEntity {
  name: string;
  isArchived: boolean;
}

// -----------------------------------------------------------------------------
// Budget Line - Per category, per period
// -----------------------------------------------------------------------------

export interface BudgetLine extends BaseEntity {
  periodId: string;
  categoryId: string;
  amountCents: number;
}

// -----------------------------------------------------------------------------
// Forecast - Unified income and expense forecasts
// -----------------------------------------------------------------------------

export type ForecastType = 'income' | 'expense';

export interface Forecast extends BaseEntity {
  periodId: string;
  type: ForecastType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null; // Required if type === 'expense'
  notes?: string;
}

// -----------------------------------------------------------------------------
// Transaction - Actual income and expenses
// -----------------------------------------------------------------------------

export type TransactionType = 'income' | 'expense';

export interface Transaction extends BaseEntity {
  accountId: string;
  type: TransactionType;
  date: string;
  amountCents: number;
  description: string;
  categoryId: string | null; // Optional for expenses, null for income
  notes?: string;
}

// -----------------------------------------------------------------------------
// Transfer - Between accounts
// -----------------------------------------------------------------------------

export interface Transfer extends BaseEntity {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amountCents: number;
  notes?: string;
}

// -----------------------------------------------------------------------------
// Savings Goal
// -----------------------------------------------------------------------------

export interface SavingsGoal extends BaseEntity {
  periodId: string | null; // null = global goal
  name: string;
  targetAmountCents: number;
  currentAmountCents: number; // Manually updated for phase 1
  deadline?: string;
}

// -----------------------------------------------------------------------------
// Aggregate Types
// -----------------------------------------------------------------------------

export interface BudgetData {
  periods: Period[];
  accounts: Account[];
  openingBalances: OpeningBalance[];
  categories: Category[];
  budgetLines: BudgetLine[];
  forecasts: Forecast[];
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
