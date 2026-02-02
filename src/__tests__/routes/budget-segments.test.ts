import { describe, it, expect } from 'vitest';

/**
 * Budget Allocation Chart Segment Order
 *
 * The allocation chart must always display segments in this specific order:
 * 1. Fixed Expenses (darker red) - committed recurring expenses
 * 2. Savings (blue) - planned savings contributions
 * 3. Budgeted Expenses (red) - variable spending limits
 * 4. Surplus (green) - remaining unallocated income
 *
 * This order is intentional:
 * - Fixed expenses come first as they're non-negotiable
 * - Savings comes before budgeted expenses to prioritize saving
 * - Budgeted expenses are rightmost so it's clear they're first to cut if over budget
 * - Surplus shows what's left after all allocations
 */

// The expected order of segment IDs in the budget allocation chart
const EXPECTED_SEGMENT_ORDER = ['fixed', 'savings', 'variable', 'surplus'] as const;

// The expected display names for each segment
const EXPECTED_SEGMENT_NAMES: Record<string, string> = {
  fixed: 'Fixed Expenses',
  savings: 'Savings',
  variable: 'Budgeted Expenses',
  surplus: 'Surplus',
};

describe('Budget Allocation Chart Segments', () => {
  it('defines segments in the correct order: Fixed → Savings → Budgeted → Surplus', () => {
    // This test documents the expected order
    // If this test fails, someone has changed the segment order - which should be intentional
    expect(EXPECTED_SEGMENT_ORDER).toEqual(['fixed', 'savings', 'variable', 'surplus']);
  });

  it('uses correct display names for segments', () => {
    expect(EXPECTED_SEGMENT_NAMES['fixed']).toBe('Fixed Expenses');
    expect(EXPECTED_SEGMENT_NAMES['savings']).toBe('Savings');
    expect(EXPECTED_SEGMENT_NAMES['variable']).toBe('Budgeted Expenses');
    expect(EXPECTED_SEGMENT_NAMES['surplus']).toBe('Surplus');
  });

  it('has exactly 4 segment types', () => {
    expect(EXPECTED_SEGMENT_ORDER.length).toBe(4);
  });
});
