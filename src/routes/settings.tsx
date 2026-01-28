import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, AlertTriangle, Download, Upload, Check, Settings } from 'lucide-react';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { exportAllData, importAllData, fullReset } from '@/lib/db';
import { formatCents, formatDate, today } from '@/lib/utils';
import {
  validateImport,
  getImportErrorMessage,
  type ValidatedBudgetData,
} from '@/lib/import-schema';
import type { BudgetData } from '@/lib/types';

// Rate limiting: minimum 5 seconds between imports
const MIN_IMPORT_INTERVAL_MS = 5000;

export function SettingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exportWarningOpen, setExportWarningOpen] = useState(false);
  const [lastImportTime, setLastImportTime] = useState(0);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: ValidatedBudgetData;
    fileName: string;
  } | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

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

  const handleExportClick = () => {
    setExportWarningOpen(true);
  };

  const handleExportConfirm = async () => {
    setExportWarningOpen(false);
    try {
      const data = await exportAllData();
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
    } catch (error) {
      console.error('Export failed:', error);
      showMessage('error', 'Export failed. Please try again.');
    }
  };

  const handleImportClick = () => {
    // Rate limiting check
    const now = Date.now();
    if (now - lastImportTime < MIN_IMPORT_INTERVAL_MS) {
      showMessage('error', 'Please wait a few seconds before importing again.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Update rate limiting timestamp
    setLastImportTime(Date.now());

    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawData = JSON.parse(event.target?.result as string);

        // Validate against schema (includes prototype pollution protection)
        const validatedData = validateImport(rawData);

        // Show preview dialog instead of immediately importing
        setPendingImport({ data: validatedData, fileName });
        setImportPreviewOpen(true);
      } catch (err) {
        if (err instanceof z.ZodError) {
          showMessage('error', getImportErrorMessage(err));
        } else if (err instanceof SyntaxError) {
          showMessage('error', 'Failed to parse JSON file.');
        } else {
          showMessage('error', 'Import failed: Invalid data format.');
        }
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!pendingImport) return;

    try {
      // Cast ValidatedBudgetData to BudgetData (schema-validated)
      await importAllData(pendingImport.data as unknown as BudgetData & { activeScenarioId?: string | null });

      // Show success state in dialog before reload
      setImportSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      showMessage('error', 'Import failed. Please try again.');
      setImportPreviewOpen(false);
      setPendingImport(null);
    }
  };

  const handleImportCancel = () => {
    setImportPreviewOpen(false);
    setPendingImport(null);
    setImportSuccess(false);
  };

  const handleDeleteAll = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    try {
      await fullReset();
      navigate('/landing');
    } catch (error) {
      console.error('Delete failed:', error);
      showMessage('error', 'Delete failed. Please try again.');
    }
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

  const handleSaveAnchor = async () => {
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
        await updateAnchor(editingAnchorId, updates);
        showMessage('success', 'Anchor updated');
      } else {
        const data: Parameters<typeof addAnchor>[0] = {
          date: anchorDate,
          balanceCents,
        };
        if (anchorLabel) {
          data.label = anchorLabel;
        }
        await addAnchor(data);
        showMessage('success', 'Anchor added');
      }
      setAnchorDialogOpen(false);
    } catch (err) {
      setAnchorError(err instanceof Error ? err.message : 'Failed to save anchor');
    }
  };

  const handleDeleteAnchor = async (id: string) => {
    if (deletingAnchorId !== id) {
      setDeletingAnchorId(id);
      return;
    }
    await deleteAnchor(id);
    setDeletingAnchorId(null);
    showMessage('success', 'Anchor deleted');
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-20">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Settings className="h-7 w-7" />
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">Manage your data and preferences.</p>
      </div>

      {message && (
        <Alert
          variant={message.type === 'success' ? 'success' : 'destructive'}
          className="mt-4"
        >
          {message.text}
        </Alert>
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
          <Button variant="outline" onClick={handleExportClick} className="w-full sm:w-auto">
            <Upload className="h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Import Data</h3>
            <p className="text-sm text-muted-foreground">Restore from a JSON backup file.</p>
          </div>
          <Button variant="outline" onClick={handleImportClick} className="w-full sm:w-auto">
            <Download className="h-4 w-4" />
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
            <h3 className="font-medium text-destructive">Delete All Data</h3>
            <p className="text-sm text-muted-foreground">Permanently delete all data and start fresh.</p>
          </div>
          <div className="flex gap-2">
            {confirmingDelete && (
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            )}
            <Button variant="destructive" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4" />
              {confirmingDelete ? 'Confirm Delete' : 'Delete All'}
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

      {/* Export Warning Dialog */}
      <Dialog open={exportWarningOpen} onOpenChange={setExportWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Security Notice
            </DialogTitle>
            <DialogDescription>
              The exported file will contain all your financial data in an unencrypted format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Please keep in mind:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Store the file in a secure location</li>
              <li>Do not share it via email or upload to cloud storage</li>
              <li>Delete the file after restoring from backup</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportWarningOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportConfirm}>
              Download Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importPreviewOpen} onOpenChange={(open) => !open && !importSuccess && handleImportCancel()}>
        <DialogContent>
          {importSuccess ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-green-100 p-3 mb-4 dark:bg-green-900/50">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Import Successful</h3>
              <p className="text-sm text-muted-foreground">Refreshing page...</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-500" />
                  Import Data
                </DialogTitle>
                <DialogDescription>
                  Review the data to be imported from{' '}
                  <span className="font-medium">{pendingImport?.fileName}</span>
                </DialogDescription>
              </DialogHeader>

              {pendingImport && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="font-medium mb-2">Data Summary</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="text-muted-foreground">Scenarios:</div>
                      <div>{pendingImport.data.scenarios.length}</div>
                      <div className="text-muted-foreground">Categories:</div>
                      <div>{pendingImport.data.categories.length}</div>
                      <div className="text-muted-foreground">Transactions:</div>
                      <div>{pendingImport.data.transactions.length}</div>
                      <div className="text-muted-foreground">Budget Rules:</div>
                      <div>{pendingImport.data.budgetRules.length}</div>
                      <div className="text-muted-foreground">Forecast Rules:</div>
                      <div>{pendingImport.data.forecastRules.length}</div>
                      <div className="text-muted-foreground">Forecast Events:</div>
                      <div>{pendingImport.data.forecastEvents.length}</div>
                      <div className="text-muted-foreground">Savings Goals:</div>
                      <div>{pendingImport.data.savingsGoals.length}</div>
                      {pendingImport.data.balanceAnchors && (
                        <>
                          <div className="text-muted-foreground">Balance Anchors:</div>
                          <div>{pendingImport.data.balanceAnchors.length}</div>
                        </>
                      )}
                      {pendingImport.data.categoryRules && (
                        <>
                          <div className="text-muted-foreground">Category Rules:</div>
                          <div>{pendingImport.data.categoryRules.length}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <Alert variant="warning" className="text-sm">
                    This will <strong>replace all existing data</strong>. Make sure you have a backup
                    if you need to preserve your current data.
                  </Alert>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleImportCancel}>
                  Cancel
                </Button>
                <Button onClick={handleImportConfirm}>
                  Import Data
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
