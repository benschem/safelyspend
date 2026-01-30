import { describe, it, expect } from 'vitest';
import { parseUpCsv, filterDuplicates, type ParsedTransaction } from '@/lib/up-csv-parser';

// =============================================================================
// CSV Parsing Tests
// =============================================================================

describe('parseUpCsv', () => {
  const makeRow = (overrides: Record<string, string> = {}) => {
    const defaults = {
      Time: '2026-01-15 09:30:00 +11:00',
      'BSB/Account Number': '123-456/12345678',
      'Account Name': 'Spending',
      'Transaction Type': 'Purchase',
      Payee: 'Coffee Shop',
      Description: 'COFFEE SHOP MELBOURNE',
      Category: 'Food & Drink',
      Tags: '',
      'Subtotal (AUD)': '-4.50',
      Currency: 'AUD',
      'Subtotal (Transaction Currency)': '-4.50',
      'Round Up (AUD)': '0.50',
      'Total (AUD)': '-5.00',
      'Payment Method': 'Card',
      'Settled Date': '2026-01-15',
    };
    return { ...defaults, ...overrides };
  };

  const rowToCsv = (rows: Record<string, string>[]): string => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]!);
    const headerLine = headers.join(',');
    const dataLines = rows.map((row) =>
      headers.map((h) => `"${row[h] ?? ''}"`).join(','),
    );
    return [headerLine, ...dataLines].join('\n');
  };

  it('parses a valid expense transaction', async () => {
    const csv = rowToCsv([makeRow()]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.type).toBe('expense');
    expect(result.transactions[0]!.amountCents).toBe(500);
    expect(result.transactions[0]!.description).toBe('Coffee Shop');
    expect(result.transactions[0]!.date).toBe('2026-01-15');
  });

  it('parses a valid income transaction', async () => {
    const csv = rowToCsv([
      makeRow({
        'Transaction Type': 'Salary',
        Payee: 'Employer Inc',
        'Total (AUD)': '5000.00',
      }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.type).toBe('income');
    expect(result.transactions[0]!.amountCents).toBe(500000);
  });

  it('skips Transfer transactions', async () => {
    const csv = rowToCsv([
      makeRow({ 'Transaction Type': 'Transfer' }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('Transfer');
  });

  it('skips Round Up transactions', async () => {
    const csv = rowToCsv([
      makeRow({ 'Transaction Type': 'Round Up' }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('Round Up');
  });

  it('skips 2Up internal transfers', async () => {
    const csv = rowToCsv([makeRow({ Payee: '2Up' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('internal account');
  });

  it('skips rows with zero amount', async () => {
    const csv = rowToCsv([makeRow({ 'Total (AUD)': '0.00' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('Zero amount');
  });

  it('skips rows with invalid date', async () => {
    const csv = rowToCsv([makeRow({ Time: 'invalid-date' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain('parse date');
  });

  it('handles multiple transactions', async () => {
    const csv = rowToCsv([
      makeRow({ Payee: 'Shop A', 'Total (AUD)': '-10.00' }),
      makeRow({ Payee: 'Shop B', 'Total (AUD)': '-20.00' }),
      makeRow({ Payee: 'Shop C', 'Total (AUD)': '-30.00' }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(3);
  });

  it('extracts category from CSV', async () => {
    const csv = rowToCsv([makeRow({ Category: 'Groceries' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.category).toBe('Groceries');
  });

  it('creates fingerprint for deduplication', async () => {
    const csv = rowToCsv([makeRow()]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.fingerprint).toContain('up:');
    expect(result.transactions[0]!.fingerprint).toContain('coffee shop');
  });

  it('sanitizes formula injection in description', async () => {
    const csv = rowToCsv([makeRow({ Payee: '=SUM(A1:A10)' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.description).toBe("'=SUM(A1:A10)");
  });

  it('sanitizes formula injection starting with +', async () => {
    const csv = rowToCsv([makeRow({ Payee: '+61400000000' })]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.description).toBe("'+61400000000");
  });

  it('handles empty CSV', async () => {
    const result = await parseUpCsv('');

    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('handles CSV with only headers', async () => {
    const csv = 'Time,Payee,Total (AUD)';
    const result = await parseUpCsv(csv);

    expect(result.transactions).toHaveLength(0);
  });

  it('treats Direct Credit as income', async () => {
    const csv = rowToCsv([
      makeRow({
        'Transaction Type': 'Direct Credit',
        'Total (AUD)': '100.00',
      }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.type).toBe('income');
  });

  it('treats positive amounts as income', async () => {
    const csv = rowToCsv([
      makeRow({
        'Transaction Type': 'Refund',
        'Total (AUD)': '25.00',
      }),
    ]);
    const result = await parseUpCsv(csv);

    expect(result.transactions[0]!.type).toBe('income');
  });
});

// =============================================================================
// Duplicate Filtering Tests
// =============================================================================

describe('filterDuplicates', () => {
  const makeTx = (fingerprint: string): ParsedTransaction => ({
    date: '2026-01-15',
    description: 'Test',
    amountCents: 1000,
    type: 'expense',
    category: null,
    notes: '',
    fingerprint,
  });

  it('returns all transactions when no duplicates exist', () => {
    const transactions = [makeTx('fp1'), makeTx('fp2'), makeTx('fp3')];
    const existing = new Set<string>();

    const { unique, duplicates } = filterDuplicates(transactions, existing);

    expect(unique).toHaveLength(3);
    expect(duplicates).toHaveLength(0);
  });

  it('filters out existing fingerprints', () => {
    const transactions = [makeTx('fp1'), makeTx('fp2'), makeTx('fp3')];
    const existing = new Set(['fp2']);

    const { unique, duplicates } = filterDuplicates(transactions, existing);

    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.fingerprint).toBe('fp2');
  });

  it('handles all duplicates', () => {
    const transactions = [makeTx('fp1'), makeTx('fp2')];
    const existing = new Set(['fp1', 'fp2']);

    const { unique, duplicates } = filterDuplicates(transactions, existing);

    expect(unique).toHaveLength(0);
    expect(duplicates).toHaveLength(2);
  });

  it('handles empty transaction list', () => {
    const transactions: ParsedTransaction[] = [];
    const existing = new Set(['fp1']);

    const { unique, duplicates } = filterDuplicates(transactions, existing);

    expect(unique).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
  });
});
