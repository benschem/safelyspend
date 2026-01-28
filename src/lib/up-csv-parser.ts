import Papa from 'papaparse';

export interface UpCsvRow {
  Time: string;
  'BSB/Account Number': string;
  'Account Name': string;
  'Transaction Type': string;
  Payee: string;
  Description: string;
  Category: string;
  Tags: string;
  'Subtotal (AUD)': string;
  Currency: string;
  'Subtotal (Transaction Currency)': string;
  'Round Up (AUD)': string;
  'Total (AUD)': string;
  'Payment Method': string;
  'Settled Date': string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amountCents: number;
  type: 'income' | 'expense';
  category: string | null;
  paymentMethod: string | null;
  notes: string;
  // For duplicate detection - uses full timestamp + account for uniqueness
  fingerprint: string;
}

// Transaction types that indicate income
const INCOME_TYPES = new Set([
  'Salary',
  'Direct Credit',
  'Interest',
  'Deposit',
]);

// Transaction types to skip (internal transfers, round-ups)
const SKIP_TYPES = new Set([
  'Transfer',
  'Round Up',
  'Cover',
]);

// Payees to skip (internal accounts)
const SKIP_PAYEES = new Set([
  '2Up',
  '2UP',
]);

/**
 * Sanitize string to prevent CSV formula injection.
 * Prefixes dangerous characters with a single quote to prevent
 * formula execution if data is ever exported to Excel/Sheets.
 */
function sanitizeFormulaInjection(value: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}

function parseUpDate(dateStr: string): string {
  // Up CSV uses format like "2026-01-15 09:30:00 +11:00"
  // Extract just the date part
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match && match[1]) {
    return match[1];
  }
  // Fallback: try to parse and format
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const isoDate = date.toISOString().split('T')[0];
    return isoDate ?? '';
  }
  return '';
}

function parseAmount(amountStr: string): number {
  // Remove currency symbols and commas, parse as float
  const cleaned = amountStr.replace(/[$,]/g, '').trim();
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  // Convert to cents and make positive (we determine sign from type)
  return Math.round(Math.abs(amount) * 100);
}

// Create a fingerprint for deduplication
// Uses full timestamp + account + amount + description for maximum uniqueness
function createFingerprint(
  timestamp: string,
  account: string,
  amountCents: number,
  description: string,
): string {
  return `up:${timestamp}|${account}|${amountCents}|${description.toLowerCase().trim()}`;
}

function buildNotes(row: UpCsvRow): string {
  const parts: string[] = [];

  // Add original description if different from payee
  if (row.Description && row.Description !== row.Payee) {
    parts.push(row.Description);
  }

  // Add tags if present
  if (row.Tags && row.Tags.trim()) {
    parts.push(`Tags: ${row.Tags}`);
  }

  return parts.join(' | ');
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  skipped: Array<{
    row: UpCsvRow;
    reason: string;
  }>;
  errors: string[];
}

export function parseUpCsv(csvContent: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    const result: ParseResult = {
      transactions: [],
      skipped: [],
      errors: [],
    };

    Papa.parse<UpCsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (parseResult) => {
        if (parseResult.errors.length > 0) {
          result.errors = parseResult.errors.map(
            (e) => `Row ${e.row}: ${e.message}`,
          );
        }

        for (const row of parseResult.data) {
          // Skip rows without required fields
          if (!row.Time || !row.Payee || !row['Total (AUD)']) {
            continue;
          }

          const transactionType = row['Transaction Type']?.trim() || '';
          const payee = row.Payee?.trim() || '';

          // Skip internal transfers and round-ups
          if (SKIP_TYPES.has(transactionType)) {
            result.skipped.push({
              row,
              reason: `Skipped transaction type: ${transactionType}`,
            });
            continue;
          }

          // Skip transfers to internal accounts (like 2Up)
          if (SKIP_PAYEES.has(payee)) {
            result.skipped.push({
              row,
              reason: `Skipped internal account: ${payee}`,
            });
            continue;
          }

          const date = parseUpDate(row.Time);
          if (!date) {
            result.skipped.push({
              row,
              reason: 'Could not parse date',
            });
            continue;
          }

          const amountCents = parseAmount(row['Total (AUD)']);
          if (amountCents === 0) {
            result.skipped.push({
              row,
              reason: 'Zero amount',
            });
            continue;
          }

          // Determine if income or expense
          // Check transaction type first, then fall back to checking if amount was positive
          const isIncome = INCOME_TYPES.has(transactionType) ||
            (parseFloat(row['Total (AUD)'].replace(/[$,]/g, '')) > 0);

          const transaction: ParsedTransaction = {
            date,
            description: sanitizeFormulaInjection(payee),
            amountCents,
            type: isIncome ? 'income' : 'expense',
            category: row.Category?.trim() || null,
            paymentMethod: row['Payment Method']?.trim() || null,
            notes: sanitizeFormulaInjection(buildNotes(row)),
            fingerprint: createFingerprint(
              row.Time,
              row['BSB/Account Number'] || '',
              amountCents,
              payee, // Use original for fingerprint to match future imports
            ),
          };

          result.transactions.push(transaction);
        }

        resolve(result);
      },
      error: (error: Error) => {
        result.errors.push(`Parse error: ${error.message}`);
        resolve(result);
      },
    });
  });
}

// Filter out transactions that already exist based on fingerprint
export function filterDuplicates(
  newTransactions: ParsedTransaction[],
  existingFingerprints: Set<string>,
): {
  unique: ParsedTransaction[];
  duplicates: ParsedTransaction[];
} {
  const unique: ParsedTransaction[] = [];
  const duplicates: ParsedTransaction[] = [];

  for (const tx of newTransactions) {
    if (existingFingerprints.has(tx.fingerprint)) {
      duplicates.push(tx);
    } else {
      unique.push(tx);
    }
  }

  return { unique, duplicates };
}
