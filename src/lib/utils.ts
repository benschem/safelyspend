import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents as currency string
 * @param cents Amount in cents (e.g., 1234 = $12.34)
 * @param currency Currency code (default: AUD)
 */
export function formatMoney(cents: number, currency = 'AUD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(dollars);
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format date for display
 */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get today's date as ISO string (date only)
 */
export function today(): string {
  const iso = new Date().toISOString();
  return iso.slice(0, 10); // YYYY-MM-DD
}

/**
 * Get current timestamp as ISO string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Generate a new UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Format cents as currency string (alias for formatMoney)
 */
export function formatCents(cents: number): string {
  return formatMoney(cents);
}

/**
 * Parse a dollar input string to cents
 * Handles empty strings, invalid input, and decimal values
 */
export function parseCentsFromInput(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) return 0;

  return Math.round(parsed * 100);
}
