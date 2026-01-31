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
import { Pencil, Trash2, Plus, AlertTriangle, Download, Upload, Check, Settings, Bug, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { exportAllData, importAllData, fullReset, CURRENT_SCHEMA_VERSION, CURRENT_DATA_VERSION } from '@/lib/db';
import { formatCents, formatDate, today } from '@/lib/utils';
import {
  validateImport,
  getImportErrorMessage,
  type ValidatedBudgetData,
} from '@/lib/import-schema';
import { debug } from '@/lib/debug';
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

  // Debug mode state - initialize from current debug setting
  const [debugEnabled, setDebugEnabled] = useState(() => debug.isEnabled());

  const handleDebugToggle = (enabled: boolean) => {
    debug.setEnabled(enabled);
    setDebugEnabled(enabled);
  };

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
      debug.error('db', 'Export failed', error);
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
      debug.error('import', 'Import failed', error);
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
      debug.error('db', 'Delete failed', error);
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
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-gray-500/10">
            <Settings className="h-5 w-5 text-gray-500" />
          </div>
          Settings
        </h1>
        <p className="page-description">Manage your data and preferences.</p>
      </div>

      {message && (
        <Alert
          variant={message.type === 'success' ? 'success' : 'destructive'}
          className="mb-6"
        >
          {message.text}
        </Alert>
      )}

      <div className="space-y-8">
        {/* Initial Cash Section */}
        <section className="section">
          <div className="section-header">
            <h2>Initial Cash</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us how much cash you had on a specific date. We&apos;ll calculate your current cash
              from there using your transactions.
            </p>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  You&apos;ll need to enter all transactions from this date onwards for the numbers to be accurate.
                  If you don&apos;t want to backfill, just use today&apos;s date and start fresh.
                </p>
              </div>
            </div>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="panel-header">
                <h3>Initial Amounts</h3>
                <Button variant="outline" size="sm" onClick={openAddAnchor}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {anchors.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No initial cash set.</p>
                  <Button variant="outline" className="empty-state-action" onClick={openAddAnchor}>
                    Add initial cash
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {anchors.map((anchor) => (
                    <div
                      key={anchor.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div>
                        <p className="font-medium">{formatDate(anchor.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCents(anchor.balanceCents)}
                          {anchor.label && ` · ${anchor.label}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
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
            </div>
          </div>
        </section>

        <Separator />

        {/* Data Management Section */}
        <section className="section">
          <div className="section-header">
            <h2>Data Management</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export, import, or delete your budget data.
            </p>
          </div>
          <div className="section-content space-y-3">
            <div className="panel">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Export Data</h3>
                  <p className="text-sm text-muted-foreground">Download all your budget data as JSON.</p>
                </div>
                <Button variant="outline" onClick={handleExportClick} className="w-full sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Import Data</h3>
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
            </div>

            <div className="panel border-destructive/50">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-destructive">Delete All Data</h3>
                  <p className="text-sm text-muted-foreground">Permanently delete all data and start fresh.</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  {confirmingDelete && (
                    <Button variant="outline" onClick={() => setConfirmingDelete(false)} className="flex-1 sm:flex-none">
                      Cancel
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleDeleteAll} className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4" />
                    {confirmingDelete ? 'Confirm Delete' : 'Delete All'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Appearance Section */}
        <section className="section">
          <div className="section-header">
            <h2>Appearance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize how the app looks.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Theme</h3>
                  <p className="text-sm text-muted-foreground">Choose light, dark, or system theme.</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Developer Section */}
        <section className="section">
          <div className="section-header">
            <h2>Developer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Advanced options for debugging and troubleshooting.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Bug className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3>Debug Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable detailed logging to browser console. Can also be enabled via <code className="rounded bg-muted px-1 text-xs">?debug=1</code> URL parameter.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={debugEnabled}
                  onCheckedChange={handleDebugToggle}
                  aria-label="Toggle debug mode"
                />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* About Section */}
        <section className="section">
          <div className="section-header">
            <h2>About</h2>
          </div>
          <div className="section-content">
            <div className="panel p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">App Version</span>
                <span className="font-mono">1.0.0</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Schema Version</span>
                <span className="font-mono">{CURRENT_SCHEMA_VERSION}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Data Format</span>
                <span className="font-mono">v{CURRENT_DATA_VERSION}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Anchor Dialog */}
      <Dialog open={anchorDialogOpen} onOpenChange={setAnchorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAnchorId ? 'Edit' : 'Add'} Initial Cash</DialogTitle>
            <DialogDescription>
              Enter how much cash you had on a specific date. Check your bank statement if you&apos;re
              not sure.
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
              <label htmlFor="anchor-amount" className="text-sm font-medium">Cash ($)</label>
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
              <label htmlFor="anchor-label" className="text-sm font-medium">Note (optional)</label>
              <Input
                id="anchor-label"
                placeholder="e.g., From bank statement"
                value={anchorLabel}
                onChange={(e) => setAnchorLabel(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAnchorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAnchor}>
                {editingAnchorId ? 'Save' : 'Add'}
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
