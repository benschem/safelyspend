import type { BudgetData } from '../types';

import useStartingBankBalance from "./useStartingBankBalance";
import useBudgetedExpenses from "./useBudgetedExpenses";
import useCategories from "./useCategories";
import useExpenses from "./useExpenses";
import useIncomes from "./useIncomes";
import useProjectedIncomes from "./useProjectedIncomes";
import useSavingsAccounts from "./useSavingsAccounts";

export default function useBudgetData() {
  const { startingBankBalance, setStartingBankBalance } = useStartingBankBalance();
  const { categories, setCategories } = useCategories();
  const { incomes, setIncomes } = useIncomes();
  const { expenses, setExpenses } = useExpenses();
  const { projectedIncomes, setProjectedIncomes } = useProjectedIncomes();
  const { budgetedExpenses, setBudgetedExpenses } = useBudgetedExpenses();
  const { savingsAccounts, setSavingsAccounts } = useSavingsAccounts();

  const budgetData: BudgetData = {
    startingBankBalance,
    categories,
    incomes,
    expenses,
    projectedIncomes,
    budgetedExpenses,

    savingsAccounts,
  };

  const setBudgetData = (data: BudgetData) => {
    setStartingBankBalance(data.startingBankBalance);
    setCategories(data.categories);
    setIncomes(data.incomes);
    setExpenses(data.expenses);
    setProjectedIncomes(data.projectedIncomes);
    setBudgetedExpenses(data.budgetedExpenses);
    setSavingsAccounts(data.savingsAccounts);
  }

  return { budgetData, setBudgetData };
}
