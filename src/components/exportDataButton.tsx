import useBudgetData from '../hooks/useBudgetData';
import { exportBudgetToJson } from '../lib/budget/importExport'

export default function ExportDataButton() {
  const { budgetData } = useBudgetData();

  if (!budgetData) {
    throw new Error('Cannot export nothing');
  }

  return(
    <button
      type="button"
      onClick={() => {
        exportBudgetToJson(budgetData);
      }}
    >
      Export Budget
    </button>
  )
}
