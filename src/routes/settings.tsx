import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { UpImportDialog } from '@/components/up-import-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { clearAllData } from '@/lib/demo-data';
import { formatCents, formatDate, today } from '@/lib/utils';
import type { BudgetData } from '@/lib/types';

function getAllData(): BudgetData & { activeScenarioId: string | null } {
  return {
    scenarios: JSON.parse(localStorage.getItem('budget:scenarios') ?? '[]'),
    activeScenarioId: JSON.parse(localStorage.getItem('budget:activeScenarioId') ?? 'null'),
    categories: JSON.parse(localStorage.getItem('budget:categories') ?? '[]'),
    budgetRules: JSON.parse(localStorage.getItem('budget:budgetRules') ?? '[]'),
    forecastRules: JSON.parse(localStorage.getItem('budget:forecastRules') ?? '[]'),
    forecastEvents: JSON.parse(localStorage.getItem('budget:forecastEvents') ?? '[]'),
    transactions: JSON.parse(localStorage.getItem('budget:transactions') ?? '[]'),
    savingsGoals: JSON.parse(localStorage.getItem('budget:savingsGoals') ?? '[]'),
    balanceAnchors: JSON.parse(localStorage.getItem('budget:balanceAnchors') ?? '[]'),
    categoryRules: JSON.parse(localStorage.getItem('budget:categoryRules') ?? '[]'),
  };
}

function setAllData(data: BudgetData & { activeScenarioId?: string | null }): void {
  localStorage.setItem('budget:scenarios', JSON.stringify(data.scenarios));
  if (data.activeScenarioId !== undefined) {
    localStorage.setItem('budget:activeScenarioId', JSON.stringify(data.activeScenarioId));
  }
  localStorage.setItem('budget:categories', JSON.stringify(data.categories));
  localStorage.setItem('budget:budgetRules', JSON.stringify(data.budgetRules));
  localStorage.setItem('budget:forecastRules', JSON.stringify(data.forecastRules));
  localStorage.setItem('budget:forecastEvents', JSON.stringify(data.forecastEvents));
  localStorage.setItem('budget:transactions', JSON.stringify(data.transactions));
  localStorage.setItem('budget:savingsGoals', JSON.stringify(data.savingsGoals));
  localStorage.setItem('budget:balanceAnchors', JSON.stringify(data.balanceAnchors ?? []));
  localStorage.setItem('budget:categoryRules', JSON.stringify(data.categoryRules ?? []));
  localStorage.setItem('budget:appConfig', JSON.stringify({ isInitialized: true }));
}

export function SettingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [upImportOpen, setUpImportOpen] = useState(false);

  // Anchor management state
  const { anchors, addAnchor, updateAnchor, deleteAnchor } = useBalanceAnchors();
  const [anchorDialogOpen, setAnchorDialogOpen] = useState(false);
  const [editingAnchorId, setEditingAnchorId] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(today());
  const [anchorAmount, setAnchorAmount] = useState('');
  const [anchorLabel, setAnchorLabel] = useState('');
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [deletingAnchorId, setDeletingAnchorId] = useState<string | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
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
        const requiredKeys = ['scenarios', 'categories', 'transactions'];
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
    navigate('/landing');
  };

  // Anchor handlers
  const openAddAnchor = () => {
    setEditingAnchorId(null);
    setAnchorDate(today());
    setAnchorAmount('');
    setAnchorLabel('');
    setAnchorError(null);
    setAnchorDialogOpen(true);
  };

  const openEditAnchor = (anchor: (typeof anchors)[0]) => {
    setEditingAnchorId(anchor.id);
    setAnchorDate(anchor.date);
    setAnchorAmount((anchor.balanceCents / 100).toFixed(2));
    setAnchorLabel(anchor.label ?? '');
    setAnchorError(null);
    setAnchorDialogOpen(true);
  };

  const handleSaveAnchor = () => {
    setAnchorError(null);

    const amount = parseFloat(anchorAmount);
    if (isNaN(amount)) {
      setAnchorError('Please enter a valid amount');
      return;
    }

    const balanceCents = Math.round(amount * 100);

    try {
      if (editingAnchorId) {
        const updates: Parameters<typeof updateAnchor>[1] = {
          date: anchorDate,
          balanceCents,
        };
        if (anchorLabel) {
          updates.label = anchorLabel;
        }
        updateAnchor(editingAnchorId, updates);
        showMessage('success', 'Anchor updated');
      } else {
        const data: Parameters<typeof addAnchor>[0] = {
          date: anchorDate,
          balanceCents,
        };
        if (anchorLabel) {
          data.label = anchorLabel;
        }
        addAnchor(data);
        showMessage('success', 'Anchor added');
      }
      setAnchorDialogOpen(false);
    } catch (err) {
      setAnchorError(err instanceof Error ? err.message : 'Failed to save anchor');
    }
  };

  const handleDeleteAnchor = (id: string) => {
    if (deletingAnchorId !== id) {
      setDeletingAnchorId(id);
      return;
    }
    deleteAnchor(id);
    setDeletingAnchorId(null);
    showMessage('success', 'Anchor deleted');
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
        <h2 className="text-lg font-semibold">Appearance</h2>

        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Theme</h3>
            <p className="text-sm text-muted-foreground">Choose light, dark, or system theme.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <Separator className="my-6" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Data Management</h2>

        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Export Data</h3>
            <p className="text-sm text-muted-foreground">Download all your budget data as JSON.</p>
          </div>
          <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
            Export
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Import Data</h3>
            <p className="text-sm text-muted-foreground">Restore from a JSON backup file.</p>
          </div>
          <Button variant="outline" onClick={handleImportClick} className="w-full sm:w-auto">
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

        <div className="flex flex-col gap-3 rounded-lg border border-destructive/50 p-4 sm:flex-row sm:items-center sm:justify-between">
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

      <Separator className="my-6" />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Balance Anchors</h2>
            <p className="text-sm text-muted-foreground">
              Set your known balance at specific dates. Used as the baseline for balance calculations.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openAddAnchor}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {anchors.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground">No balance anchors set.</p>
            <Button variant="outline" className="mt-4" onClick={openAddAnchor}>
              Add your first anchor
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {anchors.map((anchor) => (
              <div
                key={anchor.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{formatDate(anchor.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCents(anchor.balanceCents)}
                    {anchor.label && ` - ${anchor.label}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {deletingAnchorId === anchor.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingAnchorId(null)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditAnchor(anchor)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={deletingAnchorId === anchor.id ? 'destructive' : 'ghost'}
                    size="sm"
                    onClick={() => handleDeleteAnchor(anchor.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Transactions before the earliest anchor date won&apos;t affect balance calculations but will
          still appear in spending reports.
        </p>
      </section>

      <Separator className="my-6" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Import Transactions</h2>

        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Import from Up Bank</h3>
            <p className="text-sm text-muted-foreground">
              Import transactions from an Up Bank CSV export.
            </p>
          </div>
          <Button variant="outline" onClick={() => setUpImportOpen(true)} className="w-full sm:w-auto">
            Import CSV
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Category Rules</h3>
          <p className="text-sm text-muted-foreground">
            Auto-categorize imported transactions based on description matching.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/settings/category-rules">Manage Rules</Link>
          </Button>
        </div>
      </section>

      {/* Anchor Dialog */}
      <Dialog open={anchorDialogOpen} onOpenChange={setAnchorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAnchorId ? 'Edit' : 'Add'} Balance Anchor</DialogTitle>
            <DialogDescription>
              Set your known balance at a specific date. This becomes the baseline for all balance
              calculations from this date forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {anchorError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {anchorError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="anchor-date" className="text-sm font-medium">Date</label>
              <Input
                id="anchor-date"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="anchor-amount" className="text-sm font-medium">Balance ($)</label>
              <Input
                id="anchor-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={anchorAmount}
                onChange={(e) => setAnchorAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="anchor-label" className="text-sm font-medium">Label (optional)</label>
              <Input
                id="anchor-label"
                placeholder="e.g., Opening balance, After reconciliation"
                value={anchorLabel}
                onChange={(e) => setAnchorLabel(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAnchorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAnchor}>
                {editingAnchorId ? 'Save' : 'Add'} Anchor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpImportDialog open={upImportOpen} onOpenChange={setUpImportOpen} />
    </div>
  );
}
