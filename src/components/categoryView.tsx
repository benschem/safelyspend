import type { Category } from "../types";
import {
    calculateTotalSpendPerCategory,
    calculateTotalPastBudgetedExpensesPerCategory,
    calculateFutureSpendPerCategoryPerMonth,
    calculateBudgetStatus,
  } from '../lib/budget/calculators';
import moneyFormatter from './helpers/moneyFormatter';
import useBudgetedExpenses from '../hooks/useBudgetedExpenses';
import useExpenses from '../hooks/useExpenses';

interface CategoryProps {
  category: Category;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function CategoryCard({ category, onEdit, onDelete }: CategoryProps) {
  const { budgetedExpenses } = useBudgetedExpenses()
  const { expenses } = useExpenses()

  if (!category) {
    return <div>Loading...</div>;
  }

  const spent = calculateTotalSpendPerCategory(expenses, category);
  const budgeted = calculateTotalPastBudgetedExpensesPerCategory(budgetedExpenses, category);
  const futureSpendPerMonth = calculateFutureSpendPerCategoryPerMonth(budgetedExpenses, category);
  const status = `${calculateBudgetStatus(spent, budgeted)} budget`;


  return (
    <li>
      <h3>{category.name}</h3>
      <p>{status}</p>
      <p>
        Spent ${moneyFormatter(spent)} out of budgeted ${moneyFormatter(budgeted)} this
        financial year.
      </p>
      <p>From now until EOFY you have budgeted ${moneyFormatter(futureSpendPerMonth)} per month</p>
      <button onClick={() => onEdit(category.id)}>Edit</button>
      <button onClick={() => onDelete(category.id)}>Delete</button>
    </li>
  );
}
