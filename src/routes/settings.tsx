import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { loadDemoDataToStorage, clearAllData } from '@/lib/demo-data';
import type { BudgetData } from '@/lib/types';

function getAllData(): BudgetData & { activePeriodId: string | null } {
  return {
    periods: JSON.parse(localStorage.getItem('budget:periods') ?? '[]'),
    activePeriodId: JSON.parse(localStorage.getItem('budget:activePeriodId') ?? 'null'),
    accounts: JSON.parse(localStorage.getItem('budget:accounts') ?? '[]'),
    openingBalances: JSON.parse(localStorage.getItem('budget:openingBalances') ?? '[]'),
    categories: JSON.parse(localStorage.getItem('budget:categories') ?? '[]'),
    budgetLines: JSON.parse(localStorage.getItem('budget:budgetLines') ?? '[]'),
    forecasts: JSON.parse(localStorage.getItem('budget:forecasts') ?? '[]'),
    transactions: JSON.parse(localStorage.getItem('budget:transactions') ?? '[]'),
    transfers: JSON.parse(localStorage.getItem('budget:transfers') ?? '[]'),
    savingsGoals: JSON.parse(localStorage.getItem('budget:savingsGoals') ?? '[]'),
  };
}

function setAllData(data: BudgetData & { activePeriodId?: string | null }): void {
  localStorage.setItem('budget:periods', JSON.stringify(data.periods));
  if (data.activePeriodId !== undefined) {
    localStorage.setItem('budget:activePeriodId', JSON.stringify(data.activePeriodId));
  }
  localStorage.setItem('budget:accounts', JSON.stringify(data.accounts));
  localStorage.setItem('budget:openingBalances', JSON.stringify(data.openingBalances));
  localStorage.setItem('budget:categories', JSON.stringify(data.categories));
  localStorage.setItem('budget:budgetLines', JSON.stringify(data.budgetLines));
  localStorage.setItem('budget:forecasts', JSON.stringify(data.forecasts));
  localStorage.setItem('budget:transactions', JSON.stringify(data.transactions));
  localStorage.setItem('budget:transfers', JSON.stringify(data.transfers));
  localStorage.setItem('budget:savingsGoals', JSON.stringify(data.savingsGoals));
}

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLoadDemo = () => {
    loadDemoDataToStorage();
    showMessage('success', 'Demo data loaded. Refresh the page to see changes.');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleExport = () => {
    const data = getAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('success', 'Data exported successfully.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Basic validation
        const requiredKeys = ['periods', 'accounts', 'categories', 'transactions', 'forecasts'];
        const missingKeys = requiredKeys.filter((key) => !Array.isArray(data[key]));
        if (missingKeys.length > 0) {
          showMessage('error', `Invalid file: missing ${missingKeys.join(', ')}`);
          return;
        }

        setAllData(data);
        showMessage('success', 'Data imported successfully. Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        showMessage('error', 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }

    clearAllData();
    setConfirmingClear(false);
    showMessage('success', 'All data cleared. Refreshing...');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Manage your data and preferences.</p>

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <Separator className="my-6" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Demo Data</h2>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Load Demo Data</h3>
            <p className="text-sm text-muted-foreground">
              Populate the app with sample data to explore features.
            </p>
          </div>
          <Button variant="outline" onClick={handleLoadDemo}>
            Load Demo
          </Button>
        </div>
      </section>

      <Separator className="my-6" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Data Management</h2>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Export Data</h3>
            <p className="text-sm text-muted-foreground">Download all your budget data as JSON.</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            Export
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Import Data</h3>
            <p className="text-sm text-muted-foreground">Restore from a JSON backup file.</p>
          </div>
          <Button variant="outline" onClick={handleImportClick}>
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
          <div>
            <h3 className="font-medium text-destructive">Clear All Data</h3>
            <p className="text-sm text-muted-foreground">Permanently delete all budget data.</p>
          </div>
          <div className="flex gap-2">
            {confirmingClear && (
              <Button variant="outline" onClick={() => setConfirmingClear(false)}>
                Cancel
              </Button>
            )}
            <Button variant="destructive" onClick={handleClear}>
              {confirmingClear ? 'Confirm Clear' : 'Clear Data'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
