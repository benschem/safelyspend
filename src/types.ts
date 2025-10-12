export interface BankBalance {
  amount: number;
}
export interface BudgetData {
  bankBalance: BankBalance;
  incomes: Income[];
  expenses: Expense[];
  projectedIncomes: ProjectedIncome[];
  budgetedExpenses: BudgetedExpense[];
  categories: Category[];
  savingsBuckets: SavingsBucket[];
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

export interface SavingsBucket {
  id: string; // crypto.randomUUID()
  name: string;
  amount: number;
  goal: number;
}
