import { describe, it, expect } from 'vitest';

// =============================================================================
// Pure Logic Tests for Anchor Functions
// These test the algorithms without needing Dexie/IndexedDB
// =============================================================================

interface TestAnchor {
  id: string;
  date: string;
  balanceCents: number;
}

interface TestSavingsAnchor extends TestAnchor {
  savingsGoalId: string;
}

/**
 * Get the active anchor for a given date (latest anchor on or before that date)
 * This mirrors the logic in use-balance-anchors.ts
 */
function getActiveAnchor(sortedAnchors: TestAnchor[], asOfDate: string): TestAnchor | null {
  for (const anchor of sortedAnchors) {
    if (anchor.date <= asOfDate) {
      return anchor;
    }
  }
  return null;
}

/**
 * Get the active savings anchor for a given goal and date
 * This mirrors the logic in use-savings-anchors.ts
 */
function getActiveSavingsAnchor(
  sortedAnchors: TestSavingsAnchor[],
  goalId: string,
  asOfDate: string,
): TestSavingsAnchor | null {
  const goalAnchors = sortedAnchors.filter((a) => a.savingsGoalId === goalId);
  for (const anchor of goalAnchors) {
    if (anchor.date <= asOfDate) {
      return anchor;
    }
  }
  return null;
}

/**
 * Sort anchors by date descending (most recent first)
 */
function sortAnchors<T extends TestAnchor>(anchors: T[]): T[] {
  return [...anchors].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Sort savings anchors by goal ID then date descending
 */
function sortSavingsAnchors(anchors: TestSavingsAnchor[]): TestSavingsAnchor[] {
  return [...anchors].sort((a, b) => {
    const goalCompare = a.savingsGoalId.localeCompare(b.savingsGoalId);
    if (goalCompare !== 0) return goalCompare;
    return b.date.localeCompare(a.date);
  });
}

// =============================================================================
// Balance Anchor Tests
// =============================================================================

describe('balance anchor logic', () => {
  describe('getActiveAnchor', () => {
    const anchors: TestAnchor[] = sortAnchors([
      { id: '1', date: '2025-01-01', balanceCents: 100000 },
      { id: '2', date: '2025-06-01', balanceCents: 150000 },
      { id: '3', date: '2025-12-01', balanceCents: 200000 },
    ]);

    it('returns the most recent anchor on or before the given date', () => {
      const result = getActiveAnchor(anchors, '2025-08-15');
      expect(result?.id).toBe('2');
      expect(result?.balanceCents).toBe(150000);
    });

    it('returns exact match when date matches anchor', () => {
      const result = getActiveAnchor(anchors, '2025-06-01');
      expect(result?.id).toBe('2');
    });

    it('returns the latest anchor when date is after all anchors', () => {
      const result = getActiveAnchor(anchors, '2026-01-01');
      expect(result?.id).toBe('3');
    });

    it('returns the earliest anchor when date is on first anchor', () => {
      const result = getActiveAnchor(anchors, '2025-01-01');
      expect(result?.id).toBe('1');
    });

    it('returns null when date is before all anchors', () => {
      const result = getActiveAnchor(anchors, '2024-12-31');
      expect(result).toBeNull();
    });

    it('returns null for empty anchor list', () => {
      const result = getActiveAnchor([], '2025-06-01');
      expect(result).toBeNull();
    });

    it('handles single anchor correctly', () => {
      const singleAnchor = [{ id: '1', date: '2025-01-01', balanceCents: 100000 }];

      expect(getActiveAnchor(singleAnchor, '2024-12-31')).toBeNull();
      expect(getActiveAnchor(singleAnchor, '2025-01-01')?.id).toBe('1');
      expect(getActiveAnchor(singleAnchor, '2025-12-31')?.id).toBe('1');
    });
  });

  describe('sortAnchors', () => {
    it('sorts anchors by date descending (most recent first)', () => {
      const unsorted: TestAnchor[] = [
        { id: '1', date: '2025-01-01', balanceCents: 100000 },
        { id: '3', date: '2025-12-01', balanceCents: 200000 },
        { id: '2', date: '2025-06-01', balanceCents: 150000 },
      ];
      const sorted = sortAnchors(unsorted);

      expect(sorted[0]?.id).toBe('3');
      expect(sorted[1]?.id).toBe('2');
      expect(sorted[2]?.id).toBe('1');
    });

    it('does not mutate original array', () => {
      const original: TestAnchor[] = [
        { id: '1', date: '2025-01-01', balanceCents: 100000 },
        { id: '2', date: '2025-12-01', balanceCents: 200000 },
      ];
      sortAnchors(original);

      expect(original[0]?.id).toBe('1');
    });
  });
});

// =============================================================================
// Savings Anchor Tests
// =============================================================================

describe('savings anchor logic', () => {
  const anchors: TestSavingsAnchor[] = sortSavingsAnchors([
    { id: '1', savingsGoalId: 'goal-a', date: '2025-01-01', balanceCents: 50000 },
    { id: '2', savingsGoalId: 'goal-a', date: '2025-06-01', balanceCents: 75000 },
    { id: '3', savingsGoalId: 'goal-b', date: '2025-03-01', balanceCents: 100000 },
    { id: '4', savingsGoalId: 'goal-b', date: '2025-09-01', balanceCents: 120000 },
  ]);

  describe('getActiveSavingsAnchor', () => {
    it('returns the most recent anchor for specific goal on or before date', () => {
      const result = getActiveSavingsAnchor(anchors, 'goal-a', '2025-08-15');
      expect(result?.id).toBe('2');
      expect(result?.balanceCents).toBe(75000);
    });

    it('does not return anchors from other goals', () => {
      // goal-b has an anchor on 2025-09-01, but we're asking for goal-a
      const result = getActiveSavingsAnchor(anchors, 'goal-a', '2025-10-01');
      expect(result?.id).toBe('2'); // goal-a's latest, not goal-b's
    });

    it('returns null when goal has no anchors before date', () => {
      const result = getActiveSavingsAnchor(anchors, 'goal-a', '2024-12-31');
      expect(result).toBeNull();
    });

    it('returns null for non-existent goal', () => {
      const result = getActiveSavingsAnchor(anchors, 'goal-x', '2025-12-01');
      expect(result).toBeNull();
    });

    it('handles exact date match', () => {
      const result = getActiveSavingsAnchor(anchors, 'goal-b', '2025-03-01');
      expect(result?.id).toBe('3');
    });
  });

  describe('sortSavingsAnchors', () => {
    it('sorts by goal ID first, then by date descending', () => {
      const unsorted: TestSavingsAnchor[] = [
        { id: '3', savingsGoalId: 'goal-b', date: '2025-03-01', balanceCents: 100000 },
        { id: '1', savingsGoalId: 'goal-a', date: '2025-01-01', balanceCents: 50000 },
        { id: '4', savingsGoalId: 'goal-b', date: '2025-09-01', balanceCents: 120000 },
        { id: '2', savingsGoalId: 'goal-a', date: '2025-06-01', balanceCents: 75000 },
      ];
      const sorted = sortSavingsAnchors(unsorted);

      // goal-a first, most recent date first within goal
      expect(sorted[0]?.id).toBe('2'); // goal-a, 2025-06-01
      expect(sorted[1]?.id).toBe('1'); // goal-a, 2025-01-01
      // goal-b next, most recent date first within goal
      expect(sorted[2]?.id).toBe('4'); // goal-b, 2025-09-01
      expect(sorted[3]?.id).toBe('3'); // goal-b, 2025-03-01
    });
  });
});

// =============================================================================
// Balance Calculation Tests
// =============================================================================

describe('balance calculation with anchors', () => {
  interface TestTransaction {
    date: string;
    type: 'income' | 'expense' | 'savings' | 'adjustment';
    amountCents: number;
  }

  /**
   * Calculate balance from anchor + transactions after anchor date
   * This mirrors the logic in use-reports-data.ts
   */
  function calculateBalance(anchor: TestAnchor, transactions: TestTransaction[]): number {
    let balance = anchor.balanceCents;

    for (const t of transactions) {
      // Only count transactions AFTER the anchor date
      if (t.date > anchor.date) {
        if (t.type === 'income' || t.type === 'adjustment') {
          balance += t.amountCents;
        } else {
          balance -= t.amountCents;
        }
      }
    }

    return balance;
  }

  it('returns anchor balance when no transactions after anchor', () => {
    const anchor = { id: '1', date: '2025-01-01', balanceCents: 100000 };
    const transactions: TestTransaction[] = [
      { date: '2024-12-15', type: 'income', amountCents: 50000 },
    ];

    expect(calculateBalance(anchor, transactions)).toBe(100000);
  });

  it('adds income after anchor date', () => {
    const anchor = { id: '1', date: '2025-01-01', balanceCents: 100000 };
    const transactions: TestTransaction[] = [
      { date: '2025-01-15', type: 'income', amountCents: 50000 },
    ];

    expect(calculateBalance(anchor, transactions)).toBe(150000);
  });

  it('subtracts expenses after anchor date', () => {
    const anchor = { id: '1', date: '2025-01-01', balanceCents: 100000 };
    const transactions: TestTransaction[] = [
      { date: '2025-01-15', type: 'expense', amountCents: 30000 },
    ];

    expect(calculateBalance(anchor, transactions)).toBe(70000);
  });

  it('does not count transactions ON the anchor date', () => {
    const anchor = { id: '1', date: '2025-01-01', balanceCents: 100000 };
    const transactions: TestTransaction[] = [
      { date: '2025-01-01', type: 'income', amountCents: 50000 }, // Same day - excluded
      { date: '2025-01-02', type: 'income', amountCents: 25000 }, // After - included
    ];

    expect(calculateBalance(anchor, transactions)).toBe(125000);
  });

  it('handles multiple transaction types correctly', () => {
    const anchor = { id: '1', date: '2025-01-01', balanceCents: 100000 };
    const transactions: TestTransaction[] = [
      { date: '2025-01-10', type: 'income', amountCents: 50000 },
      { date: '2025-01-15', type: 'expense', amountCents: 20000 },
      { date: '2025-01-20', type: 'savings', amountCents: 10000 },
      { date: '2025-01-25', type: 'adjustment', amountCents: 5000 },
    ];

    // 100000 + 50000 - 20000 - 10000 + 5000 = 125000
    expect(calculateBalance(anchor, transactions)).toBe(125000);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('anchor edge cases', () => {
  describe('date string comparison', () => {
    it('correctly compares ISO date strings', () => {
      expect('2025-01-01' < '2025-01-02').toBe(true);
      expect('2025-01-31' < '2025-02-01').toBe(true);
      expect('2024-12-31' < '2025-01-01').toBe(true);
      expect('2025-01-01' <= '2025-01-01').toBe(true);
    });
  });

  describe('boundary dates', () => {
    const anchors = sortAnchors([{ id: '1', date: '2025-01-01', balanceCents: 100000 }]);

    it('handles first day of year', () => {
      expect(getActiveAnchor(anchors, '2025-01-01')?.id).toBe('1');
    });

    it('handles last day of year', () => {
      expect(getActiveAnchor(anchors, '2025-12-31')?.id).toBe('1');
    });

    it('handles leap year date', () => {
      expect(getActiveAnchor(anchors, '2024-02-29')).toBeNull(); // Before anchor
    });
  });
});
