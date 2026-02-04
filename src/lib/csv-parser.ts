import Papa from 'papaparse';

// =============================================================================
// Types
// =============================================================================

export interface CsvColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null; // Single signed amount column
  debit: string | null; // Split mode: expense column
  credit: string | null; // Split mode: income column
  category: string | null; // Optional
}

export type AmountMode = 'single' | 'split';
export type DateFormatHint = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'auto';

export interface GenericParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // Positive
  type: 'income' | 'expense';
  category: string | null; // From CSV column if mapped
  fingerprint: string; // "csv:{date}|{amountCents}|{desc}"
  rawRow: Record<string, string>;
}

export interface GenericParseResult {
  transactions: GenericParsedTransaction[];
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Sanitization
// =============================================================================

/**
 * Sanitize string to prevent CSV formula injection.
 * Prefixes dangerous characters with a single quote.
 */
function sanitizeFormulaInjection(value: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}

// =============================================================================
// Header detection
// =============================================================================

const DATE_HEADERS = [
  'date',
  'time',
  'timestamp',
  'transaction date',
  'posted date',
  'settled date',
  'value date',
  'trans date',
  'effective date',
];

const DESCRIPTION_HEADERS = [
  'description',
  'details',
  'narrative',
  'memo',
  'payee',
  'merchant',
  'transaction description',
  'particulars',
  'reference',
];

const AMOUNT_HEADERS = ['amount', 'total', 'value', 'sum', 'total (aud)', 'amount (aud)'];

const DEBIT_HEADERS = ['debit', 'withdrawal', 'outflow', 'debit amount'];

const CREDIT_HEADERS = ['credit', 'deposit', 'inflow', 'credit amount'];

const CATEGORY_HEADERS = ['category', 'type', 'label', 'tag'];

function matchHeader(headers: string[], candidates: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate);
    if (idx !== -1 && headers[idx]) {
      return headers[idx]!;
    }
  }
  return null;
}

// =============================================================================
// Public API
// =============================================================================

/** Extract headers from CSV content */
export function parseCsvHeaders(csv: string): string[] {
  const result = Papa.parse<string[]>(csv, {
    header: false,
    preview: 1,
    skipEmptyLines: true,
  });
  if (result.data.length > 0 && result.data[0]) {
    return result.data[0].map((h) => h.trim());
  }
  return [];
}

/** Get sample rows from CSV content */
export function getSampleRows(csv: string, count = 5): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    preview: count,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return result.data;
}

/** Auto-detect column mapping from headers */
export function autoDetectMapping(headers: string[]): CsvColumnMapping {
  return {
    date: matchHeader(headers, DATE_HEADERS),
    description: matchHeader(headers, DESCRIPTION_HEADERS),
    amount: matchHeader(headers, AMOUNT_HEADERS),
    debit: matchHeader(headers, DEBIT_HEADERS),
    credit: matchHeader(headers, CREDIT_HEADERS),
    category: matchHeader(headers, CATEGORY_HEADERS),
  };
}

/** Auto-detect date format from sample values */
export function autoDetectDateFormat(samples: string[]): DateFormatHint {
  const validSamples = samples.filter((s) => s && s.trim());
  if (validSamples.length === 0) return 'auto';

  let isoCount = 0;
  let slashCount = 0;
  let dashDMYCount = 0;
  let dayGt12Count = 0;
  let monthGt12Count = 0;

  for (const sample of validSamples) {
    const trimmed = sample.trim();

    // ISO: YYYY-MM-DD (starts with 4-digit year)
    if (/^\d{4}[-/]/.test(trimmed)) {
      isoCount++;
      continue;
    }

    // DD/MM/YYYY or MM/DD/YYYY
    if (trimmed.includes('/')) {
      slashCount++;
      const parts = trimmed.split('/');
      const first = parseInt(parts[0] ?? '', 10);
      const second = parseInt(parts[1] ?? '', 10);
      if (first > 12) dayGt12Count++; // First part > 12 means it's a day → DD/MM/YYYY
      if (second > 12) monthGt12Count++; // Second part > 12 means it's a day → MM/DD/YYYY
      continue;
    }

    // DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
      dashDMYCount++;
    }
  }

  // If most start with 4-digit year, it's ISO
  if (isoCount > validSamples.length / 2) return 'YYYY-MM-DD';

  // DD-MM-YYYY format
  if (dashDMYCount > validSamples.length / 2) return 'DD-MM-YYYY';

  // Slash-separated: determine DD/MM vs MM/DD
  if (slashCount > 0) {
    if (dayGt12Count > 0 && monthGt12Count === 0) return 'DD/MM/YYYY';
    if (monthGt12Count > 0 && dayGt12Count === 0) return 'MM/DD/YYYY';
    // Ambiguous — default to AU locale
    return 'DD/MM/YYYY';
  }

  return 'auto';
}

// =============================================================================
// Date parsing
// =============================================================================

export function parseDate(dateStr: string, format: DateFormatHint): string {
  const trimmed = dateStr.trim();

  // Try ISO first (YYYY-MM-DD or YYYY/MM/DD)
  if (format === 'YYYY-MM-DD' || format === 'auto') {
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
    }
    if (format === 'YYYY-MM-DD') return '';
  }

  // DD/MM/YYYY
  if (format === 'DD/MM/YYYY' || format === 'auto') {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (match) {
      const [, d, m, yRaw] = match;
      const y = (yRaw ?? '').length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
    }
  }

  // MM/DD/YYYY
  if (format === 'MM/DD/YYYY') {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (match) {
      const [, m, d, yRaw] = match;
      const y = (yRaw ?? '').length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY
  if (format === 'DD-MM-YYYY' || format === 'auto') {
    const match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
    if (match) {
      const [, d, m, yRaw] = match;
      const y = (yRaw ?? '').length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
    }
  }

  // Last resort: try native Date parsing
  if (format === 'auto') {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] ?? '';
    }
  }

  return '';
}

// =============================================================================
// Amount parsing
// =============================================================================

function parseAmountValue(amountStr: string): number {
  // Strip $, commas, whitespace
  let cleaned = amountStr.replace(/[$,\s]/g, '').trim();

  // Handle parentheses for negatives: (100.00) → -100.00
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch && parenMatch[1]) {
    cleaned = '-' + parenMatch[1];
  }

  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

// =============================================================================
// Main parse function
// =============================================================================

export function parseGenericCsv(
  csv: string,
  mapping: CsvColumnMapping,
  amountMode: AmountMode,
  dateFormat: DateFormatHint,
): GenericParseResult {
  const result: GenericParseResult = {
    transactions: [],
    errors: [],
    warnings: [],
  };

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) {
      result.errors.push(`Row ${(e.row ?? 0) + 1}: ${e.message}`);
    }
  }

  const dateCol = mapping.date;
  const descCol = mapping.description;

  if (!dateCol || !descCol) {
    result.errors.push('Date and Description columns are required.');
    return result;
  }

  // Determine actual date format if auto
  let resolvedDateFormat = dateFormat;
  if (dateFormat === 'auto') {
    const dateSamples = parsed.data
      .slice(0, 10)
      .map((row) => row[dateCol] ?? '')
      .filter((v) => v.trim());
    resolvedDateFormat = autoDetectDateFormat(dateSamples);
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row) continue;

    const rawDate = row[dateCol] ?? '';
    const rawDesc = row[descCol] ?? '';

    if (!rawDate.trim() || !rawDesc.trim()) {
      continue; // Skip blank rows
    }

    const date = parseDate(rawDate, resolvedDateFormat);
    if (!date) {
      result.warnings.push(`Row ${i + 2}: Could not parse date "${rawDate}"`);
      continue;
    }

    const description = sanitizeFormulaInjection(rawDesc.trim());

    let amountCents = 0;
    let type: 'income' | 'expense';

    if (amountMode === 'single') {
      const amountCol = mapping.amount;
      if (!amountCol) {
        result.errors.push('Amount column is required in single column mode.');
        return result;
      }
      const rawAmount = row[amountCol] ?? '';
      const signedCents = parseAmountValue(rawAmount);
      if (signedCents === 0 && rawAmount.trim()) {
        result.warnings.push(`Row ${i + 2}: Could not parse amount "${rawAmount}"`);
        continue;
      }
      if (signedCents === 0) continue; // Skip zero-amount rows
      type = signedCents > 0 ? 'income' : 'expense';
      amountCents = Math.abs(signedCents);
    } else {
      // Split mode
      const debitCol = mapping.debit;
      const creditCol = mapping.credit;
      if (!debitCol || !creditCol) {
        result.errors.push('Debit and Credit columns are required in split mode.');
        return result;
      }

      const rawDebit = row[debitCol] ?? '';
      const rawCredit = row[creditCol] ?? '';
      const debitCents = Math.abs(parseAmountValue(rawDebit));
      const creditCents = Math.abs(parseAmountValue(rawCredit));

      if (debitCents === 0 && creditCents === 0) continue; // Skip zero rows

      if (debitCents > 0) {
        type = 'expense';
        amountCents = debitCents;
      } else {
        type = 'income';
        amountCents = creditCents;
      }
    }

    // Category from CSV
    const categoryCol = mapping.category;
    const rawCategory = categoryCol ? (row[categoryCol] ?? '').trim() : '';
    const category = rawCategory ? sanitizeFormulaInjection(rawCategory) : null;

    // Fingerprint for deduplication
    const fingerprint = `csv:${date}|${amountCents}|${description.toLowerCase().trim()}`;

    result.transactions.push({
      date,
      description,
      amountCents,
      type,
      category,
      fingerprint,
      rawRow: row,
    });
  }

  return result;
}

// =============================================================================
// Duplicate filtering (reusable for any import source)
// =============================================================================

export function filterDuplicates<T extends { fingerprint: string }>(
  newTransactions: T[],
  existingFingerprints: Set<string>,
): { unique: T[]; duplicates: T[] } {
  const unique: T[] = [];
  const duplicates: T[] = [];

  for (const tx of newTransactions) {
    if (existingFingerprints.has(tx.fingerprint)) {
      duplicates.push(tx);
    } else {
      unique.push(tx);
    }
  }

  return { unique, duplicates };
}
