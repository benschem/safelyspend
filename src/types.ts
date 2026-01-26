export interface StartingBankBalance {
  amount: number;
  date: string; // ISO date string
}
export interface BudgetData {
  startingBankBalance: StartingBankBalance;
  incomes: Income[];
  expenses: Expense[];
  projectedIncomes: ProjectedIncome[];
  budgetedExpenses: BudgetedExpense[];
  categories: Category[];
  savingsAccounts: SavingsAccount[];
}

export interface BudgetedExpense {
  id: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
  categoryId: string;
  notes?: string;
  recurrence_group_id?: number;
}

export interface Category {
  id: string; // crypto.randomUUID()
  name: string;
}

export interface Expense {
  id: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
  categoryId: string;
  notes?: string;
}

export interface Income {
  id: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
  source: string;
  notes?: string;
}

export interface ProjectedIncome {
  id: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
  source: string;
  notes?: string;
  recurrence_group_id?: string;
}

export interface SavingsWithdrawal {
  id: string; // crypto.randomUUID()
  savingsAccountId: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
  notes?: string;
}

export interface SavingsDeposit {
  id: string; // crypto.randomUUID()
  savingsAccountId: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
}
export interface ProjectedSavingsDeposit {
  id: string; // crypto.randomUUID()
  savingsAccountId: string; // crypto.randomUUID()
  amount: number;
  date: string; // ISO date string
}

export interface SavingsAccount {
  id: string; // crypto.randomUUID()
  name: string;
  startingAmount: number;
  startingDate: string // ISO date string
  // interestRate: number;
  goal: number;
}
