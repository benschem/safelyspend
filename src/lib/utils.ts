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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

/**
 * Get the current Australian financial year dates (July 1 - June 30)
 */
export function getCurrentFinancialYear(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, so July = 6

  // If we're in Jan-June, FY started last year
  // If we're in July-Dec, FY started this year
  const fyStartYear = month < 6 ? year - 1 : year;
  const fyEndYear = fyStartYear + 1;

  return {
    startDate: `${fyStartYear}-07-01`,
    endDate: `${fyEndYear}-06-30`,
  };
}

/**
 * Get the last day of a month
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format a year-month string (YYYY-MM) for display
 */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

/**
 * Get all months between two dates (inclusive)
 * Returns array of YYYY-MM strings
 */
export function getMonthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Format cents as abbreviated currency string for chart axes
 * e.g., 150000 -> "$1.5k", 1500000 -> "$15k", 150000000 -> "$1.5M"
 */
export function formatCentsShort(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';

  if (dollars >= 1000000) {
    const millions = dollars / 1000000;
    return `${sign}$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  }
  if (dollars >= 1000) {
    const thousands = dollars / 1000;
    return `${sign}$${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  return `${sign}$${dollars.toFixed(0)}`;
}

/**
 * Format a date range for compact display
 * e.g., "1 Jul 2025 – 30 Jun 2026" or "Jul 2025 – Jun 2026" if full months
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startStr = start.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${startStr} – ${endStr}`;
}

/**
 * Get date range presets relative to today
 */
export type DateRangePreset =
  | '1week'
  | '1month'
  | '3months'
  | '6months'
  | '1year'
  | 'financialYear';

export function getDateRangePreset(preset: DateRangePreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const todayStr = formatISODate(now);

  switch (preset) {
    case '1week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case '1month': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case '3months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case '6months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case '1year': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case 'financialYear':
      return getCurrentFinancialYear();
  }
}
