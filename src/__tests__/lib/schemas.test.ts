import { describe, it, expect } from 'vitest';
import {
  parseCents,
  moneyInputSchema,
  optionalMoneyInputSchema,
  MAX_AMOUNT_DOLLARS,
  MAX_AMOUNT_CENTS,
} from '@/lib/schemas';

// =============================================================================
// parseCents Tests
// =============================================================================

describe('parseCents', () => {
  it('parses whole dollar amounts', () => {
    expect(parseCents('1')).toBe(100);
    expect(parseCents('10')).toBe(1000);
    expect(parseCents('100')).toBe(10000);
  });

  it('parses decimal amounts', () => {
    expect(parseCents('1.50')).toBe(150);
    expect(parseCents('1.99')).toBe(199);
    expect(parseCents('0.01')).toBe(1);
  });

  it('rounds amounts with more than 2 decimal places', () => {
    expect(parseCents('1.234')).toBe(123);
    expect(parseCents('1.235')).toBe(124); // rounds up
    expect(parseCents('1.999')).toBe(200);
  });

  it('returns 0 for invalid input', () => {
    expect(parseCents('')).toBe(0);
    expect(parseCents('abc')).toBe(0);
    expect(parseCents('NaN')).toBe(0);
    expect(parseCents('Infinity')).toBe(0);
  });

  it('returns 0 for negative amounts', () => {
    expect(parseCents('-10')).toBe(0);
    expect(parseCents('-1.50')).toBe(0);
  });

  it('throws for amounts exceeding maximum', () => {
    expect(() => parseCents('1000000000')).toThrow('Amount exceeds maximum');
    expect(() => parseCents('999999999.99')).toThrow('Amount exceeds maximum');
  });

  it('handles edge cases near maximum', () => {
    // Just under max should work
    expect(parseCents('999999998')).toBe(99999999800);
  });
});

// =============================================================================
// Money Input Schema Tests
// =============================================================================

describe('moneyInputSchema', () => {
  it('accepts valid positive amounts', () => {
    expect(moneyInputSchema.safeParse('1').success).toBe(true);
    expect(moneyInputSchema.safeParse('100').success).toBe(true);
    expect(moneyInputSchema.safeParse('1.50').success).toBe(true);
    expect(moneyInputSchema.safeParse('0.01').success).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(moneyInputSchema.safeParse('').success).toBe(false);
  });

  it('rejects zero', () => {
    expect(moneyInputSchema.safeParse('0').success).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(moneyInputSchema.safeParse('-10').success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(moneyInputSchema.safeParse('abc').success).toBe(false);
    expect(moneyInputSchema.safeParse('$100').success).toBe(false);
  });

  it('rejects amounts exceeding maximum', () => {
    expect(moneyInputSchema.safeParse('1000000000').success).toBe(false);
  });
});

describe('optionalMoneyInputSchema', () => {
  it('accepts empty strings', () => {
    expect(optionalMoneyInputSchema.safeParse('').success).toBe(true);
  });

  it('accepts zero', () => {
    expect(optionalMoneyInputSchema.safeParse('0').success).toBe(true);
  });

  it('accepts valid positive amounts', () => {
    expect(optionalMoneyInputSchema.safeParse('100').success).toBe(true);
    expect(optionalMoneyInputSchema.safeParse('1.50').success).toBe(true);
  });

  it('rejects negative amounts', () => {
    expect(optionalMoneyInputSchema.safeParse('-10').success).toBe(false);
  });

  it('rejects amounts exceeding maximum', () => {
    expect(optionalMoneyInputSchema.safeParse('1000000000').success).toBe(false);
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('money constants', () => {
  it('MAX_AMOUNT_DOLLARS is approximately $1 billion', () => {
    expect(MAX_AMOUNT_DOLLARS).toBe(999_999_999);
  });

  it('MAX_AMOUNT_CENTS equals MAX_AMOUNT_DOLLARS * 100', () => {
    expect(MAX_AMOUNT_CENTS).toBe(MAX_AMOUNT_DOLLARS * 100);
  });

  it('MAX_AMOUNT_CENTS is a safe integer', () => {
    expect(Number.isSafeInteger(MAX_AMOUNT_CENTS)).toBe(true);
  });
});
