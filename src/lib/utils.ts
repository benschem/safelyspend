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

import type { TimelineMode, ZoomLevel } from './types';

/**
 * Number of days offset for each zoom level
 */
const ZOOM_OFFSETS: Record<ZoomLevel, number> = {
  weeks: 28, // ±4 weeks
  months: 90, // ±3 months
  quarters: 180, // ±6 months
  years: 730, // ±2 years
  decade: 1825, // ±5 years
};

/**
 * Human-readable labels for zoom levels
 */
export const ZOOM_LEVEL_LABELS: Record<ZoomLevel, string> = {
  weeks: '2 months',
  months: '6 months',
  quarters: '1 year',
  years: '4 years',
  decade: '10 years',
};

/**
 * Add days to a date and return formatted ISO date string
 */
export function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return formatISODate(result);
}

/**
 * Calculate date range based on timeline mode and zoom level
 */
export function calculateTimelineDateRange(
  mode: TimelineMode,
  zoomLevel: ZoomLevel,
  customStartDate?: string,
  customEndDate?: string,
): { startDate: string; endDate: string } {
  const todayDate = new Date();
  const offset = ZOOM_OFFSETS[zoomLevel];

  switch (mode) {
    case 'past':
      // Now is end date, start is offset days before
      return {
        startDate: addDays(todayDate, -offset * 2),
        endDate: formatISODate(todayDate),
      };
    case 'around-present':
      // Now is centered
      return {
        startDate: addDays(todayDate, -offset),
        endDate: addDays(todayDate, offset),
      };
    case 'future':
      // Now is start date, end is offset days after
      return {
        startDate: formatISODate(todayDate),
        endDate: addDays(todayDate, offset * 2),
      };
    case 'custom':
      // Use stored custom dates, fallback to around-present if not set
      if (customStartDate && customEndDate) {
        return { startDate: customStartDate, endDate: customEndDate };
      }
      return {
        startDate: addDays(todayDate, -offset),
        endDate: addDays(todayDate, offset),
      };
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
