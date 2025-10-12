import React from 'react';
import { importBudgetFromJson } from '../lib/budget/importExport';
import type { BudgetData } from '../types';

export default function ImportBudgetButton(
  {
    onImport,
  }: { onImport: (data: BudgetData) => void }) {
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const data = await importBudgetFromJson(file);
    if (data) {
      onImport(data);
    } else {
      alert('Invalid JSON file');
    }
  };

  return (
    <label style={{ cursor: 'pointer' }}>
      Import Budget
      <input
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </label>
  );
}
