import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { z } from 'zod';
import { toast } from 'sonner';
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Pencil,
  Trash2,
  Plus,
  AlertTriangle,
  Download,
  Upload,
  Check,
  Settings,
  Bug,
  Info,
  Sparkles,
  PiggyBank,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Lock,
  LockOpen,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { PassphraseDialog } from '@/components/dialogs/passphrase-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useSync } from '@/hooks/use-sync';
import { api, ApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppConfig } from '@/hooks/use-app-config';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useSavingsAnchors } from '@/hooks/use-savings-anchors';
import { useSavingsGoals } from '@/hooks/use-savings-goals';
import {
  exportAllData,
  importAllData,
  fullReset,
  CURRENT_SCHEMA_VERSION,
  CURRENT_DATA_VERSION,
} from '@/lib/db';
import { formatCents, formatDate, today } from '@/lib/utils';
import { currentVersion } from '@/lib/changelog';
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

  // Balance anchor management state
  const { anchors, addAnchor, updateAnchor, deleteAnchor } = useBalanceAnchors();
  const [anchorDialogOpen, setAnchorDialogOpen] = useState(false);
  const [editingAnchorId, setEditingAnchorId] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(today());
  const [anchorAmount, setAnchorAmount] = useState('');
  const [anchorLabel, setAnchorLabel] = useState('');
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [anchorConfirmZero, setAnchorConfirmZero] = useState(false);
  const [deletingAnchorId, setDeletingAnchorId] = useState<string | null>(null);

  // Savings anchor management state
  const { savingsGoals } = useSavingsGoals();
  const {
    anchors: savingsAnchors,
    addAnchor: addSavingsAnchor,
    updateAnchor: updateSavingsAnchor,
    deleteAnchor: deleteSavingsAnchor,
  } = useSavingsAnchors();
  const [savingsAnchorDialogOpen, setSavingsAnchorDialogOpen] = useState(false);
  const [editingSavingsAnchorId, setEditingSavingsAnchorId] = useState<string | null>(null);
  const [savingsAnchorGoalId, setSavingsAnchorGoalId] = useState('');
  const [savingsAnchorDate, setSavingsAnchorDate] = useState(today());
  const [savingsAnchorAmount, setSavingsAnchorAmount] = useState('');
  const [savingsAnchorLabel, setSavingsAnchorLabel] = useState('');
  const [savingsAnchorError, setSavingsAnchorError] = useState<string | null>(null);
  const [savingsAnchorConfirmZero, setSavingsAnchorConfirmZero] = useState(false);
  const [deletingSavingsAnchorId, setDeletingSavingsAnchorId] = useState<string | null>(null);

  // Check-in preferences
  const { checkInCadence, lastCheckInDate, daysSinceLastCheckIn, setCheckInCadence } = useAppConfig();

  // Cloud sync state
  const { user, isAuthenticated, logout, deleteAccount } = useAuth();
  const {
    hasPassphrase,
    setPassphrase,
    clearPassphrase,
    syncStatus,
    conflict,
    clearConflict,
    lastSyncedAt,
    push,
    pull,
  } = useSync();
  const [passphraseDialogOpen, setPassphraseDialogOpen] = useState(false);
  const [passphraseDialogMode, setPassphraseDialogMode] = useState<'create' | 'unlock'>('unlock');
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [passphraseLoading, setPassphraseLoading] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);

  // Active sessions state
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; isCurrent: boolean }>>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setSessionsLoading(true);
    api.auth
      .sessions()
      .then((res) => setSessions(res.sessions))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, [isAuthenticated]);

  // Debug mode state - initialize from current debug setting
  const [debugEnabled, setDebugEnabled] = useState(() => debug.isEnabled());

  const handleDebugToggle = (enabled: boolean) => {
    debug.setEnabled(enabled);
    setDebugEnabled(enabled);
  };

  // Cloud sync handlers
  const handleOpenPassphraseDialog = (mode: 'create' | 'unlock') => {
    setPassphraseDialogMode(mode);
    setPassphraseError(null);
    setPassphraseDialogOpen(true);
  };

  const handlePassphraseSubmit = async (passphrase: string) => {
    setPassphraseError(null);
    setPassphraseLoading(true);

    try {
      setPassphrase(passphrase);
      setPassphraseDialogOpen(false);

      if (passphraseDialogMode === 'create') {
        // First push
        const result = await push();
        toast.success('Pushed to cloud', {
          description: `Version ${result.version} saved`,
        });
      }
    } catch (err) {
      clearPassphrase();
      if (err instanceof Error && err.message.includes('Wrong passphrase')) {
        setPassphraseError('Wrong passphrase. Please try again.');
        setPassphraseDialogOpen(true);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to sync';
        toast.error('Sync failed', { description: msg });
        setPassphraseDialogOpen(false);
      }
    } finally {
      setPassphraseLoading(false);
    }
  };

  const handlePush = async () => {
    try {
      const result = await push();
      toast.success('Pushed to cloud', {
        description: `Version ${result.version} saved`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Conflict handled by useSync - conflict state is set
        return;
      }
      const msg = err instanceof Error ? err.message : 'Push failed';
      toast.error('Push failed', { description: msg });
    }
  };

  const handlePull = async () => {
    try {
      await pull();
      toast.success('Pulled from cloud', {
        description: 'Local data updated',
      });
      // Reload to reflect imported data
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed';
      toast.error('Pull failed', { description: msg });
    }
  };

  const handleOverwriteCloud = async () => {
    setOverwriteConfirmOpen(false);
    try {
      const result = await push(true);
      clearConflict();
      toast.success('Cloud data overwritten', {
        description: `Version ${result.version} saved`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Overwrite failed';
      toast.error('Overwrite failed', { description: msg });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearPassphrase();
      toast('Logged out');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Logout failed';
      toast.error('Logout failed', { description: msg });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await api.auth.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast('Session revoked');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke session';
      toast.error('Revoke failed', { description: msg });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokingAll(true);
    try {
      const { revoked } = await api.auth.revokeAllSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      toast(`Revoked ${revoked} session${revoked !== 1 ? 's' : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke sessions';
      toast.error('Revoke failed', { description: msg });
    } finally {
      setRevokingAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      clearPassphrase();
      setDeleteAccountOpen(false);
      setDeleteConfirmText('');
      toast('Account deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error('Delete failed', { description: msg });
    }
  };

  const formatRelativeTime = (isoString: string): string => {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    const diffDay = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'yesterday';
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
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
      await importAllData(
        pendingImport.data as unknown as BudgetData & { activeScenarioId?: string | null },
      );

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
      navigate('/');
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
    setAnchorConfirmZero(false);
    setAnchorDialogOpen(true);
  };

  const openEditAnchor = (anchor: (typeof anchors)[0]) => {
    setEditingAnchorId(anchor.id);
    setAnchorDate(anchor.date);
    setAnchorAmount((anchor.balanceCents / 100).toFixed(2));
    setAnchorLabel(anchor.label ?? '');
    setAnchorError(null);
    setAnchorConfirmZero(false);
    setAnchorDialogOpen(true);
  };

  const handleSaveAnchor = async () => {
    setAnchorError(null);

    // Clean input: remove $ signs, commas, and whitespace
    const cleanedAmount = anchorAmount.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleanedAmount);

    if (isNaN(amount) || (!cleanedAmount && !anchorAmount.includes('0'))) {
      setAnchorError('Please enter a valid amount');
      return;
    }

    if (amount === 0 && !anchorConfirmZero) {
      setAnchorConfirmZero(true);
      setAnchorError('Balance is $0. Click save again to confirm.');
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
      setAnchorError(err instanceof Error ? err.message : 'Could not save the balance. Please try again.');
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

  // Savings anchor handlers
  const openAddSavingsAnchor = () => {
    setEditingSavingsAnchorId(null);
    setSavingsAnchorGoalId(savingsGoals[0]?.id ?? '');
    setSavingsAnchorDate(today());
    setSavingsAnchorAmount('');
    setSavingsAnchorLabel('');
    setSavingsAnchorError(null);
    setSavingsAnchorConfirmZero(false);
    setSavingsAnchorDialogOpen(true);
  };

  const openEditSavingsAnchor = (anchor: (typeof savingsAnchors)[0]) => {
    setEditingSavingsAnchorId(anchor.id);
    setSavingsAnchorGoalId(anchor.savingsGoalId);
    setSavingsAnchorDate(anchor.date);
    setSavingsAnchorAmount((anchor.balanceCents / 100).toFixed(2));
    setSavingsAnchorLabel(anchor.label ?? '');
    setSavingsAnchorError(null);
    setSavingsAnchorConfirmZero(false);
    setSavingsAnchorDialogOpen(true);
  };

  const handleSaveSavingsAnchor = async () => {
    setSavingsAnchorError(null);

    if (!savingsAnchorGoalId) {
      setSavingsAnchorError('Please select a savings goal');
      return;
    }

    // Clean input: remove $ signs, commas, and whitespace
    const cleanedAmount = savingsAnchorAmount.replace(/[$,\s]/g, '');
    const amount = parseFloat(cleanedAmount);

    if (isNaN(amount)) {
      setSavingsAnchorError('Please enter a valid amount');
      return;
    }

    if (amount < 0) {
      setSavingsAnchorError('Amount cannot be negative');
      return;
    }

    if (amount === 0 && !savingsAnchorConfirmZero) {
      setSavingsAnchorConfirmZero(true);
      setSavingsAnchorError('Balance is $0. Click save again to confirm.');
      return;
    }

    const balanceCents = Math.round(amount * 100);

    try {
      if (editingSavingsAnchorId) {
        const updates: Parameters<typeof updateSavingsAnchor>[1] = {
          savingsGoalId: savingsAnchorGoalId,
          date: savingsAnchorDate,
          balanceCents,
        };
        if (savingsAnchorLabel) {
          updates.label = savingsAnchorLabel;
        }
        await updateSavingsAnchor(editingSavingsAnchorId, updates);
        showMessage('success', 'Savings anchor updated');
      } else {
        const data: Parameters<typeof addSavingsAnchor>[0] = {
          savingsGoalId: savingsAnchorGoalId,
          date: savingsAnchorDate,
          balanceCents,
        };
        if (savingsAnchorLabel) {
          data.label = savingsAnchorLabel;
        }
        await addSavingsAnchor(data);
        showMessage('success', 'Savings anchor added');
      }
      setSavingsAnchorDialogOpen(false);
    } catch (err) {
      setSavingsAnchorError(err instanceof Error ? err.message : 'Could not save the balance. Please try again.');
    }
  };

  const handleDeleteSavingsAnchor = async (id: string) => {
    if (deletingSavingsAnchorId !== id) {
      setDeletingSavingsAnchorId(id);
      return;
    }
    await deleteSavingsAnchor(id);
    setDeletingSavingsAnchorId(null);
    showMessage('success', 'Savings anchor deleted');
  };

  // Group savings anchors by goal
  const savingsAnchorsByGoal = savingsGoals.map((goal) => ({
    goal,
    anchors: savingsAnchors.filter((a) => a.savingsGoalId === goal.id),
  }));

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Settings className="h-5 w-5 text-slate-500" />
          </div>
          Settings
        </h1>
        <p className="page-description">Manage your data and preferences.</p>
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'} className="mb-6">
          {message.text}
        </Alert>
      )}

      <div className="space-y-8">
        {/* Initial Cash Section */}
        <section className="section">
          <div className="section-header">
            <h2>Initial Cash</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us how much cash you had on a specific date. We&apos;ll calculate your current
              cash from there using your transactions.
            </p>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  You&apos;ll need to enter all transactions from this date onwards for the numbers
                  to be accurate. If you don&apos;t want to backfill, just use today&apos;s date and
                  start fresh.
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
                    <div key={anchor.id} className="flex items-center justify-between p-4">
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
                        <Button variant="ghost" size="sm" onClick={() => openEditAnchor(anchor)} aria-label="Edit anchor">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={deletingAnchorId === anchor.id ? 'destructive' : 'ghost'}
                          size="sm"
                          onClick={() => handleDeleteAnchor(anchor.id)}
                          aria-label={deletingAnchorId === anchor.id ? 'Confirm delete' : 'Delete anchor'}
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

        {/* Savings Initial Amounts Section */}
        {savingsGoals.length > 0 && (
          <>
            <Separator />
            <section className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h2>Savings Balances</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set known balances for your savings goals at specific dates. Useful when you have
                  existing savings you don&apos;t want to enter as individual transactions.
                </p>
              </div>
              <div className="section-content">
                <div className="panel">
                  <div className="panel-header">
                    <h3>Initial Amounts</h3>
                    <Button variant="outline" size="sm" onClick={openAddSavingsAnchor}>
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  {savingsAnchors.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-state-text">No savings balances set.</p>
                      <Button
                        variant="outline"
                        className="empty-state-action"
                        onClick={openAddSavingsAnchor}
                      >
                        Add savings balance
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {savingsAnchorsByGoal
                        .filter((g) => g.anchors.length > 0)
                        .map(({ goal, anchors: goalAnchors }) => (
                          <div key={goal.id} className="p-4">
                            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                              {goal.name}
                            </h4>
                            <div className="space-y-2">
                              {goalAnchors.map((anchor) => (
                                <div
                                  key={anchor.id}
                                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium">{formatDate(anchor.date)}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatCents(anchor.balanceCents)}
                                      {anchor.label && ` · ${anchor.label}`}
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    {deletingSavingsAnchorId === anchor.id && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingSavingsAnchorId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditSavingsAnchor(anchor)}
                                      aria-label="Edit savings anchor"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant={
                                        deletingSavingsAnchorId === anchor.id
                                          ? 'destructive'
                                          : 'ghost'
                                      }
                                      size="sm"
                                      onClick={() => handleDeleteSavingsAnchor(anchor.id)}
                                      aria-label={deletingSavingsAnchorId === anchor.id ? 'Confirm delete' : 'Delete savings anchor'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        <Separator />

        {/* Cloud Sync Section */}
        <section className="section">
          <div className="section-header">
            <h2>Cloud Sync</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sync your budget across devices with end-to-end encryption.
            </p>
          </div>
          <div className="section-content space-y-3">
            {!isAuthenticated ? (
              /* State A: Not signed in */
              <div className="panel">
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <CloudOff className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">Not connected</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your data is stored locally on this device only.
                    </p>
                  </div>
                  <Link to="/login">
                    <Button className="cursor-pointer">Set Up Cloud Sync</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="panel">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <Cloud className="mt-0.5 h-5 w-5 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium">Connected as {user?.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {lastSyncedAt
                            ? `Last synced: ${formatRelativeTime(lastSyncedAt)}`
                            : 'Never synced'}
                        </p>
                        {hasPassphrase && (
                          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <LockOpen className="h-3.5 w-3.5" />
                            Vault unlocked
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Conflict alert */}
                    {conflict && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              Your cloud vault has been updated from another device (version{' '}
                              {conflict.remoteVersion}). You have version {conflict.localVersion}.
                            </p>
                            <div className="mt-3 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePull}
                                disabled={syncStatus !== 'idle'}
                                className="cursor-pointer"
                              >
                                Pull Latest
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setOverwriteConfirmOpen(true)}
                                disabled={syncStatus !== 'idle'}
                                className="cursor-pointer"
                              >
                                Overwrite Cloud
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Push/Pull buttons or Unlock */}
                    {!conflict && (
                      <div className="mt-4">
                        {hasPassphrase ? (
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={handlePush}
                              disabled={syncStatus !== 'idle'}
                              className="flex-1 cursor-pointer"
                            >
                              {syncStatus === 'pushing' ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Pushing...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4" />
                                  Push
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handlePull}
                              disabled={syncStatus !== 'idle'}
                              className="flex-1 cursor-pointer"
                            >
                              {syncStatus === 'pulling' ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Pulling...
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4" />
                                  Pull
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                              <div className="flex items-start gap-2">
                                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                  Enter your passphrase to enable push and pull.
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => handleOpenPassphraseDialog('unlock')}
                              className="cursor-pointer"
                            >
                              Unlock Vault
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Sessions panel */}
                <div className="panel">
                  <div className="panel-header">
                    <h3>Active Sessions</h3>
                    {sessions.filter((s) => !s.isCurrent).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRevokeAllSessions}
                        disabled={revokingAll}
                        className="cursor-pointer"
                      >
                        {revokingAll ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          'Revoke All Others'
                        )}
                      </Button>
                    )}
                  </div>
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No active sessions.</p>
                  ) : (
                    <div className="divide-y">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{session.id.slice(0, 8)}</span>
                            {session.isCurrent && <Badge variant="success">Current</Badge>}
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(session.createdAt)}
                            </span>
                          </div>
                          {!session.isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={revokingSessionId === session.id}
                              className="cursor-pointer"
                            >
                              {revokingSessionId === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Revoke'
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account panel */}
                <div className="panel">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3>Account</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        className="cursor-pointer"
                      >
                        Log Out
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteAccountOpen(true)}
                        className="cursor-pointer"
                      >
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
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
                  <p className="text-sm text-muted-foreground">
                    Download all your budget data as JSON.
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all data and start fresh.
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  {confirmingDelete && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAll}
                    className="flex-1 sm:flex-none"
                  >
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
            <p className="mt-1 text-sm text-muted-foreground">Customize how the app looks.</p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Theme</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose light, dark, or system theme.
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Check-in Preferences Section */}
        <section className="section">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <h2>Check-in</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Periodic check-ins help you keep your finances up to date.
            </p>
          </div>
          <div className="section-content">
            <div className="panel">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Check-in Frequency</h3>
                  <p className="text-sm text-muted-foreground">
                    How often you want to be reminded to check in.
                  </p>
                </div>
                <Select
                  value={checkInCadence ?? ''}
                  onValueChange={(v) =>
                    setCheckInCadence(v as 'weekly' | 'fortnightly' | 'monthly' | 'quarterly')
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3>Last Check-in</h3>
                  <p className="text-sm text-muted-foreground">
                    {lastCheckInDate
                      ? `${formatDate(lastCheckInDate)}${daysSinceLastCheckIn !== null ? ` (${daysSinceLastCheckIn} day${daysSinceLastCheckIn !== 1 ? 's' : ''} ago)` : ''}`
                      : 'No check-ins yet'}
                  </p>
                </div>
                <Link to="/check-in">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <ClipboardCheck className="h-4 w-4" />
                    Check In Now
                  </Button>
                </Link>
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
                      Enable detailed logging to browser console. Can also be enabled via{' '}
                      <code className="rounded bg-muted px-1 text-xs">?debug=1</code> URL parameter.
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
                <div className="flex items-center gap-2">
                  <span className="font-mono">{currentVersion}</span>
                  <Link
                    to="/changelog"
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline dark:text-purple-400"
                  >
                    <Sparkles className="h-3 w-3" />
                    View Changelog
                  </Link>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Schema Version</span>
                <span className="font-mono">{CURRENT_SCHEMA_VERSION}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Data Format</span>
                <span className="font-mono">v{CURRENT_DATA_VERSION}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Privacy</span>
                <Link
                  to="/privacy"
                  className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline dark:text-purple-400"
                >
                  <ShieldCheck className="h-3 w-3" />
                  What we store
                </Link>
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
              Enter how much cash you had on a specific date. Check your bank statement if
              you&apos;re not sure.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {anchorError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {anchorError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="anchor-date" className="text-sm font-medium">
                Date
              </label>
              <Input
                id="anchor-date"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="anchor-amount" className="text-sm font-medium">
                Cash ($)
              </label>
              <Input
                id="anchor-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={anchorAmount}
                onChange={(e) => { setAnchorAmount(e.target.value); setAnchorConfirmZero(false); }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="anchor-label" className="text-sm font-medium">
                Note (optional)
              </label>
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
              <Button onClick={handleSaveAnchor}>{editingAnchorId ? 'Save' : 'Add'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Savings Anchor Dialog */}
      <Dialog open={savingsAnchorDialogOpen} onOpenChange={setSavingsAnchorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSavingsAnchorId ? 'Edit' : 'Add'} Savings Balance</DialogTitle>
            <DialogDescription>
              Enter how much you had saved for a goal on a specific date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {savingsAnchorError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {savingsAnchorError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="savings-anchor-goal" className="text-sm font-medium">
                Savings Goal
              </label>
              <Select value={savingsAnchorGoalId} onValueChange={setSavingsAnchorGoalId}>
                <SelectTrigger id="savings-anchor-goal">
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  {savingsGoals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="savings-anchor-date" className="text-sm font-medium">
                Date
              </label>
              <Input
                id="savings-anchor-date"
                type="date"
                value={savingsAnchorDate}
                onChange={(e) => setSavingsAnchorDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="savings-anchor-amount" className="text-sm font-medium">
                Balance ($)
              </label>
              <Input
                id="savings-anchor-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={savingsAnchorAmount}
                onChange={(e) => { setSavingsAnchorAmount(e.target.value); setSavingsAnchorConfirmZero(false); }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="savings-anchor-label" className="text-sm font-medium">
                Note (optional)
              </label>
              <Input
                id="savings-anchor-label"
                placeholder="e.g., From bank statement"
                value={savingsAnchorLabel}
                onChange={(e) => setSavingsAnchorLabel(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setSavingsAnchorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSavingsAnchor}>
                {editingSavingsAnchorId ? 'Save' : 'Add'}
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
            <Button onClick={handleExportConfirm}>Download Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog
        open={importPreviewOpen}
        onOpenChange={(open) => !open && !importSuccess && handleImportCancel()}
      >
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
                      <div className="text-muted-foreground">Savings Goals:</div>
                      <div>{pendingImport.data.savingsGoals.length}</div>
                      {pendingImport.data.balanceAnchors && (
                        <>
                          <div className="text-muted-foreground">Balance Anchors:</div>
                          <div>{pendingImport.data.balanceAnchors.length}</div>
                        </>
                      )}
                      {pendingImport.data.savingsAnchors && (
                        <>
                          <div className="text-muted-foreground">Savings Anchors:</div>
                          <div>{pendingImport.data.savingsAnchors.length}</div>
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
                    This will <strong>replace all existing data</strong>. Make sure you have a
                    backup if you need to preserve your current data.
                  </Alert>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleImportCancel}>
                  Cancel
                </Button>
                <Button onClick={handleImportConfirm}>Import Data</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Passphrase Dialog */}
      <PassphraseDialog
        open={passphraseDialogOpen}
        onOpenChange={setPassphraseDialogOpen}
        mode={passphraseDialogMode}
        onSubmit={handlePassphraseSubmit}
        error={passphraseError}
        loading={passphraseLoading}
      />

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will permanently delete:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your account ({user?.email})</li>
                  <li>All cloud backups</li>
                </ul>
                <p>
                  Your local data will NOT be deleted. You can continue using the app without cloud
                  sync.
                </p>
                <div className="pt-2">
                  <label htmlFor="delete-confirm" className="text-sm font-medium text-foreground">
                    Type &quot;delete&quot; to confirm:
                  </label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overwrite Cloud Confirmation */}
      <AlertDialog open={overwriteConfirmOpen} onOpenChange={setOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite cloud data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your cloud backup (version {conflict?.remoteVersion}) with your
              local data. The previous version will be kept in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverwriteCloud}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
