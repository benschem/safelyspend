import type { Cadence, TransactionType } from '@/lib/types';

export interface PersonaConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  income: IncomeConfig;
  expenses: ExpensePattern[];
  budgets: BudgetConfig[];
  savingsGoals: SavingsGoalConfig[];
  scenarios: ScenarioConfig[];
  categories: string[]; // Category names to create
}

export interface IncomeConfig {
  primary: {
    description: string;
    amountCents: number;
    cadence: Cadence;
    variance?: number; // 0-1, percentage variance (e.g., 0.1 = ±10%)
  };
  extras?: {
    description: string;
    amountCents: number;
    frequency: 'quarterly' | 'yearly' | 'occasional';
    months?: number[]; // For quarterly/yearly, which months (1-12)
    probability?: number; // For occasional, 0-1 chance per month
  }[];
}

export interface ExpensePattern {
  category: string;
  patterns: {
    description: string | string[]; // Single or array to pick from randomly
    amountCents: number;
    variance?: number; // 0-1, percentage variance
    frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'occasional';
    probability?: number; // For occasional, 0-1 chance per occurrence window
    dayOfWeek?: number; // 0-6 for weekly patterns
    dayOfMonth?: number; // 1-31 for monthly patterns
  }[];
}

export interface BudgetConfig {
  category: string;
  amountCents: number;
  cadence: Cadence;
}

export interface SavingsGoalConfig {
  name: string;
  targetAmountCents: number;
  isEmergencyFund?: boolean;
  deadline?: { monthsFromNow: number };
  startingBalanceCents?: number; // Balance at start of data period
  monthlyContributionCents?: number;
  annualInterestRate?: number;
}

export interface ScenarioConfig {
  name: string;
  description?: string;
  isDefault: boolean;
  // Budget overrides for this scenario (if different from main budgets)
  budgetOverrides?: {
    category: string;
    amountCents: number;
  }[];
  // Income multiplier for this scenario (e.g., 0.8 = 20% pay cut, 1.15 = 15% raise)
  incomeMultiplier?: number;
  // Savings goal contribution overrides
  savingsOverrides?: {
    goalName: string;
    monthlyContributionCents: number;
  }[];
  // One-off forecast events for this scenario (e.g., expected bonus)
  forecastEvents?: {
    description: string;
    type: 'income' | 'expense';
    amountCents: number;
    monthsFromNow: number;
  }[];
}

// Generated data ready for database insertion
export interface GeneratedData {
  categories: GeneratedCategory[];
  scenarios: GeneratedScenario[];
  budgetRules: GeneratedBudgetRule[];
  forecastRules: GeneratedForecastRule[];
  forecastEvents: GeneratedForecastEvent[];
  transactions: GeneratedTransaction[];
  savingsGoals: GeneratedSavingsGoal[];
  balanceAnchors: GeneratedBalanceAnchor[];
}

export interface GeneratedCategory {
  id: string;
  name: string;
}

export interface GeneratedScenario {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

export interface GeneratedBudgetRule {
  id: string;
  scenarioId: string;
  categoryId: string;
  amountCents: number;
  cadence: Cadence;
}

export interface GeneratedForecastRule {
  id: string;
  scenarioId: string;
  categoryId: string | null;
  savingsGoalId?: string;
  description: string;
  type: TransactionType;
  amountCents: number;
  cadence: Cadence;
  dayOfWeek?: number;
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string;
}

export interface GeneratedForecastEvent {
  id: string;
  scenarioId: string;
  categoryId: string | null;
  description: string;
  type: TransactionType;
  amountCents: number;
  date: string;
}

export interface GeneratedTransaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  savingsGoalId?: string | null;
  notes?: string;
}

export interface GeneratedSavingsGoal {
  id: string;
  name: string;
  targetAmountCents: number;
  isEmergencyFund?: boolean;
  deadline?: string;
  annualInterestRate?: number;
}

export interface GeneratedBalanceAnchor {
  id: string;
  date: string;
  balanceCents: number;
  description: string;
}
