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
 * Cadence type for recurring rules
 */
export type CadenceType = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Convert amount from any cadence to monthly equivalent
 */
export function toMonthlyCents(amountCents: number, cadence: CadenceType): number {
  switch (cadence) {
    case 'weekly':
      return Math.round((amountCents * 52) / 12);
    case 'fortnightly':
      return Math.round((amountCents * 26) / 12);
    case 'monthly':
      return amountCents;
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
  }
}

/**
 * Convert amount from monthly to target cadence
 */
export function fromMonthlyCents(monthlyAmountCents: number, targetCadence: CadenceType): number {
  switch (targetCadence) {
    case 'weekly':
      return Math.round((monthlyAmountCents * 12) / 52);
    case 'fortnightly':
      return Math.round((monthlyAmountCents * 12) / 26);
    case 'monthly':
      return monthlyAmountCents;
    case 'quarterly':
      return Math.round(monthlyAmountCents * 3);
    case 'yearly':
      return Math.round(monthlyAmountCents * 12);
  }
}

/**
 * Cadence display labels
 */
export const CADENCE_LABELS: Record<CadenceType, string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
};

export const CADENCE_SHORT_LABELS: Record<CadenceType, string> = {
  weekly: '/week',
  fortnightly: '/fortnight',
  monthly: '/month',
  quarterly: '/quarter',
  yearly: '/year',
};

export const CADENCE_PER_LABELS: Record<CadenceType, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  yearly: 'per year',
};

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
  // Past
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'lastYear'
  // Current periods
  | 'thisWeek'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisFinancialYear'
  // Future
  | 'next7days'
  | 'next30days'
  | 'next3months'
  | 'next12months'
  // Rolling (centred on today)
  | 'rolling30days'
  | 'rolling3months'
  | 'rolling6months'
  | 'rolling12months';

export function getDateRangePreset(preset: DateRangePreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const todayStr = formatISODate(now);

  switch (preset) {
    // Past-focused
    case 'last7days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case 'last30days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case 'last3months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }
    case 'lastYear': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      return { startDate: formatISODate(start), endDate: todayStr };
    }

    // Current periods
    case 'thisWeek': {
      // Monday to Sunday containing today
      const start = new Date(now);
      const day = start.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diffToMonday);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'thisQuarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStart, 1);
      const end = new Date(now.getFullYear(), quarterStart + 3, 0);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'thisFinancialYear':
      return getCurrentFinancialYear();

    // Future-focused
    case 'next7days': {
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      return { startDate: todayStr, endDate: formatISODate(end) };
    }
    case 'next30days': {
      const end = new Date(now);
      end.setDate(end.getDate() + 29);
      return { startDate: todayStr, endDate: formatISODate(end) };
    }
    case 'next3months': {
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
      return { startDate: todayStr, endDate: formatISODate(end) };
    }
    case 'next12months': {
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      return { startDate: todayStr, endDate: formatISODate(end) };
    }

    // Rolling (centred on today)
    case 'rolling30days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 15);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'rolling3months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setDate(start.getDate() - 14);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() + 14);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'rolling6months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
    case 'rolling12months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 6);
      return { startDate: formatISODate(start), endDate: formatISODate(end) };
    }
  }
}

// -----------------------------------------------------------------------------
// Timeline Picker Helpers
// -----------------------------------------------------------------------------

import type { TimelineMode, TimelineUnit } from './types';

/**
 * Bounds for timeline amount based on unit
 */
export const TIMELINE_UNIT_BOUNDS: Record<
  TimelineUnit,
  { min: number; max: number; default: number }
> = {
  months: { min: 3, max: 24, default: 6 },
  years: { min: 1, max: 10, default: 2 },
};

/**
 * Add a duration to a date based on unit and return formatted ISO date string
 */
function addDuration(date: Date, amount: number, unit: TimelineUnit): string {
  const result = new Date(date);
  switch (unit) {
    case 'months':
      result.setMonth(result.getMonth() + amount);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + amount);
      break;
  }
  return formatISODate(result);
}

/**
 * Calculate date range based on timeline mode, amount, and unit
 */
export function calculateTimelineDateRange(
  mode: TimelineMode,
  amount: number,
  unit: TimelineUnit,
  customStartDate?: string,
  customEndDate?: string,
): { startDate: string; endDate: string } {
  const todayDate = new Date();

  switch (mode) {
    case 'past':
      // End is today, start is amount*unit before
      return {
        startDate: addDuration(todayDate, -amount, unit),
        endDate: formatISODate(todayDate),
      };
    case 'around-present': {
      // Today is centered - half the duration on each side
      // Convert to months for calculation to handle "1 year around now" correctly
      const totalMonths = unit === 'years' ? amount * 12 : amount;
      const halfMonths = Math.floor(totalMonths / 2);
      return {
        startDate: addDuration(todayDate, -halfMonths, 'months'),
        endDate: addDuration(todayDate, halfMonths, 'months'),
      };
    }
    case 'future':
      // Start is today, end is amount*unit after
      return {
        startDate: formatISODate(todayDate),
        endDate: addDuration(todayDate, amount, unit),
      };
    case 'custom': {
      // Use stored custom dates, fallback to around-present if not set
      if (customStartDate && customEndDate) {
        return { startDate: customStartDate, endDate: customEndDate };
      }
      // Fallback uses same logic as around-present
      const totalMonths = unit === 'years' ? amount * 12 : amount;
      const halfMonths = Math.floor(totalMonths / 2);
      return {
        startDate: addDuration(todayDate, -halfMonths, 'months'),
        endDate: addDuration(todayDate, halfMonths, 'months'),
      };
    }
  }
}

/**
 * Format a duration in days as a human-readable string
 */
export function formatDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 14) {
    return `${diffDays} days`;
  } else if (diffDays < 60) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.round(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = Math.round(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
}

/**
 * Format date for compact display (e.g., "Jan 1" or "Jan 1, 2025")
 */
export function formatCompactDate(isoDate: string, includeYear = false): string {
  const date = new Date(isoDate);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  if (includeYear) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-AU', options);
}

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Format date as long format with ordinal: "1st January 2025"
 */
export function formatLongDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-AU', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

/**
 * Calculate compound interest
 * @param principalCents Starting amount in cents
 * @param annualRate Annual interest rate as percentage (e.g., 4.5 for 4.5%)
 * @param compoundingFrequency How often interest compounds
 * @param years Number of years
 * @returns Final amount in cents
 */
export function calculateCompoundInterest(
  principalCents: number,
  annualRate: number,
  compoundingFrequency: 'daily' | 'monthly' | 'yearly',
  years: number,
): number {
  if (annualRate <= 0 || years <= 0) return principalCents;

  const rate = annualRate / 100; // Convert percentage to decimal
  const n = compoundingFrequency === 'daily' ? 365 : compoundingFrequency === 'monthly' ? 12 : 1;

  // A = P(1 + r/n)^(nt)
  const finalAmount = principalCents * Math.pow(1 + rate / n, n * years);
  return Math.round(finalAmount);
}

/**
 * Calculate interest earned over a period
 * @param principalCents Starting amount in cents
 * @param annualRate Annual interest rate as percentage
 * @param compoundingFrequency How often interest compounds
 * @param years Number of years
 * @returns Interest earned in cents
 */
export function calculateInterestEarned(
  principalCents: number,
  annualRate: number,
  compoundingFrequency: 'daily' | 'monthly' | 'yearly',
  years: number,
): number {
  const finalAmount = calculateCompoundInterest(
    principalCents,
    annualRate,
    compoundingFrequency,
    years,
  );
  return finalAmount - principalCents;
}
