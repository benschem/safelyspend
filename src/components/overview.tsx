import {
  calculateCurrentBankBalance,
  calculateProjectedIncome,
  calculateBudgetedExpenses,
  calculateAvailableToSpend,
} from '../lib/budget/calculators';

import useBankBalance from '../hooks/useBankBalance';
import useExpenses from '../hooks/useExpenses';
import useBudgetedExpenses from '../hooks/useBudgetedExpenses';
import useIncomes from '../hooks/useIncomes';
import useProjectedIncomes from '../hooks/useProjectedIncomes';
import useSavingsBuckets from '../hooks/useSavingsBuckets';

export default function Overview() {
  const { bankBalance } = useBankBalance();
  const { expenses } = useExpenses();
  const { budgetedExpenses } = useBudgetedExpenses();
  const { incomes } = useIncomes();
  const { projectedIncomes } = useProjectedIncomes();
  const { savingsBuckets } = useSavingsBuckets();

  const startingBalance = bankBalance.amount;
  const balance = calculateCurrentBankBalance(startingBalance, expenses, incomes);
  const projectedIncome = calculateProjectedIncome(projectedIncomes);
  const allocated = calculateBudgetedExpenses(budgetedExpenses);
  const free = calculateAvailableToSpend(
    incomes,
    startingBalance,
    expenses,
    projectedIncomes,
    budgetedExpenses,
  );
  const weeksUntilEofy = 39;
  const available = free / weeksUntilEofy;

  const format = (number: number) => {
    return number.toLocaleString('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div>
      <p>You currently should have ${format(balance)} in the bank</p>
      <h2>Until EOFY:</h2>
      <ul>
        <li>You should earn ${format(projectedIncome)}</li>
        <li>You have allocated ${format(allocated)}</li>
        <li>You have not allocated ${format(free)}</li>
        <li>You could spend up to ${format(available)} per week</li>
      </ul>
      <ul>
        {savingsBuckets.map(bucket => (
          <li key={bucket.id}>
            {bucket.name}: ${format(bucket.amount)}/${format(bucket.goal)}
          </li>
        ))}
      </ul>
    </div>
  );
}
