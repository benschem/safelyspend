import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseUpCsv, filterDuplicates, type ParsedTransaction } from '@/lib/up-csv-parser';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { formatCents, now } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface UpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Maximum file size: 50MB
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ImportStats {
  total: number;
  imported: number;
  duplicates: number;
  skipped: number;
  autoCategorized: number;
  needsReview: number;
}

export function UpImportDialog({ open, onOpenChange }: UpImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [duplicates, setDuplicates] = useState<ParsedTransaction[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [fileCount, setFileCount] = useState(0);

  const { getExistingFingerprints, bulkImport } = useTransactions();
  const { bulkGetOrCreate: bulkGetOrCreateCategories } = useCategories();
  const { bulkGetOrCreate: bulkGetOrCreatePaymentMethods } = usePaymentMethods();
  const { applyRulesToBatch } = useCategoryRules();
  const [importProgress, setImportProgress] = useState(0);

  const resetState = useCallback(() => {
    setStep('upload');
    setTransactions([]);
    setDuplicates([]);
    setSkippedCount(0);
    setErrors([]);
    setStats(null);
    setImportProgress(0);
    setFileCount(0);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      // Reset file input so same files can be selected again
      event.target.value = '';

      // Validate all files are CSVs and within size limit
      const invalidFiles: string[] = [];
      const oversizedFiles: string[] = [];
      const validFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Check file size first
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(file.name);
          continue;
        }

        const isValidExtension = file.name.toLowerCase().endsWith('.csv');
        const isValidMimeType = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';

        if (isValidExtension && isValidMimeType) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      }

      if (oversizedFiles.length > 0) {
        setErrors([
          `File too large: ${oversizedFiles.join(', ')}`,
          'Maximum file size is 50MB.',
        ]);
        return;
      }

      if (invalidFiles.length > 0) {
        setErrors([
          `Invalid file type: ${invalidFiles.join(', ')}`,
          'Please select only CSV files exported from Up Bank.',
        ]);
        return;
      }

      if (validFiles.length === 0) {
        setErrors(['No valid CSV files selected.']);
        return;
      }

      setFileCount(validFiles.length);

      try {
        // Parse all files
        const allTransactions: ParsedTransaction[] = [];
        const allErrors: string[] = [];
        let totalSkipped = 0;

        for (const file of validFiles) {
          const content = await file.text();
          const result = await parseUpCsv(content);

          // Prefix errors with filename for clarity
          if (result.errors.length > 0) {
            allErrors.push(...result.errors.map((e) => `${file.name}: ${e}`));
          }

          allTransactions.push(...result.transactions);
          totalSkipped += result.skipped.length;
        }

        if (allErrors.length > 0) {
          setErrors(allErrors);
        }

        // Filter duplicates against existing transactions AND across files
        const existingFingerprints = await getExistingFingerprints();
        const { unique, duplicates: dupes } = filterDuplicates(
          allTransactions,
          existingFingerprints,
        );

        // Also dedupe within the imported files (in case same transaction appears in multiple files)
        const seenFingerprints = new Set<string>();
        const deduped: ParsedTransaction[] = [];
        const crossFileDupes: ParsedTransaction[] = [];

        for (const tx of unique) {
          if (seenFingerprints.has(tx.fingerprint)) {
            crossFileDupes.push(tx);
          } else {
            seenFingerprints.add(tx.fingerprint);
            deduped.push(tx);
          }
        }

        setTransactions(deduped);
        setDuplicates([...dupes, ...crossFileDupes]);
        setSkippedCount(totalSkipped);
        setStep('preview');
      } catch (err) {
        setErrors([`Failed to read files: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      }
    },
    [getExistingFingerprints],
  );

  const handleImport = useCallback(async () => {
    setStep('importing');
    setImportProgress(0);

    // Helper to yield to browser for UI updates
    const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));

    const importTimestamp = now();
    let autoCategorized = 0;
    let needsReview = 0;

    // Progress: 10% - Collecting metadata
    setImportProgress(10);
    await yieldToUI();

    // Collect unique categories and payment methods from CSV
    const categoryNames = new Set<string>();
    const paymentMethodNames = new Set<string>();

    for (const tx of transactions) {
      if (tx.category) categoryNames.add(tx.category);
      if (tx.paymentMethod) paymentMethodNames.add(tx.paymentMethod);
    }

    // Progress: 20% - Creating categories/payment methods
    setImportProgress(20);
    await yieldToUI();

    // Bulk create categories and payment methods
    const categoryMap = await bulkGetOrCreateCategories(Array.from(categoryNames));
    const paymentMethodMap = await bulkGetOrCreatePaymentMethods(Array.from(paymentMethodNames));

    // Progress: 30% - Applying category rules (batch)
    setImportProgress(30);
    await yieldToUI();

    // Apply category rules to all transactions at once (much faster than per-transaction)
    const ruleCategoryMap = applyRulesToBatch(
      transactions.map((tx) => ({
        description: tx.description,
        amountCents: tx.amountCents,
        type: tx.type,
      })),
    );

    // Progress: 60% - Mapping transactions
    setImportProgress(60);
    await yieldToUI();

    // Map parsed transactions to transaction entities
    const toImport = transactions.map((tx, index) => {
      // First try category rules, then fall back to CSV category
      let categoryId: string | null = null;
      const ruleCategory = ruleCategoryMap.get(index);

      if (ruleCategory) {
        categoryId = ruleCategory;
        autoCategorized++;
      } else if (tx.category) {
        categoryId = categoryMap.get(tx.category) || null;
        if (categoryId) {
          autoCategorized++;
        }
      }

      // Track uncategorized expenses for review
      if (!categoryId && tx.type === 'expense') {
        needsReview++;
      }

      const data: Parameters<typeof bulkImport>[0][number] = {
        type: tx.type,
        date: tx.date,
        description: tx.description,
        amountCents: tx.amountCents,
        categoryId,
        savingsGoalId: null,
        importFingerprint: tx.fingerprint,
        importSource: 'up-csv',
        importedAt: importTimestamp,
      };
      if (tx.notes) {
        data.notes = tx.notes;
      }
      if (tx.paymentMethod) {
        const method = paymentMethodMap.get(tx.paymentMethod);
        if (method) {
          data.paymentMethod = method;
        }
      }
      return data;
    });

    // Progress: 80% - Saving to storage
    setImportProgress(80);
    await yieldToUI();

    // Import all at once
    await bulkImport(toImport);

    // Progress: 100% - Complete
    setImportProgress(100);

    setStats({
      total: transactions.length + duplicates.length + skippedCount,
      imported: transactions.length,
      duplicates: duplicates.length,
      skipped: skippedCount,
      autoCategorized,
      needsReview,
    });
    setStep('complete');
  }, [transactions, duplicates, skippedCount, bulkGetOrCreateCategories, bulkGetOrCreatePaymentMethods, bulkImport, applyRulesToBatch]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Up Bank</DialogTitle>
          <DialogDescription>
            Import transactions from an Up Bank CSV export file.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Export your transactions from Up Bank as CSV and upload the file here.
              </p>
              <label className="mt-4 inline-block cursor-pointer">
                <span className="sr-only">Select CSV files to import</span>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button asChild>
                  <span>Select CSV Files</span>
                </Button>
              </label>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium">What gets imported:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Purchases, BPAY payments, direct debits (as expenses)</li>
                <li>Salary, direct credits, deposits (as income)</li>
                <li>Categories and payment methods are created automatically</li>
              </ul>
              <p className="mt-3 font-medium">What gets skipped:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Internal transfers between accounts</li>
                <li>Round-up transactions</li>
                <li>Transfers to 2Up accounts</li>
                <li>Duplicate transactions (already imported)</li>
              </ul>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Errors</span>
                </div>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {fileCount > 1 && (
              <p className="text-sm text-muted-foreground">
                Loaded {fileCount} files
              </p>
            )}
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{transactions.length.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">To import</p>
              </div>
              <div className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{duplicates.length.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
              <div className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{skippedCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>

            {transactions.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 font-medium">Preview ({Math.min(transactions.length, 10)} of {transactions.length})</p>
                  <ScrollArea className="h-64 rounded-lg border">
                    <div className="divide-y">
                      {transactions.slice(0, 10).map((tx, i) => (
                        <div key={i} className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate font-medium">{tx.description}</span>
                              <Badge variant={tx.type === 'income' ? 'success' : 'destructive'}>
                                {tx.type}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {tx.date}
                              {tx.category && ` • ${tx.category}`}
                              {tx.paymentMethod && ` • ${tx.paymentMethod}`}
                            </p>
                          </div>
                          <span
                            className={`ml-4 font-mono ${
                              tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCents(tx.amountCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {errors.length > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {errors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {errors.length > 5 && (
                    <li>...and {errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetState}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={transactions.length === 0}>
                Import {transactions.length.toLocaleString()} Transactions
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">
              Importing {transactions.length.toLocaleString()} transactions...
            </p>
            <div className="mx-auto mt-4 max-w-xs">
              <Progress value={importProgress} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {importProgress < 30 && 'Preparing...'}
                {importProgress >= 30 && importProgress < 60 && 'Applying category rules...'}
                {importProgress >= 60 && importProgress < 80 && 'Processing transactions...'}
                {importProgress >= 80 && 'Saving...'}
              </p>
            </div>
          </div>
        )}

        {step === 'complete' && stats && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <p className="mt-4 text-lg font-medium">Import Complete!</p>
              <p className="mt-2 text-muted-foreground">
                Successfully imported {stats.imported} transaction{stats.imported !== 1 ? 's' : ''}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-sm sm:grid-cols-4">
              <div>
                <p className="font-medium">{stats.imported}</p>
                <p className="text-muted-foreground">Imported</p>
              </div>
              <div>
                <p className="font-medium">{stats.duplicates}</p>
                <p className="text-muted-foreground">Duplicates</p>
              </div>
              <div>
                <p className="font-medium">{stats.autoCategorized}</p>
                <p className="text-muted-foreground">Categorised</p>
              </div>
              <div>
                <p className="font-medium">{stats.needsReview}</p>
                <p className="text-muted-foreground">Need review</p>
              </div>
            </div>

            {stats.needsReview > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-center">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {stats.needsReview} expense{stats.needsReview !== 1 ? 's' : ''} need categorization.
                  Review them in the Transactions page.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
