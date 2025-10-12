import type { BudgetData } from '../../types';

export async function importBudgetFromJson(file: File): Promise<BudgetData | null> {
  try {
    const text = await file.text();
    const jsonData = JSON.parse(text) as BudgetData;
    return jsonData;
  } catch (error) {
    console.error('Failed to parse uploaded JSON file', error);
    return null;
  }
}

export function exportBudgetToJson(budgetData: BudgetData): void {
  if (!budgetData) return;

  const jsonString = JSON.stringify(budgetData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'budgetData.json';
  a.click();
  URL.revokeObjectURL(url);
}
