import {
  calculateCurrentBankBalance,
  calculateProjectedIncome,
  calculateBudgetedExpenses,
  calculateAvailableToSpend,
  calculateTotalSaved,
} from '../lib/budget/calculators';
import type { SavingsAccount } from '../types';

import useStartingBankBalance from '../hooks/useStartingBankBalance';
import useExpenses from '../hooks/useExpenses';
import useBudgetedExpenses from '../hooks/useBudgetedExpenses';
import useIncomes from '../hooks/useIncomes';
import useProjectedIncomes from '../hooks/useProjectedIncomes';
import useSavingsAccounts from '../hooks/useSavingsAccounts';

export default function Overview() {
  const { startingBankBalance } = useStartingBankBalance();
  const { expenses } = useExpenses();
  const { budgetedExpenses } = useBudgetedExpenses();
  const { incomes } = useIncomes();
  const { projectedIncomes } = useProjectedIncomes();
  const { savingsAccounts } = useSavingsAccounts();

  const startingBalance = startingBankBalance.amount;
  const balance = calculateCurrentBankBalance(startingBalance, expenses, incomes, savingsAccounts);
  const projectedIncome = calculateProjectedIncome(projectedIncomes);
  const allocated = calculateBudgetedExpenses(budgetedExpenses);
  const free = calculateAvailableToSpend(
    balance,
    projectedIncomes,
    budgetedExpenses,
    savingsAccounts,
  );
  const calculateSavingsInAccount = (account: SavingsAccount) => {
    const saved = calculateTotalSaved([account])
    return saved
  }

  const format = (number: number) => {
    return number.toLocaleString('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div>
      <h2>Overview (Until EOFY)</h2>
      <ul>
        <li>You currently have ${format(balance)} in the bank</li>
        <li>You should earn ${format(projectedIncome)}</li>
        <li>You have allocated ${format(allocated)} of it</li>
        <li>You have not allocated ${format(free)} of it </li>
      </ul>
      <ul>
        {savingsAccounts.map((account: SavingsAccount) => (
          <li key={account.id}>
            {account.name}: ${format(calculateSavingsInAccount(account))}/${format(account.goal)}
          </li>
        ))}
      </ul>
    </div>
  );
}
