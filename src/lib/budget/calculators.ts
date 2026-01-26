import type {
  Category,
  Income,
  Expense,
  ProjectedIncome,
  BudgetedExpense,
  SavingsAccount,
} from '../../types';

export function calculateTotalSpent(expenses: Expense[]) {
  const total = expenses.reduce((acc: number, expense: Expense) => acc + expense.amount, 0);
  return total;
}

export function calculateTotalIncomeReceived(incomes: Income[]) {
  const total = incomes.reduce((acc: number, income: Income) => acc + income.amount, 0);
  return total;
}

export function calculateTotalSavedForAccount() {}

export function calculateTotalSaved(
  savingsAccounts: SavingsAccount[],
  savingsWithdrawals: SavingsWithdrawal[],
  savingsDeposit: SavingsAccount[]
){
  const startingBalance = savingsAccounts.reduce((accumulator: number, account: SavingsAccount) => accumulator + account.startingAmount, 0);
  let total = 0;
  savingsAccounts.forEach((account) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expectedDate = new Date(account.date);
    if (account.categoryId === category.id && expectedDate <= today) {
      total += account.amount;
    }
  });
  return total;

  return total
}

export function calculateCurrentBankBalance(startingBankBalance: number, expenses: Expense[], incomes: Income[], savingsAccounts: SavingsAccount[]) {
  if (startingBankBalance == null) return 0;

  const totalSaved = calculateTotalSaved(savingsAccounts)
  const totalSpent = calculateTotalSpent(expenses);
  const totalReceived = calculateTotalIncomeReceived(incomes);
  const balance = startingBankBalance + totalReceived - totalSpent - totalSaved;
  return balance;
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
  current: number,
  projectedIncomes: ProjectedIncome[],
  budgetedExpenses: BudgetedExpense[],
  savingsAccounts: SavingsAccount[],
) {
  const comingIn = calculateProjectedIncome(projectedIncomes);
  const goingOut = calculateBudgetedExpenses(budgetedExpenses);
  const totalSaved = calculateTotalSaved(savingsAccounts)
  const available = current + comingIn - goingOut - totalSaved;
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
