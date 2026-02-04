import { describe, it, expect } from 'vitest';
import { getEffectiveRate } from '@/lib/interest-rate';
import type { SavingsGoal } from '@/lib/types';

// =============================================================================
// Helper to build a minimal SavingsGoal for testing
// =============================================================================

function makeGoal(
  overrides: Partial<SavingsGoal> = {},
): SavingsGoal {
  return {
    id: 'goal-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test Goal',
    targetAmountCents: 1000000,
    ...overrides,
  };
}

// =============================================================================
// getEffectiveRate Tests
// =============================================================================

describe('getEffectiveRate', () => {
  // ---------------------------------------------------------------------------
  // No schedule — falls back to annualInterestRate
  // ---------------------------------------------------------------------------

  describe('without schedule', () => {
    it('returns annualInterestRate when no schedule exists', () => {
      const goal = makeGoal({ annualInterestRate: 4.5 });
      expect(getEffectiveRate(goal, '2026-06-15')).toBe(4.5);
    });

    it('returns 0 when neither annualInterestRate nor schedule exists', () => {
      const goal = makeGoal();
      expect(getEffectiveRate(goal, '2026-06-15')).toBe(0);
    });

    it('returns 0 when annualInterestRate is undefined and schedule is empty', () => {
      const goal = makeGoal({ interestRateSchedule: [] });
      expect(getEffectiveRate(goal, '2026-06-15')).toBe(0);
    });

    it('returns annualInterestRate when schedule is empty', () => {
      const goal = makeGoal({ annualInterestRate: 3.0, interestRateSchedule: [] });
      expect(getEffectiveRate(goal, '2026-06-15')).toBe(3.0);
    });
  });

  // ---------------------------------------------------------------------------
  // With schedule — picks the correct entry based on date
  // ---------------------------------------------------------------------------

  describe('with schedule', () => {
    const goal = makeGoal({
      annualInterestRate: 4.0,
      interestRateSchedule: [
        { effectiveDate: '2026-03-01', annualRate: 4.5 },
        { effectiveDate: '2026-07-01', annualRate: 5.0 },
        { effectiveDate: '2026-12-01', annualRate: 3.5 },
      ],
    });

    it('returns base rate before any schedule entry takes effect', () => {
      expect(getEffectiveRate(goal, '2026-01-15')).toBe(4.0);
    });

    it('returns base rate the day before the first entry', () => {
      expect(getEffectiveRate(goal, '2026-02-28')).toBe(4.0);
    });

    it('returns first scheduled rate on its effective date', () => {
      expect(getEffectiveRate(goal, '2026-03-01')).toBe(4.5);
    });

    it('returns first scheduled rate between first and second entries', () => {
      expect(getEffectiveRate(goal, '2026-05-15')).toBe(4.5);
    });

    it('returns second scheduled rate on its effective date', () => {
      expect(getEffectiveRate(goal, '2026-07-01')).toBe(5.0);
    });

    it('returns second scheduled rate between second and third entries', () => {
      expect(getEffectiveRate(goal, '2026-10-15')).toBe(5.0);
    });

    it('returns third scheduled rate on its effective date', () => {
      expect(getEffectiveRate(goal, '2026-12-01')).toBe(3.5);
    });

    it('returns last scheduled rate well after the last entry', () => {
      expect(getEffectiveRate(goal, '2027-06-15')).toBe(3.5);
    });
  });

  // ---------------------------------------------------------------------------
  // Single schedule entry
  // ---------------------------------------------------------------------------

  describe('with single schedule entry', () => {
    const goal = makeGoal({
      annualInterestRate: 3.0,
      interestRateSchedule: [
        { effectiveDate: '2026-06-01', annualRate: 5.0 },
      ],
    });

    it('returns base rate before the entry', () => {
      expect(getEffectiveRate(goal, '2026-05-31')).toBe(3.0);
    });

    it('returns scheduled rate on and after the entry', () => {
      expect(getEffectiveRate(goal, '2026-06-01')).toBe(5.0);
      expect(getEffectiveRate(goal, '2026-12-31')).toBe(5.0);
    });
  });

  // ---------------------------------------------------------------------------
  // Schedule without base rate (annualInterestRate is undefined/0)
  // ---------------------------------------------------------------------------

  describe('schedule without base rate', () => {
    it('returns 0 before any entry when base rate is undefined', () => {
      const goal = makeGoal({
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 4.0 },
        ],
      });
      expect(getEffectiveRate(goal, '2026-01-01')).toBe(0);
    });

    it('returns scheduled rate after entry when base rate is undefined', () => {
      const goal = makeGoal({
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 4.0 },
        ],
      });
      expect(getEffectiveRate(goal, '2026-06-15')).toBe(4.0);
    });

    it('returns 0 before any entry when base rate is 0', () => {
      const goal = makeGoal({
        annualInterestRate: 0,
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 4.0 },
        ],
      });
      expect(getEffectiveRate(goal, '2026-03-01')).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles schedule with rate of 0 (rate drop to zero)', () => {
      const goal = makeGoal({
        annualInterestRate: 4.0,
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 0 },
        ],
      });
      expect(getEffectiveRate(goal, '2026-05-31')).toBe(4.0);
      expect(getEffectiveRate(goal, '2026-06-01')).toBe(0);
    });

    it('handles multiple entries on the same date (last one wins)', () => {
      const goal = makeGoal({
        annualInterestRate: 3.0,
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 4.0 },
          { effectiveDate: '2026-06-01', annualRate: 5.0 },
        ],
      });
      // Both entries are <= the date, so the loop processes both; last one wins
      expect(getEffectiveRate(goal, '2026-06-01')).toBe(5.0);
    });

    it('uses string comparison for dates (ISO format)', () => {
      const goal = makeGoal({
        annualInterestRate: 3.0,
        interestRateSchedule: [
          { effectiveDate: '2026-01-15', annualRate: 4.0 },
        ],
      });
      // '2026-01-14' < '2026-01-15' in string comparison
      expect(getEffectiveRate(goal, '2026-01-14')).toBe(3.0);
      expect(getEffectiveRate(goal, '2026-01-15')).toBe(4.0);
      expect(getEffectiveRate(goal, '2026-01-16')).toBe(4.0);
    });

    it('handles far-future date correctly', () => {
      const goal = makeGoal({
        annualInterestRate: 3.0,
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 5.0 },
        ],
      });
      expect(getEffectiveRate(goal, '2099-12-31')).toBe(5.0);
    });

    it('handles very early date before all entries', () => {
      const goal = makeGoal({
        annualInterestRate: 3.0,
        interestRateSchedule: [
          { effectiveDate: '2026-06-01', annualRate: 5.0 },
        ],
      });
      expect(getEffectiveRate(goal, '2020-01-01')).toBe(3.0);
    });
  });
});
