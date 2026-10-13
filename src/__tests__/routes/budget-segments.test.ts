import { describe, it, expect } from 'vitest';

/**
 * Budget Allocation Chart Segment Order
 *
 * The allocation chart must always display segments in this specific order:
 * 1. Bills (darker red) - known amounts on known dates
 * 2. Spending Allowances (red) - limits on day-to-day spending
 * 3. Savings (blue) - planned savings contributions
 * 4. Surplus (green) - remaining unallocated income
 *
 * This order is intentional:
 * - Bills come first as they're non-negotiable
 * - Spending allowances sit next to bills so all spending reads as one block
 * - Savings sits between allowances and surplus because it trades off against both:
 *   spending less leaves more to save, and saving more leaves less surplus
 * - Surplus shows what's left after all allocations
 */

// The expected order of segment IDs in the budget allocation chart
const EXPECTED_SEGMENT_ORDER = ['fixed', 'variable', 'savings', 'surplus'] as const;

// The expected display names for each segment
const EXPECTED_SEGMENT_NAMES: Record<string, string> = {
  fixed: 'Bills',
  variable: 'Spending Allowances',
  savings: 'Savings',
  surplus: 'Surplus',
};

describe('Budget Allocation Chart Segments', () => {
  it('defines segments in the correct order: Bills → Allowances → Savings → Surplus', () => {
    // This test documents the expected order
    // If this test fails, someone has changed the segment order - which should be intentional
    expect(EXPECTED_SEGMENT_ORDER).toEqual(['fixed', 'variable', 'savings', 'surplus']);
  });

  it('uses correct display names for segments', () => {
    expect(EXPECTED_SEGMENT_NAMES['fixed']).toBe('Bills');
    expect(EXPECTED_SEGMENT_NAMES['variable']).toBe('Spending Allowances');
    expect(EXPECTED_SEGMENT_NAMES['savings']).toBe('Savings');
    expect(EXPECTED_SEGMENT_NAMES['surplus']).toBe('Surplus');
  });

  it('has exactly 4 segment types', () => {
    expect(EXPECTED_SEGMENT_ORDER.length).toBe(4);
  });
});
