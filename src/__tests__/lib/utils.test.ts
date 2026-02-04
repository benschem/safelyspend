import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatCents,
  formatCentsShort,
  dollarsToCents,
  centsToDollars,
  parseCentsFromInput,
  calculateCompoundInterest,
  calculateInterestEarned,
} from '@/lib/utils';

// =============================================================================
// Money Formatting Tests
// =============================================================================

describe('formatMoney / formatCents', () => {
  it('formats zero cents as $0', () => {
    expect(formatCents(0)).toBe('$0');
  });

  it('formats small amounts (< $1) rounded to nearest dollar', () => {
    expect(formatCents(1)).toBe('$0');
    expect(formatCents(50)).toBe('$1'); // 50 cents rounds up
    expect(formatCents(99)).toBe('$1'); // rounds to nearest dollar
  });

  it('formats whole dollar amounts', () => {
    expect(formatCents(100)).toBe('$1');
    expect(formatCents(1000)).toBe('$10');
    expect(formatCents(10000)).toBe('$100');
  });

  it('rounds to nearest dollar (no cents in display)', () => {
    expect(formatCents(149)).toBe('$1'); // $1.49 -> $1
    expect(formatCents(150)).toBe('$2'); // $1.50 -> $2
    expect(formatCents(199)).toBe('$2'); // $1.99 -> $2
  });

  it('formats large amounts with thousands separators', () => {
    expect(formatCents(100000)).toBe('$1,000');
    expect(formatCents(1000000)).toBe('$10,000');
    expect(formatCents(10000000)).toBe('$100,000');
    expect(formatCents(100000000)).toBe('$1,000,000');
  });

  it('handles negative amounts', () => {
    expect(formatCents(-100)).toBe('-$1');
    expect(formatCents(-1000)).toBe('-$10');
    expect(formatCents(-100000)).toBe('-$1,000');
  });

  it('handles very large amounts', () => {
    expect(formatCents(99999999900)).toBe('$999,999,999'); // ~$1 billion
  });

  it('formatMoney accepts different currencies', () => {
    // Note: Intl.NumberFormat output varies by locale/environment
    expect(formatMoney(10000, 'USD')).toMatch(/100/);
    expect(formatMoney(10000, 'EUR')).toMatch(/100/);
  });
});

describe('formatCentsShort', () => {
  it('formats amounts under $1k without suffix', () => {
    expect(formatCentsShort(0)).toBe('$0');
    expect(formatCentsShort(100)).toBe('$1');
    expect(formatCentsShort(50000)).toBe('$500');
    expect(formatCentsShort(99900)).toBe('$999');
  });

  it('formats amounts $1k-$10k with one decimal', () => {
    expect(formatCentsShort(100000)).toBe('$1.0k');
    expect(formatCentsShort(150000)).toBe('$1.5k');
    expect(formatCentsShort(990000)).toBe('$9.9k'); // $9,900
  });

  it('formats amounts $10k+ with no decimals', () => {
    expect(formatCentsShort(1000000)).toBe('$10k');
    expect(formatCentsShort(1500000)).toBe('$15k');
    expect(formatCentsShort(9990000)).toBe('$100k');
  });

  it('formats amounts $1M-$10M with one decimal', () => {
    expect(formatCentsShort(100000000)).toBe('$1.0M');
    expect(formatCentsShort(150000000)).toBe('$1.5M');
    expect(formatCentsShort(990000000)).toBe('$9.9M'); // $9,900,000
  });

  it('formats amounts $10M+ with no decimals', () => {
    expect(formatCentsShort(1000000000)).toBe('$10M');
    expect(formatCentsShort(1500000000)).toBe('$15M');
  });

  it('handles negative amounts', () => {
    expect(formatCentsShort(-100000)).toBe('-$1.0k');
    expect(formatCentsShort(-150000)).toBe('-$1.5k');
    expect(formatCentsShort(-100000000)).toBe('-$1.0M');
  });
});

// =============================================================================
// Dollar/Cents Conversion Tests
// =============================================================================

describe('dollarsToCents', () => {
  it('converts whole dollars', () => {
    expect(dollarsToCents(1)).toBe(100);
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(100)).toBe(10000);
  });

  it('converts decimal dollars and rounds correctly', () => {
    expect(dollarsToCents(1.5)).toBe(150);
    expect(dollarsToCents(1.99)).toBe(199);
    expect(dollarsToCents(1.995)).toBe(200); // rounds up
    expect(dollarsToCents(1.994)).toBe(199); // rounds down
  });

  it('handles zero', () => {
    expect(dollarsToCents(0)).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(dollarsToCents(-1)).toBe(-100);
    expect(dollarsToCents(-1.5)).toBe(-150);
  });
});

describe('centsToDollars', () => {
  it('converts whole cents', () => {
    expect(centsToDollars(100)).toBe(1);
    expect(centsToDollars(1000)).toBe(10);
    expect(centsToDollars(10000)).toBe(100);
  });

  it('converts cents with fractional dollars', () => {
    expect(centsToDollars(150)).toBe(1.5);
    expect(centsToDollars(199)).toBe(1.99);
    expect(centsToDollars(1)).toBe(0.01);
  });

  it('handles zero', () => {
    expect(centsToDollars(0)).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(centsToDollars(-100)).toBe(-1);
    expect(centsToDollars(-150)).toBe(-1.5);
  });
});

// =============================================================================
// Input Parsing Tests
// =============================================================================

describe('parseCentsFromInput', () => {
  it('parses empty string as 0', () => {
    expect(parseCentsFromInput('')).toBe(0);
    expect(parseCentsFromInput('   ')).toBe(0);
  });

  it('parses invalid input as 0', () => {
    expect(parseCentsFromInput('abc')).toBe(0);
    expect(parseCentsFromInput('one hundred')).toBe(0);
  });

  it('ignores dollar signs, commas, and spaces', () => {
    expect(parseCentsFromInput('$100')).toBe(10000);
    expect(parseCentsFromInput('$1,000')).toBe(100000);
    expect(parseCentsFromInput('1 000')).toBe(100000);
    expect(parseCentsFromInput('$1,234.56')).toBe(123456);
    expect(parseCentsFromInput(' $ 50 ')).toBe(5000);
  });

  it('parses whole dollar amounts', () => {
    expect(parseCentsFromInput('1')).toBe(100);
    expect(parseCentsFromInput('10')).toBe(1000);
    expect(parseCentsFromInput('100')).toBe(10000);
  });

  it('parses decimal amounts', () => {
    expect(parseCentsFromInput('1.5')).toBe(150);
    expect(parseCentsFromInput('1.99')).toBe(199);
    expect(parseCentsFromInput('0.01')).toBe(1);
  });

  it('rounds amounts with more than 2 decimal places', () => {
    expect(parseCentsFromInput('1.234')).toBe(123);
    expect(parseCentsFromInput('1.235')).toBe(124); // rounds up
    expect(parseCentsFromInput('1.999')).toBe(200);
  });

  it('trims whitespace', () => {
    expect(parseCentsFromInput('  100  ')).toBe(10000);
    expect(parseCentsFromInput('\t50\n')).toBe(5000);
  });

  it('handles negative input', () => {
    expect(parseCentsFromInput('-10')).toBe(-1000);
    expect(parseCentsFromInput('-1.5')).toBe(-150);
  });

  it('handles scientific notation', () => {
    expect(parseCentsFromInput('1e2')).toBe(10000); // 100 dollars
  });
});

// =============================================================================
// Interest Calculation Tests
// =============================================================================

describe('calculateCompoundInterest', () => {
  it('returns principal when rate is 0', () => {
    expect(calculateCompoundInterest(10000, 0, 'yearly', 1)).toBe(10000);
  });

  it('returns principal when years is 0', () => {
    expect(calculateCompoundInterest(10000, 5, 'yearly', 0)).toBe(10000);
  });

  it('returns principal when rate is negative', () => {
    expect(calculateCompoundInterest(10000, -5, 'yearly', 1)).toBe(10000);
  });

  it('calculates yearly compounding correctly', () => {
    // $100 at 10% for 1 year = $110
    expect(calculateCompoundInterest(10000, 10, 'yearly', 1)).toBe(11000);
    // $100 at 10% for 2 years = $121
    expect(calculateCompoundInterest(10000, 10, 'yearly', 2)).toBe(12100);
  });

  it('calculates monthly compounding correctly', () => {
    // $10,000 at 12% compounded monthly for 1 year
    // A = P(1 + r/n)^(nt) = 10000 * (1 + 0.12/12)^12 = 10000 * 1.01^12 ≈ 11268
    const result = calculateCompoundInterest(1000000, 12, 'monthly', 1);
    expect(result).toBeGreaterThan(1126800);
    expect(result).toBeLessThan(1126900);
  });

  it('calculates daily compounding correctly', () => {
    // Daily compounding should yield slightly more than monthly
    const monthly = calculateCompoundInterest(1000000, 12, 'monthly', 1);
    const daily = calculateCompoundInterest(1000000, 12, 'daily', 1);
    expect(daily).toBeGreaterThan(monthly);
  });

  it('handles fractional years', () => {
    // Half a year should give partial interest
    const fullYear = calculateCompoundInterest(10000, 10, 'yearly', 1);
    const halfYear = calculateCompoundInterest(10000, 10, 'yearly', 0.5);
    expect(halfYear).toBeGreaterThan(10000);
    expect(halfYear).toBeLessThan(fullYear);
  });
});

describe('calculateInterestEarned', () => {
  it('returns 0 when rate is 0', () => {
    expect(calculateInterestEarned(10000, 0, 'yearly', 1)).toBe(0);
  });

  it('returns 0 when years is 0', () => {
    expect(calculateInterestEarned(10000, 5, 'yearly', 0)).toBe(0);
  });

  it('calculates interest earned correctly', () => {
    // $100 at 10% for 1 year earns $10
    expect(calculateInterestEarned(10000, 10, 'yearly', 1)).toBe(1000);
    // $100 at 10% for 2 years earns $21 (compound)
    expect(calculateInterestEarned(10000, 10, 'yearly', 2)).toBe(2100);
  });

  it('interest earned = final - principal', () => {
    const principal = 50000;
    const final = calculateCompoundInterest(principal, 5, 'monthly', 3);
    const interest = calculateInterestEarned(principal, 5, 'monthly', 3);
    expect(interest).toBe(final - principal);
  });
});
