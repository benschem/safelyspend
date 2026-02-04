import type { Transaction, ForecastRule } from './types';

/**
 * Find transactions with similar description, amount, and date (within ±3 days).
 * Used to warn users about potential duplicates when creating transactions.
 */
export function findSimilarTransactions(
  description: string,
  amountCents: number,
  date: string,
  existing: Transaction[],
  excludeId?: string,
): Transaction[] {
  if (!description.trim() || amountCents <= 0 || !date) return [];

  const descLower = description.trim().toLowerCase();
  const targetDate = new Date(date);
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  return existing.filter((tx) => {
    if (excludeId && tx.id === excludeId) return false;
    if (tx.description.toLowerCase() !== descLower) return false;
    if (Math.abs(tx.amountCents) !== Math.abs(amountCents)) return false;

    const txDate = new Date(tx.date);
    return Math.abs(txDate.getTime() - targetDate.getTime()) <= threeDaysMs;
  });
}

/**
 * Find forecast rules with the same description and amount.
 * Used to warn users about potential duplicates when creating forecast rules.
 */
export function findSimilarForecastRules(
  description: string,
  amountCents: number,
  existing: ForecastRule[],
  excludeId?: string,
): ForecastRule[] {
  if (!description.trim() || amountCents <= 0) return [];

  const descLower = description.trim().toLowerCase();

  return existing.filter((rule) => {
    if (excludeId && rule.id === excludeId) return false;
    if (rule.description.toLowerCase() !== descLower) return false;
    return rule.amountCents === amountCents;
  });
}
