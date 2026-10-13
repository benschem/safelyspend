import { describe, it, expect } from 'vitest';
import { cashBalanceOn, cashEffectCents, findActiveAnchor, savingsBalanceOn } from '@/lib/balances';
import type { BalanceAnchor, SavingsAnchor, Transaction, TransactionType } from '@/lib/types';

const CREATED = '2025-01-01T12:00:00.000Z';

function balanceAnchor(date: string, balanceCents: number): BalanceAnchor {
  return {
    id: `cash-${date}`,
    userId: 'local',
    createdAt: CREATED,
    updatedAt: CREATED,
    date,
    balanceCents,
  };
}

function savingsAnchor(savingsGoalId: string, date: string, balanceCents: number): SavingsAnchor {
  return {
    id: `${savingsGoalId}-${date}`,
    userId: 'local',
    createdAt: CREATED,
    updatedAt: CREATED,
    savingsGoalId,
    date,
    balanceCents,
  };
}

function transaction(
  type: TransactionType,
  date: string,
  amountCents: number,
  savingsGoalId: string | null = null,
): Transaction {
  return {
    id: `${type}-${date}-${amountCents}`,
    userId: 'local',
    createdAt: CREATED,
    updatedAt: CREATED,
    type,
    date,
    amountCents,
    description: type,
    categoryId: null,
    savingsGoalId,
  };
}

describe('findActiveAnchor', () => {
  const anchors = [
    balanceAnchor('2025-06-01', 150000),
    balanceAnchor('2025-12-01', 200000),
    balanceAnchor('2025-01-01', 100000),
  ];

  it('returns the latest anchor on or before the date, whatever order they are in', () => {
    expect(findActiveAnchor(anchors, '2025-08-15')?.balanceCents).toBe(150000);
  });

  it('counts an anchor dated on the day asked for', () => {
    expect(findActiveAnchor(anchors, '2025-06-01')?.balanceCents).toBe(150000);
  });

  it('returns the last anchor for a date after all of them', () => {
    expect(findActiveAnchor(anchors, '2026-01-01')?.balanceCents).toBe(200000);
  });

  it('returns null for a date before the first anchor', () => {
    expect(findActiveAnchor(anchors, '2024-12-31')).toBeNull();
  });

  it('returns null when there are no anchors', () => {
    expect(findActiveAnchor([], '2025-06-01')).toBeNull();
  });
});

describe('cashEffectCents', () => {
  it('adds income', () => {
    expect(cashEffectCents(transaction('income', '2025-01-10', 50000))).toBe(50000);
  });

  it('adds an adjustment, which can itself be negative', () => {
    expect(cashEffectCents(transaction('adjustment', '2025-01-10', 5000))).toBe(5000);
    expect(cashEffectCents(transaction('adjustment', '2025-01-10', -5000))).toBe(-5000);
  });

  it('subtracts an expense', () => {
    expect(cashEffectCents(transaction('expense', '2025-01-10', 20000))).toBe(-20000);
  });

  it('subtracts a transfer to savings, and adds back a withdrawal', () => {
    expect(cashEffectCents(transaction('savings', '2025-01-10', 10000, 'holiday'))).toBe(-10000);
    expect(cashEffectCents(transaction('savings', '2025-01-10', -10000, 'holiday'))).toBe(10000);
  });
});

describe('cashBalanceOn', () => {
  const anchors = [balanceAnchor('2025-01-01', 100000)];

  it('is the anchor balance when nothing has happened since', () => {
    expect(cashBalanceOn(anchors, [], '2025-03-01')).toBe(100000);
  });

  it('applies each transaction type', () => {
    const transactions = [
      transaction('income', '2025-01-10', 50000),
      transaction('expense', '2025-01-15', 20000),
      transaction('savings', '2025-01-20', 10000, 'holiday'),
      transaction('adjustment', '2025-01-25', 5000),
    ];

    // 100000 + 50000 - 20000 - 10000 + 5000
    expect(cashBalanceOn(anchors, transactions, '2025-01-31')).toBe(125000);
  });

  it('counts a transaction on the anchor date, because an anchor is the start of its day', () => {
    const transactions = [transaction('expense', '2025-01-01', 30000)];

    expect(cashBalanceOn(anchors, transactions, '2025-01-31')).toBe(70000);
  });

  it('leaves out a transaction before the anchor date', () => {
    const transactions = [transaction('income', '2024-12-31', 50000)];

    expect(cashBalanceOn(anchors, transactions, '2025-01-31')).toBe(100000);
  });

  it('counts a transaction on the date asked for and leaves out one after it', () => {
    const transactions = [
      transaction('income', '2025-01-31', 50000),
      transaction('income', '2025-02-01', 7000),
    ];

    expect(cashBalanceOn(anchors, transactions, '2025-01-31')).toBe(150000);
  });

  it('starts again from a later anchor', () => {
    const twoAnchors = [...anchors, balanceAnchor('2025-06-01', 40000)];
    const transactions = [
      transaction('income', '2025-03-01', 99999),
      transaction('expense', '2025-06-10', 1000),
    ];

    expect(cashBalanceOn(twoAnchors, transactions, '2025-06-30')).toBe(39000);
  });

  it('ignores an anchor after the date asked for', () => {
    const twoAnchors = [...anchors, balanceAnchor('2025-06-01', 40000)];

    expect(cashBalanceOn(twoAnchors, [], '2025-05-31')).toBe(100000);
  });

  it('is null before the first anchor', () => {
    expect(cashBalanceOn(anchors, [], '2024-12-31')).toBeNull();
  });

  it('is null with no anchors', () => {
    const transactions = [transaction('income', '2025-01-10', 50000)];

    expect(cashBalanceOn([], transactions, '2025-01-31')).toBeNull();
  });
});

describe('savingsBalanceOn', () => {
  const anchors = [savingsAnchor('holiday', '2025-01-01', 50000)];

  it('is the anchor balance when nothing has happened since', () => {
    expect(savingsBalanceOn(anchors, [], 'holiday', '2025-03-01')).toBe(50000);
  });

  it('adds a transfer in and subtracts a withdrawal', () => {
    const transactions = [
      transaction('savings', '2025-01-10', 20000, 'holiday'),
      transaction('savings', '2025-01-20', -5000, 'holiday'),
    ];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2025-01-31')).toBe(65000);
  });

  it('counts a transfer on the anchor date, because an anchor is the start of its day', () => {
    const transactions = [transaction('savings', '2025-01-01', 20000, 'holiday')];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2025-01-31')).toBe(70000);
  });

  it('leaves out a transfer before the anchor date', () => {
    const transactions = [transaction('savings', '2024-12-31', 20000, 'holiday')];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2025-01-31')).toBe(50000);
  });

  it('counts a transfer on the date asked for and leaves out one after it', () => {
    const transactions = [
      transaction('savings', '2025-01-31', 20000, 'holiday'),
      transaction('savings', '2025-02-01', 7000, 'holiday'),
    ];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2025-01-31')).toBe(70000);
  });

  it('starts again from a later anchor', () => {
    const twoAnchors = [...anchors, savingsAnchor('holiday', '2025-06-01', 10000)];
    const transactions = [
      transaction('savings', '2025-03-01', 99999, 'holiday'),
      transaction('savings', '2025-06-10', 1000, 'holiday'),
    ];

    expect(savingsBalanceOn(twoAnchors, transactions, 'holiday', '2025-06-30')).toBe(11000);
  });

  it('sums the transfers up to the date when the goal has no anchor', () => {
    const transactions = [
      transaction('savings', '2025-01-10', 20000, 'holiday'),
      transaction('savings', '2025-02-10', 20000, 'holiday'),
      transaction('savings', '2025-03-10', 20000, 'holiday'),
    ];

    expect(savingsBalanceOn([], transactions, 'holiday', '2025-02-28')).toBe(40000);
  });

  it('sums the transfers up to the date when the only anchor is after it', () => {
    const transactions = [transaction('savings', '2024-11-10', 20000, 'holiday')];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2024-12-31')).toBe(20000);
  });

  it("leaves out another goal's anchors and transfers", () => {
    const bothGoals = [...anchors, savingsAnchor('car', '2025-02-01', 900000)];
    const transactions = [
      transaction('savings', '2025-02-10', 20000, 'holiday'),
      transaction('savings', '2025-02-10', 300000, 'car'),
    ];

    expect(savingsBalanceOn(bothGoals, transactions, 'holiday', '2025-02-28')).toBe(70000);
  });

  it('leaves out transactions that are not savings', () => {
    const transactions = [
      transaction('income', '2025-01-10', 50000),
      transaction('expense', '2025-01-10', 20000),
      transaction('adjustment', '2025-01-10', 5000),
    ];

    expect(savingsBalanceOn(anchors, transactions, 'holiday', '2025-01-31')).toBe(50000);
  });

  it('is zero for a goal with no anchor and no transfers', () => {
    expect(savingsBalanceOn(anchors, [], 'car', '2025-01-31')).toBe(0);
  });
});
