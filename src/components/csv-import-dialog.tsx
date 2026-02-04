import { useState, useCallback, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, AlertCircle, CheckCircle2, FileText, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  parseCsvHeaders,
  getSampleRows,
  autoDetectMapping,
  autoDetectDateFormat,
  parseGenericCsv,
  parseDate,
  filterDuplicates,
  type CsvColumnMapping,
  type AmountMode,
  type DateFormatHint,
  type GenericParsedTransaction,
} from '@/lib/csv-parser';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useCategoryRules } from '@/hooks/use-category-rules';
import { CategorySelect } from '@/components/category-select';
import { formatCents, now } from '@/lib/utils';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const PREVIEW_PAGE_SIZE = 50;

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ImportStats {
  total: number;
  imported: number;
  duplicates: number;
  skipped: number;
  autoCategorized: number;
  needsReview: number;
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  // Step state
  const [step, setStep] = useState<ImportStep>('upload');

  // Upload state
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);

  // Mapping state
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    date: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    category: null,
  });
  const [amountMode, setAmountMode] = useState<AmountMode>('single');
  const [dateFormat, setDateFormat] = useState<DateFormatHint>('auto');

  // Preview state
  const [transactions, setTransactions] = useState<GenericParsedTransaction[]>([]);
  const [duplicates, setDuplicates] = useState<GenericParsedTransaction[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Map<number, string>>(new Map());
  const [ruleCategoryMap, setRuleCategoryMap] = useState<Map<number, string>>(new Map());
  const [csvCategoryIdMap, setCsvCategoryIdMap] = useState<Map<number, string>>(new Map());
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  // Processing state (mapping → preview transition)
  const [isProcessing, setIsProcessing] = useState(false);

  // Import state
  const [importProgress, setImportProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);

  // Hooks
  const { getExistingFingerprints, bulkImport } = useTransactions();
  const { activeCategories, bulkGetOrCreate: bulkGetOrCreateCategories } = useCategories();

  // Single lookup map for category names — avoids per-row useCategories() calls
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of activeCategories) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [activeCategories]);
  const { applyRulesToBatch } = useCategoryRules();

  const resetState = useCallback(() => {
    setStep('upload');
    setCsvContent('');
    setHeaders([]);
    setSampleRows([]);
    setMapping({ date: null, description: null, amount: null, debit: null, credit: null, category: null });
    setAmountMode('single');
    setDateFormat('auto');
    setTransactions([]);
    setDuplicates([]);
    setParseErrors([]);
    setParseWarnings([]);
    setSkippedIndices(new Set());
    setCategoryOverrides(new Map());
    setRuleCategoryMap(new Map());
    setCsvCategoryIdMap(new Map());
    setEditingCategoryIdx(null);
    setPreviewPage(0);
    setIsProcessing(false);
    setImportProgress(0);
    setStats(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  // =========================================================================
  // Step 1: Upload
  // =========================================================================

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      event.target.value = '';

      const file = files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setParseErrors(['File too large. Maximum file size is 50MB.']);
        return;
      }

      const isValidExtension = file.name.toLowerCase().endsWith('.csv');
      const isValidMimeType =
        file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';

      if (!isValidExtension || !isValidMimeType) {
        setParseErrors(['Invalid file type. Please select a CSV file.']);
        return;
      }

      setParseErrors([]);

      try {
        const content = await file.text();
        setCsvContent(content);
        const csvHeaders = parseCsvHeaders(content);
        setHeaders(csvHeaders);

        const samples = getSampleRows(content, 5);
        setSampleRows(samples);

        const detectedMapping = autoDetectMapping(csvHeaders);
        setMapping(detectedMapping);

        // Auto-detect amount mode
        if (detectedMapping.debit && detectedMapping.credit && !detectedMapping.amount) {
          setAmountMode('split');
        } else {
          setAmountMode('single');
        }

        // Auto-detect date format
        if (detectedMapping.date && samples.length > 0) {
          const dateSamples = samples
            .map((row) => row[detectedMapping.date!] ?? '')
            .filter((v) => v.trim());
          setDateFormat(autoDetectDateFormat(dateSamples));
        }

        setStep('mapping');
      } catch {
        setParseErrors(['Failed to read file.']);
      }
    },
    [],
  );

  // =========================================================================
  // Step 2: Mapping
  // =========================================================================

  const updateMapping = useCallback(
    (field: keyof CsvColumnMapping, value: string) => {
      setMapping((prev) => ({
        ...prev,
        [field]: value === '__none__' ? null : value,
      }));
    },
    [],
  );

  // Detect duplicate column assignments
  const duplicateColumns = useMemo(() => {
    const assigned: { field: string; column: string }[] = [];
    if (mapping.date) assigned.push({ field: 'Date', column: mapping.date });
    if (mapping.description) assigned.push({ field: 'Description', column: mapping.description });
    if (amountMode === 'single') {
      if (mapping.amount) assigned.push({ field: 'Amount', column: mapping.amount });
    } else {
      if (mapping.debit) assigned.push({ field: 'Debit', column: mapping.debit });
      if (mapping.credit) assigned.push({ field: 'Credit', column: mapping.credit });
    }
    if (mapping.category) assigned.push({ field: 'Category', column: mapping.category });

    const dupes = new Map<string, string>(); // column → which other field already uses it
    const seen = new Map<string, string>(); // column → first field that claimed it
    for (const { field, column } of assigned) {
      const existing = seen.get(column);
      if (existing) {
        dupes.set(column, existing);
      } else {
        seen.set(column, field);
      }
    }
    return dupes;
  }, [mapping, amountMode]);

  const mappingValid = useMemo(() => {
    if (!mapping.date || !mapping.description) return false;
    if (amountMode === 'single' && !mapping.amount) return false;
    if (amountMode === 'split' && (!mapping.debit || !mapping.credit)) return false;
    if (duplicateColumns.size > 0) return false;
    return true;
  }, [mapping, amountMode, duplicateColumns]);

  const handleContinueToPreview = useCallback(async () => {
    if (!mappingValid) return;

    setIsProcessing(true);
    setParseErrors([]);

    // Yield so the loading state renders before heavy work
    await new Promise((r) => setTimeout(r, 0));

    try {
      const result = parseGenericCsv(csvContent, mapping, amountMode, dateFormat);

      if (result.errors.length > 0) {
        setParseErrors(result.errors);
        setIsProcessing(false);
        return;
      }

      setParseWarnings(result.warnings);

      // Dedup against existing transactions
      const existingFingerprints = await getExistingFingerprints();
      const { unique, duplicates: dupes } = filterDuplicates(result.transactions, existingFingerprints);

      // Also dedup within the file itself
      const seenFingerprints = new Set<string>();
      const deduped: GenericParsedTransaction[] = [];
      const crossDupes: GenericParsedTransaction[] = [];

      for (const tx of unique) {
        if (seenFingerprints.has(tx.fingerprint)) {
          crossDupes.push(tx);
        } else {
          seenFingerprints.add(tx.fingerprint);
          deduped.push(tx);
        }
      }

      setTransactions(deduped);
      setDuplicates([...dupes, ...crossDupes]);

      // Apply category rules
      const ruleMap = applyRulesToBatch(
        deduped.map((tx) => ({
          description: tx.description,
          amountCents: tx.amountCents,
          type: tx.type,
        })),
      );
      setRuleCategoryMap(ruleMap);

      // Resolve CSV category names to existing category IDs
      const categoryNameToId = new Map<string, string>();
      for (const cat of activeCategories) {
        categoryNameToId.set(cat.name.toLowerCase(), cat.id);
      }
      const csvCatMap = new Map<number, string>();
      for (let idx = 0; idx < deduped.length; idx++) {
        const tx = deduped[idx]!;
        if (tx.category && !ruleMap.has(idx)) {
          const existingId = categoryNameToId.get(tx.category.toLowerCase());
          if (existingId) {
            csvCatMap.set(idx, existingId);
          }
        }
      }
      setCsvCategoryIdMap(csvCatMap);

      // Reset preview state
      setSkippedIndices(new Set());
      setCategoryOverrides(new Map());
      setEditingCategoryIdx(null);
      setPreviewPage(0);
      setStep('preview');
    } catch {
      setParseErrors(['An error occurred while processing the CSV file.']);
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, mapping, amountMode, dateFormat, mappingValid, getExistingFingerprints, applyRulesToBatch, activeCategories]);

  // =========================================================================
  // Step 3: Preview
  // =========================================================================

  const toggleSkip = useCallback((index: number) => {
    setSkippedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSkippedIndices(new Set());
  }, []);

  const deselectAll = useCallback(() => {
    setSkippedIndices(new Set(transactions.map((_, i) => i)));
  }, [transactions]);

  const allSelected = skippedIndices.size === 0;
  const importCount = transactions.length - skippedIndices.size;

  const setCategoryForRow = useCallback((index: number, categoryId: string) => {
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      if (categoryId) {
        next.set(index, categoryId);
      } else {
        next.delete(index);
      }
      return next;
    });
    setEditingCategoryIdx(null);
  }, []);

  // Get effective category ID for a row (override > rule > CSV match)
  const getEffectiveCategoryId = useCallback(
    (index: number): string | null => {
      return categoryOverrides.get(index) ?? ruleCategoryMap.get(index) ?? csvCategoryIdMap.get(index) ?? null;
    },
    [categoryOverrides, ruleCategoryMap, csvCategoryIdMap],
  );

  // =========================================================================
  // Step 4: Importing
  // =========================================================================

  const handleImport = useCallback(async () => {
    setStep('importing');
    setImportProgress(0);

    const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));

    const importTimestamp = now();
    let autoCategorized = 0;
    let needsReview = 0;

    setImportProgress(10);
    await yieldToUI();

    // Filter out skipped transactions
    const toProcess = transactions.filter((_, i) => !skippedIndices.has(i));
    const toProcessIndices = transactions
      .map((_, i) => i)
      .filter((i) => !skippedIndices.has(i));

    // Collect CSV category names that need new categories created
    const categoryNames = new Set<string>();
    for (let j = 0; j < toProcessIndices.length; j++) {
      const originalIndex = toProcessIndices[j]!;
      const tx = toProcess[j]!;
      // Only collect if no override, rule match, or existing category match
      if (!categoryOverrides.has(originalIndex) && !ruleCategoryMap.has(originalIndex) && !csvCategoryIdMap.has(originalIndex) && tx.category) {
        categoryNames.add(tx.category);
      }
    }

    setImportProgress(20);
    await yieldToUI();

    // Bulk create categories from CSV names
    const csvCategoryMap = await bulkGetOrCreateCategories(Array.from(categoryNames));

    setImportProgress(40);
    await yieldToUI();

    // Map to transaction entities
    const toImport = toProcess.map((tx, j) => {
      const originalIndex = toProcessIndices[j]!;

      let categoryId: string | null = null;

      // Priority: user override > rule match > CSV category (pre-resolved or newly created)
      const override = categoryOverrides.get(originalIndex);
      const ruleMatch = ruleCategoryMap.get(originalIndex);
      const csvPreResolved = csvCategoryIdMap.get(originalIndex);

      if (override) {
        categoryId = override;
        autoCategorized++;
      } else if (ruleMatch) {
        categoryId = ruleMatch;
        autoCategorized++;
      } else if (csvPreResolved) {
        categoryId = csvPreResolved;
        autoCategorized++;
      } else if (tx.category) {
        categoryId = csvCategoryMap.get(tx.category) ?? null;
        if (categoryId) autoCategorized++;
      }

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
        importSource: 'csv-import',
        importedAt: importTimestamp,
      };
      return data;
    });

    setImportProgress(70);
    await yieldToUI();

    await bulkImport(toImport);

    setImportProgress(100);

    setStats({
      total: transactions.length + duplicates.length,
      imported: toProcess.length,
      duplicates: duplicates.length,
      skipped: skippedIndices.size,
      autoCategorized,
      needsReview,
    });
    setStep('complete');
  }, [
    transactions,
    duplicates,
    skippedIndices,
    categoryOverrides,
    ruleCategoryMap,
    csvCategoryIdMap,
    bulkGetOrCreateCategories,
    bulkImport,
  ]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Import transactions from any bank&apos;s CSV export file.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Select a CSV file exported from your bank.
              </p>
              <label className="mt-4 inline-block cursor-pointer">
                <span className="sr-only">Select CSV file to import</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button asChild>
                  <span>Select CSV File</span>
                </Button>
              </label>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium">How it works:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Upload your bank&apos;s CSV export</li>
                <li>Map columns to Date, Description, and Amount</li>
                <li>Preview and categorise transactions before importing</li>
                <li>Duplicate transactions are automatically detected</li>
              </ul>
            </div>

            {parseErrors.length > 0 && (
              <ErrorBanner errors={parseErrors} />
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <MappingField
                label="Date Column"
                required
                expect="date"
                value={mapping.date}
                headers={headers}
                sampleRows={sampleRows}
                duplicateColumns={duplicateColumns}
                onChange={(v) => updateMapping('date', v)}
              />

              <MappingField
                label="Description Column"
                required
                expect="description"
                value={mapping.description}
                headers={headers}
                sampleRows={sampleRows}
                duplicateColumns={duplicateColumns}
                onChange={(v) => updateMapping('description', v)}
              />

              <Separator />

              <div>
                <p className="mb-1 text-sm font-medium">Amount Mode</p>
                <Select value={amountMode} onValueChange={(v) => setAmountMode(v as AmountMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single column (signed +/-)</SelectItem>
                    <SelectItem value="split">Separate debit/credit columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {amountMode === 'single' ? (
                <MappingField
                  label="Amount Column"
                  required
                  expect="amount"
                  value={mapping.amount}
                  headers={headers}
                  sampleRows={sampleRows}
                  duplicateColumns={duplicateColumns}
                  onChange={(v) => updateMapping('amount', v)}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <MappingField
                    label="Debit Column"
                    required
                    expect="amount"
                    value={mapping.debit}
                    headers={headers}
                    sampleRows={sampleRows}
                    duplicateColumns={duplicateColumns}
                    onChange={(v) => updateMapping('debit', v)}
                  />
                  <MappingField
                    label="Credit Column"
                    required
                    expect="amount"
                    value={mapping.credit}
                    headers={headers}
                    sampleRows={sampleRows}
                    duplicateColumns={duplicateColumns}
                    onChange={(v) => updateMapping('credit', v)}
                  />
                </div>
              )}

              <Separator />

              <MappingField
                label="Category Column"
                value={mapping.category}
                headers={headers}
                sampleRows={sampleRows}
                duplicateColumns={duplicateColumns}
                onChange={(v) => updateMapping('category', v)}
                placeholder="None"
              />

              <DateFormatField
                dateFormat={dateFormat}
                onDateFormatChange={(v) => setDateFormat(v as DateFormatHint)}
                sampleRows={sampleRows}
                dateColumn={mapping.date}
              />
            </div>

            {parseErrors.length > 0 && (
              <ErrorBanner errors={parseErrors} />
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetState} disabled={isProcessing}>
                Back
              </Button>
              <Button onClick={handleContinueToPreview} disabled={!mappingValid || isProcessing}>
                {isProcessing ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">To import</p>
              </div>
              <div className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {duplicates.length.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
              {parseWarnings.length > 0 && (
                <div className="flex-1 rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {parseWarnings.length.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </div>
              )}
            </div>

            {transactions.length > 0 && (() => {
              const totalPages = Math.ceil(transactions.length / PREVIEW_PAGE_SIZE);
              const pageStart = previewPage * PREVIEW_PAGE_SIZE;
              const pageEnd = Math.min(pageStart + PREVIEW_PAGE_SIZE, transactions.length);
              const pageTransactions = transactions.slice(pageStart, pageEnd);

              return (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      All transactions ({transactions.length.toLocaleString()})
                    </p>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={previewPage === 0}
                          onClick={() => { setPreviewPage((p) => p - 1); setEditingCategoryIdx(null); }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {pageStart + 1}–{pageEnd} of {transactions.length.toLocaleString()}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={previewPage >= totalPages - 1}
                          onClick={() => { setPreviewPage((p) => p + 1); setEditingCategoryIdx(null); }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-lg border">
                    {/* Header row */}
                    <div className="flex items-center gap-2 border-b bg-muted/80 px-3 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => {
                          if (allSelected) deselectAll();
                          else selectAll();
                        }}
                        aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      />
                      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">Date</span>
                      <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">Description</span>
                      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">Category</span>
                      <span className="w-20 shrink-0 text-right text-xs font-medium text-muted-foreground">Amount</span>
                    </div>

                    {/* Transaction rows */}
                    <div className="divide-y">
                      {pageTransactions.map((tx, pageIdx) => {
                        const i = pageStart + pageIdx; // Original index for state lookups
                        const isSkipped = skippedIndices.has(i);
                        const effectiveCategoryId = getEffectiveCategoryId(i);
                        const categoryName = effectiveCategoryId
                          ? categoryNameMap.get(effectiveCategoryId) ?? null
                          : null;
                        // CSV category that doesn't match any existing category (will be created on import)
                        const unmatchedCsvCategory = !categoryName && tx.category ? tx.category : null;
                        const isUncategorisedExpense = !categoryName && !unmatchedCsvCategory && tx.type === 'expense';
                        const isEditing = editingCategoryIdx === i;

                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-3 py-2 ${isSkipped ? 'opacity-40' : ''}`}
                          >
                            <Checkbox
                              checked={!isSkipped}
                              onCheckedChange={() => toggleSkip(i)}
                              aria-label={`${isSkipped ? 'Include' : 'Skip'} transaction: ${tx.description}`}
                            />
                            <span className="w-20 shrink-0 text-sm text-muted-foreground">{tx.date}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm font-medium">{tx.description}</span>
                                <Badge variant={tx.type === 'income' ? 'success' : 'destructive'} className="shrink-0">
                                  {tx.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="w-32 shrink-0">
                              {isSkipped ? (
                                <span className="text-xs text-muted-foreground">Skipped</span>
                              ) : isEditing ? (
                                <CategorySelect
                                  value={effectiveCategoryId ?? ''}
                                  onChange={(v) => setCategoryForRow(i, v)}
                                  allowNone
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                                  onClick={() => setEditingCategoryIdx(i)}
                                >
                                  {categoryName ? (
                                    <span className="truncate">{categoryName}</span>
                                  ) : unmatchedCsvCategory ? (
                                    <span className="truncate italic" title={`"${unmatchedCsvCategory}" will be created as a new category`}>{unmatchedCsvCategory}</span>
                                  ) : isUncategorisedExpense ? (
                                    <span className="text-amber-600 dark:text-amber-400">Uncategorised</span>
                                  ) : (
                                    <span className="text-muted-foreground">Uncategorised</span>
                                  )}
                                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                </button>
                              )}
                            </div>
                            <span
                              className={`w-20 shrink-0 text-right font-mono text-sm ${
                                tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatCents(tx.amountCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}

            {parseWarnings.length > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-800 dark:text-yellow-200">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {parseWarnings.slice(0, 5).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                  {parseWarnings.length > 5 && (
                    <li>...and {parseWarnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importCount === 0}>
                Import {importCount.toLocaleString()} Transaction{importCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">
              Importing {importCount.toLocaleString()} transactions...
            </p>
            <div className="mx-auto mt-4 max-w-xs">
              <Progress value={importProgress} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {importProgress < 20 && 'Preparing...'}
                {importProgress >= 20 && importProgress < 40 && 'Creating categories...'}
                {importProgress >= 40 && importProgress < 60 && 'Applying category rules...'}
                {importProgress >= 60 && importProgress < 80 && 'Processing transactions...'}
                {importProgress >= 80 && 'Saving...'}
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && stats && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6 text-center text-green-800 dark:text-green-200">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 dark:text-green-400" />
              <p className="mt-4 text-lg font-medium">Import Complete!</p>
              <p className="mt-2 text-muted-foreground">
                Successfully imported {stats.imported} transaction{stats.imported !== 1 ? 's' : ''}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-sm sm:grid-cols-5">
              <div>
                <p className="font-medium">{stats.imported}</p>
                <p className="text-muted-foreground">Imported</p>
              </div>
              <div>
                <p className="font-medium">{stats.duplicates}</p>
                <p className="text-muted-foreground">Duplicates</p>
              </div>
              <div>
                <p className="font-medium">{stats.skipped}</p>
                <p className="text-muted-foreground">Skipped</p>
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
                  {stats.needsReview} expense{stats.needsReview !== 1 ? 's' : ''} need
                  categorization. Review them in the Transactions page.
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

function DateFormatField({
  dateFormat,
  onDateFormatChange,
  sampleRows,
  dateColumn,
}: {
  dateFormat: DateFormatHint;
  onDateFormatChange: (value: string) => void;
  sampleRows: Record<string, string>[];
  dateColumn: string | null;
}) {
  // Get a sample raw date and show what it parses to
  const rawSample = dateColumn
    ? (sampleRows.find((row) => (row[dateColumn] ?? '').trim()))?.[dateColumn] ?? ''
    : '';
  const parsed = rawSample ? parseDate(rawSample, dateFormat) : '';

  return (
    <div>
      <p className="mb-1 text-sm font-medium">Date Format</p>
      <Select value={dateFormat} onValueChange={onDateFormatChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto-detect</SelectItem>
          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
          <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
        </SelectContent>
      </Select>
      {rawSample && parsed && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{rawSample.trim()}</span>
          <span>→</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{parsed}</span>
        </p>
      )}
      {rawSample && !parsed && (
        <p className="mt-1.5 text-xs text-destructive">
          Could not parse &ldquo;{rawSample.trim()}&rdquo; with this format
        </p>
      )}
    </div>
  );
}

/** Check if a string looks like a date (has slashes, dashes with digits, or starts with 4-digit year) */
function looksLikeDate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^\d{4}[-/]/.test(v) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(v);
}

/** Check if a string looks like a number/currency */
function looksLikeAmount(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // Strip $, commas, whitespace, parens, then check if it's a number
  const cleaned = v.replace(/[$,\s()]/g, '');
  return /^-?\d+\.?\d*$/.test(cleaned);
}

function validateSamples(
  samples: string[],
  expect?: 'date' | 'amount' | 'description',
): string | null {
  if (samples.length === 0 || !expect) return null;

  if (expect === 'date') {
    const nonDates = samples.filter((s) => !looksLikeDate(s));
    if (nonDates.length === samples.length) {
      return "These values don't look like dates";
    }
    if (nonDates.length > 0) {
      return 'Some values may not be dates';
    }
  }

  if (expect === 'amount') {
    const nonNumeric = samples.filter((s) => !looksLikeAmount(s));
    if (nonNumeric.length === samples.length) {
      return "These values don't look like amounts";
    }
    if (nonNumeric.length > 0) {
      return 'Some values may not be amounts';
    }
  }

  if (expect === 'description') {
    const allNumeric = samples.every((s) => looksLikeAmount(s));
    if (allNumeric) {
      return 'These look like amounts — is this the right column?';
    }
    const allDates = samples.every((s) => looksLikeDate(s));
    if (allDates) {
      return 'These look like dates — is this the right column?';
    }
  }

  return null;
}

function MappingField({
  label,
  required,
  expect,
  value,
  headers,
  sampleRows,
  duplicateColumns,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  expect?: 'date' | 'amount' | 'description';
  value: string | null;
  headers: string[];
  sampleRows: Record<string, string>[];
  duplicateColumns: Map<string, string>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const samples = value
    ? sampleRows
        .map((row) => row[value] ?? '')
        .filter((v) => v.trim())
        .slice(0, 3)
    : [];

  const warning = validateSamples(samples, expect);
  const duplicateOf = value ? duplicateColumns.get(value) : undefined;

  return (
    <div>
      <p className="mb-1 text-sm font-medium">
        {label}{required ? ' *' : ' (optional)'}
      </p>
      <Select value={value ?? '__none__'} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Select column'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{required ? '— Select —' : 'None'}</SelectItem>
          {headers.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {duplicateOf && (
        <p className="mt-1.5 text-xs text-destructive">
          Already used for {duplicateOf}
        </p>
      )}
      {!duplicateOf && warning && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          {warning}
        </p>
      )}
      {!duplicateOf && !warning && samples.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">Will import:</span>
          {samples.map((v, i) => (
            <span key={i}>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{v}</span>
              {i < samples.length - 1 && <span className="ml-1">,</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function ErrorBanner({ errors }: { errors: string[] }) {
  return (
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
  );
}
