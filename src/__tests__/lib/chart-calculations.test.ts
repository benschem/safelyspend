import { describe, it, expect } from 'vitest';
import {
  formatISODate,
  getMonthsBetween,
  toMonthlyCents,
  fromMonthlyCents,
  type CadenceType,
} from '@/lib/utils';

// =============================================================================
// formatISODate — Must use LOCAL date components, not UTC
// =============================================================================

describe('formatISODate', () => {
  it('formats a simple date correctly', () => {
    const date = new Date(2026, 0, 15); // Jan 15 2026 (local)
    expect(formatISODate(date)).toBe('2026-01-15');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 1); // Jan 1
    expect(formatISODate(date)).toBe('2026-01-01');
  });

  it('handles December correctly', () => {
    const date = new Date(2026, 11, 31); // Dec 31
    expect(formatISODate(date)).toBe('2026-12-31');
  });

  it('uses local date components, not UTC', () => {
    // Create a date at local midnight — if formatISODate used toISOString(),
    // it would shift back a day in UTC+ timezones
    const date = new Date(2026, 2, 1, 0, 0, 0); // March 1 at midnight local
    expect(formatISODate(date)).toBe('2026-03-01');
  });

  it('handles leap year dates', () => {
    const date = new Date(2024, 1, 29); // Feb 29 2024
    expect(formatISODate(date)).toBe('2024-02-29');
  });

  it('handles year boundaries', () => {
    const date = new Date(2025, 11, 31); // Dec 31 2025
    expect(formatISODate(date)).toBe('2025-12-31');

    const newYear = new Date(2026, 0, 1); // Jan 1 2026
    expect(formatISODate(newYear)).toBe('2026-01-01');
  });
});

// =============================================================================
// getMonthsBetween — Generate YYYY-MM ranges
// =============================================================================

describe('getMonthsBetween', () => {
  it('returns a single month for same-month range', () => {
    expect(getMonthsBetween('2026-03-01', '2026-03-31')).toEqual(['2026-03']);
  });

  it('returns multiple months for a range', () => {
    expect(getMonthsBetween('2026-01-01', '2026-03-31')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('handles year boundaries', () => {
    expect(getMonthsBetween('2025-11-01', '2026-02-28')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('returns 12 months for a full calendar year', () => {
    const months = getMonthsBetween('2026-01-01', '2026-12-31');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });

  it('handles mid-month start dates', () => {
    // Should include the month even if start date is mid-month
    const months = getMonthsBetween('2026-01-15', '2026-03-15');
    expect(months).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('returns empty array when end is before start', () => {
    expect(getMonthsBetween('2026-03-01', '2026-01-31')).toEqual([]);
  });
});

// =============================================================================
// toMonthlyCents — Cadence to monthly conversion (used in budget charts)
// =============================================================================

describe('toMonthlyCents', () => {
  const cadences: CadenceType[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

  describe('weekly', () => {
    it('converts weekly to monthly (52 weeks / 12 months)', () => {
      // $100/week → $100 * 52 / 12 = $433.33 → rounded to $433
      expect(toMonthlyCents(10000, 'weekly')).toBe(Math.round((10000 * 52) / 12));
    });

    it('handles small amounts', () => {
      // $10/week → $10 * 52 / 12 = $43.33 → rounded to $43
      expect(toMonthlyCents(1000, 'weekly')).toBe(Math.round((1000 * 52) / 12));
    });

    it('handles $0', () => {
      expect(toMonthlyCents(0, 'weekly')).toBe(0);
    });
  });

  describe('fortnightly', () => {
    it('converts fortnightly to monthly (26 fortnights / 12 months)', () => {
      // $200/fortnight → $200 * 26 / 12 = $433.33 → rounded to $433
      expect(toMonthlyCents(20000, 'fortnightly')).toBe(Math.round((20000 * 26) / 12));
    });

    it('is roughly half of weekly for the same amount', () => {
      const weeklyMonthly = toMonthlyCents(10000, 'weekly');
      const fortnightlyMonthly = toMonthlyCents(10000, 'fortnightly');
      // Fortnightly should be roughly half of weekly
      expect(fortnightlyMonthly).toBe(Math.round(weeklyMonthly / 2));
    });
  });

  describe('monthly', () => {
    it('returns the same amount (identity)', () => {
      expect(toMonthlyCents(15000, 'monthly')).toBe(15000);
    });

    it('handles $0', () => {
      expect(toMonthlyCents(0, 'monthly')).toBe(0);
    });
  });

  describe('quarterly', () => {
    it('divides by 3', () => {
      // $300/quarter → $100/month
      expect(toMonthlyCents(30000, 'quarterly')).toBe(10000);
    });

    it('rounds when not evenly divisible', () => {
      // $100/quarter → $33.33/month → rounded to $33
      expect(toMonthlyCents(10000, 'quarterly')).toBe(Math.round(10000 / 3));
    });

    it('spreads evenly across all months (not lump-sum in quarter start)', () => {
      // This is the key behavior we fixed:
      // The insights chart should show the same budget every month,
      // not a spike in Jan/Apr/Jul/Oct with $0 in other months
      const monthlyAmount = toMonthlyCents(30000, 'quarterly');
      expect(monthlyAmount).toBe(10000); // $100/month, not $300 in one month
    });
  });

  describe('yearly', () => {
    it('divides by 12', () => {
      // $1200/year → $100/month
      expect(toMonthlyCents(120000, 'yearly')).toBe(10000);
    });

    it('rounds when not evenly divisible', () => {
      // $100/year → $8.33/month → rounded to $8
      expect(toMonthlyCents(10000, 'yearly')).toBe(Math.round(10000 / 12));
    });

    it('spreads evenly across all months (not lump-sum in January)', () => {
      // Same fix as quarterly — should be even monthly amount
      const monthlyAmount = toMonthlyCents(120000, 'yearly');
      expect(monthlyAmount).toBe(10000); // $100/month, not $1200 in January
    });
  });

  describe('consistency across cadences', () => {
    it('produces consistent totals across equivalent cadences', () => {
      // $100/week ≈ $200/fortnight ≈ $433/month ≈ $1300/quarter ≈ $5200/year
      // All should produce roughly the same monthly amount
      const weeklyMonthly = toMonthlyCents(10000, 'weekly'); // $100/wk
      const fortnightlyMonthly = toMonthlyCents(20000, 'fortnightly'); // $200/fn
      const monthlyMonthly = toMonthlyCents(43333, 'monthly'); // $433.33/mo
      const quarterlyMonthly = toMonthlyCents(130000, 'quarterly'); // $1300/qtr
      const yearlyMonthly = toMonthlyCents(520000, 'yearly'); // $5200/yr

      // All should be close to $433/month (within rounding)
      expect(weeklyMonthly).toBe(43333);
      expect(fortnightlyMonthly).toBe(43333);
      expect(monthlyMonthly).toBe(43333);
      expect(quarterlyMonthly).toBe(43333);
      expect(yearlyMonthly).toBe(43333);
    });
  });
});

// =============================================================================
// fromMonthlyCents — Inverse of toMonthlyCents
// =============================================================================

describe('fromMonthlyCents', () => {
  it('converts monthly to weekly', () => {
    expect(fromMonthlyCents(10000, 'weekly')).toBe(Math.round((10000 * 12) / 52));
  });

  it('converts monthly to fortnightly', () => {
    expect(fromMonthlyCents(10000, 'fortnightly')).toBe(Math.round((10000 * 12) / 26));
  });

  it('returns identity for monthly', () => {
    expect(fromMonthlyCents(10000, 'monthly')).toBe(10000);
  });

  it('converts monthly to quarterly', () => {
    expect(fromMonthlyCents(10000, 'quarterly')).toBe(30000);
  });

  it('converts monthly to yearly', () => {
    expect(fromMonthlyCents(10000, 'yearly')).toBe(120000);
  });

  it('round-trips with toMonthlyCents for monthly cadence', () => {
    const original = 15000;
    const monthly = toMonthlyCents(original, 'monthly');
    const roundTrip = fromMonthlyCents(monthly, 'monthly');
    expect(roundTrip).toBe(original);
  });

  it('round-trips approximately for quarterly', () => {
    const original = 30000; // $300/quarter
    const monthly = toMonthlyCents(original, 'quarterly'); // $100/month
    const roundTrip = fromMonthlyCents(monthly, 'quarterly'); // $300/quarter
    expect(roundTrip).toBe(original);
  });

  it('round-trips approximately for yearly', () => {
    const original = 120000; // $1200/year
    const monthly = toMonthlyCents(original, 'yearly'); // $100/month
    const roundTrip = fromMonthlyCents(monthly, 'yearly'); // $1200/year
    expect(roundTrip).toBe(original);
  });
});

// =============================================================================
// Local date formatting patterns (used in charts for "now" marker)
// =============================================================================

describe('local date patterns', () => {
  describe('local YYYY-MM for current month', () => {
    it('produces correct format', () => {
      const d = new Date(2026, 1, 4); // Feb 4 2026
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expect(currentMonth).toBe('2026-02');
    });

    it('pads single-digit months', () => {
      const d = new Date(2026, 0, 15); // Jan 15
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expect(currentMonth).toBe('2026-01');
    });

    it('handles December', () => {
      const d = new Date(2026, 11, 25); // Dec 25
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expect(currentMonth).toBe('2026-12');
    });
  });

  describe('local YYYY-MM-DD for today comparison', () => {
    it('produces correct format', () => {
      const d = new Date(2026, 1, 4); // Feb 4 2026
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(today).toBe('2026-02-04');
    });

    it('pads single-digit days', () => {
      const d = new Date(2026, 0, 1); // Jan 1
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(today).toBe('2026-01-01');
    });

    it('matches formatISODate output', () => {
      const d = new Date(2026, 5, 15); // June 15
      const manual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(manual).toBe(formatISODate(d));
    });
  });
});

// =============================================================================
// Chart data pipeline calculations
// =============================================================================

describe('chart calculation pipelines', () => {
  describe('net flow calculation', () => {
    it('income - expenses - savings = net', () => {
      const income = 500000; // $5000
      const expenses = 300000; // $3000
      const savings = 100000; // $1000
      const net = income - expenses - savings;
      expect(net).toBe(100000); // $1000 surplus
    });

    it('negative net = shortfall', () => {
      const income = 300000; // $3000
      const expenses = 350000; // $3500
      const savings = 50000; // $500
      const net = income - expenses - savings;
      expect(net).toBe(-100000); // -$1000 shortfall
    });
  });

  describe('cumulative savings with starting balance', () => {
    it('adds starting balance to cumulative actual', () => {
      const startingBalance = 50000; // $500 starting
      const cumulativeActual = 30000; // $300 deposited
      const total = startingBalance + cumulativeActual;
      expect(total).toBe(80000); // $800 total
    });

    it('projected total includes forecast', () => {
      const startingBalance = 50000;
      const cumulativeActual = 30000;
      const cumulativeForecast = 20000; // $200 planned
      const total = startingBalance + cumulativeActual + cumulativeForecast;
      expect(total).toBe(100000); // $1000 projected
    });
  });

  describe('budget variance', () => {
    it('positive variance = under budget', () => {
      const budgeted = 50000; // $500 budget
      const actual = 40000; // $400 spent
      const variance = budgeted - actual;
      expect(variance).toBe(10000); // $100 under budget
      expect(variance).toBeGreaterThan(0);
    });

    it('negative variance = over budget', () => {
      const budgeted = 50000;
      const actual = 60000;
      const variance = budgeted - actual;
      expect(variance).toBe(-10000); // $100 over budget
      expect(variance).toBeLessThan(0);
    });

    it('zero variance = exactly on budget', () => {
      const budgeted = 50000;
      const actual = 50000;
      const variance = budgeted - actual;
      expect(variance).toBe(0);
    });
  });

  describe('budget per month consistency', () => {
    it('quarterly budget spread evenly matches annual total', () => {
      const quarterlyAmount = 30000; // $300/quarter
      const monthlyEquivalent = toMonthlyCents(quarterlyAmount, 'quarterly');
      // 12 months of the monthly equivalent should roughly equal 4 quarters
      const annualFromMonthly = monthlyEquivalent * 12;
      const annualFromQuarterly = quarterlyAmount * 4;
      // Should be within $1 of each other (rounding)
      expect(Math.abs(annualFromMonthly - annualFromQuarterly)).toBeLessThanOrEqual(100);
    });

    it('yearly budget spread evenly matches annual total', () => {
      const yearlyAmount = 120000; // $1200/year
      const monthlyEquivalent = toMonthlyCents(yearlyAmount, 'yearly');
      const annualFromMonthly = monthlyEquivalent * 12;
      // Should be within $1
      expect(Math.abs(annualFromMonthly - yearlyAmount)).toBeLessThanOrEqual(100);
    });

    it('weekly budget spread evenly matches annual total', () => {
      const weeklyAmount = 10000; // $100/week
      const monthlyEquivalent = toMonthlyCents(weeklyAmount, 'weekly');
      const annualFromMonthly = monthlyEquivalent * 12;
      const annualFromWeekly = weeklyAmount * 52;
      // Should be within $1
      expect(Math.abs(annualFromMonthly - annualFromWeekly)).toBeLessThanOrEqual(100);
    });

    it('fortnightly budget spread evenly matches annual total', () => {
      const fortnightlyAmount = 20000; // $200/fortnight
      const monthlyEquivalent = toMonthlyCents(fortnightlyAmount, 'fortnightly');
      const annualFromMonthly = monthlyEquivalent * 12;
      const annualFromFortnightly = fortnightlyAmount * 26;
      // Should be within $1
      expect(Math.abs(annualFromMonthly - annualFromFortnightly)).toBeLessThanOrEqual(100);
    });
  });

  describe('date string comparisons (used for past/future detection)', () => {
    it('ISO date strings sort correctly', () => {
      expect('2026-01-15' < '2026-02-01').toBe(true);
      expect('2025-12-31' < '2026-01-01').toBe(true);
      expect('2026-03-01' > '2026-02-28').toBe(true);
    });

    it('YYYY-MM month strings sort correctly', () => {
      expect('2026-01' < '2026-02').toBe(true);
      expect('2025-12' < '2026-01').toBe(true);
      expect('2026-12' > '2026-11').toBe(true);
    });

    it('same date comparison works for past/current detection', () => {
      const today = '2026-02-04';
      const monthEnd = '2026-02-28';
      const isPast = monthEnd < today;
      expect(isPast).toBe(false); // Feb 28 is after Feb 4

      const lastMonthEnd = '2026-01-31';
      const lastMonthIsPast = lastMonthEnd < today;
      expect(lastMonthIsPast).toBe(true); // Jan 31 is before Feb 4
    });
  });
});
