import { daysBetween } from './dates';
import type { Transaction, ForecastRule } from './types';

const SIMILAR_WITHIN_DAYS = 3;

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

  return existing.filter((tx) => {
    if (excludeId && tx.id === excludeId) return false;
    if (tx.description.toLowerCase() !== descLower) return false;
    if (Math.abs(tx.amountCents) !== Math.abs(amountCents)) return false;

    return Math.abs(daysBetween(date, tx.date)) <= SIMILAR_WITHIN_DAYS;
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
