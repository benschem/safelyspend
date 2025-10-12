import type {
  Category,
  Income,
  Expense,
  ProjectedIncome,
  BudgetedExpense,
  SavingsBucket,
} from '../../types';

export function calculateTotalSpent(expenses: Expense[]) {
  const total = expenses.reduce((acc: number, expense: Expense) => acc + expense.amount, 0);
  return total;
}

export function calculateTotalIncomeReceived(incomes: Income[]) {
  const total = incomes.reduce((acc: number, income: Income) => acc + income.amount, 0);
  return total;
}

export function calculateCurrentBankBalance(bankBalance: number, expenses: Expense[], incomes: Income[], savingsBuckets: savingsBucket[]) {
  if (bankBalance == null) return 0;

  const totalSaved = calculateTotalSaved(savingsBuckets)
  const totalSpent = calculateTotalSpent(expenses);
  const totalReceived = calculateTotalIncomeReceived(incomes);
  const balance = bankBalance - totalSpent + totalReceived - totalSaved;
  return balance;
}

export function calculateTotalSaved(savingsBuckets: SavingsBucket[]) {
  const total = savingsBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  return total
}

export function calculateProjectedIncome(projectedIncomes: ProjectedIncome[]) {
  let total = 0;
  projectedIncomes.forEach((projected) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedDate = new Date(projected.date);
    const endOfFinancialYear = new Date('2026-07-01');
    if (expectedDate > today && expectedDate < endOfFinancialYear) {
      total += projected.amount;
    }
  });
  return total;
}

export function calculateBudgetedExpenses(budgetedExpenses: BudgetedExpense[]) {
  let total = 0;
  budgetedExpenses.forEach((projected) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedDate = new Date(projected.date);
    const endOfFinancialYear = new Date('2026-07-01');
    if (expectedDate > today && expectedDate < endOfFinancialYear) {
      total += projected.amount;
    }
  });
  return total;
}

export function calculateAvailableToSpend(
  incomes: Income[],
  bankBalance: number,
  expenses: Expense[],
  projectedIncomes: ProjectedIncome[],
  budgetedExpenses: BudgetedExpense[],
) {
  const current = calculateCurrentBankBalance(bankBalance, expenses, incomes);
  const comingIn = calculateProjectedIncome(projectedIncomes);
  const goingOut = calculateBudgetedExpenses(budgetedExpenses);
  const available = current + comingIn - goingOut;
  return available;
}

export function calculateTotalSpendPerCategory(expenses: Expense[], category: Category) {
  let total = 0;
  expenses.forEach((expense) => {
    if (expense.categoryId === category.id) {
      total += expense.amount;
    }
  });
  return total;
}

export function calculateTotalPastBudgetedExpensesPerCategory(
  budgetedExpenses: BudgetedExpense[],
  category: Category,
) {
  let total = 0;
  budgetedExpenses.forEach((budgetedExpense) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedDate = new Date(budgetedExpense.date);
    if (budgetedExpense.categoryId === category.id && expectedDate <= today) {
      total += budgetedExpense.amount;
    }
  });
  return total;
}

export function calculateFutureSpendPerCategoryPerMonth(
  budgetedExpenses: BudgetedExpense[],
  category: Category,
) {
  let total = 0;
  budgetedExpenses.forEach((budgetedExpense) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfFinancialYear = new Date('2026-07-01');
    const expectedDate = new Date(budgetedExpense.date);
    if (
      budgetedExpense.categoryId === category.id &&
      expectedDate.getTime() > today.getTime() &&
      expectedDate.getTime() < endOfFinancialYear.getTime()
    ) {
      total += budgetedExpense.amount;
    }
  });
  const monthsBetweenNowAndEndOfFinancialYear = 9;
  return total / monthsBetweenNowAndEndOfFinancialYear;
}

export function calculateBudgetStatus(spent: number, budgeted: number) {
  let status;
  if (spent > budgeted) {
    status = 'Over';
  } else if (spent === budgeted) {
    status = 'On';
  } else {
    status = 'Under';
  }
  return status;
}
