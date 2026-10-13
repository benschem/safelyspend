import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { WhatIfProvider, useWhatIf } from '@/contexts/what-if-context';

// The test environment has no IndexedDB. The scenario has no saved rules, so
// every adjustment is measured against a baseline of zero.
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => [] }));

function wrapper({ children }: { children: ReactNode }) {
  return <WhatIfProvider activeScenarioId="scenario-1">{children}</WhatIfProvider>;
}

describe('clearAdjustment', () => {
  it('drops the adjustment held for one rule and leaves the others', () => {
    const { result } = renderHook(() => useWhatIf(), { wrapper });

    act(() => {
      result.current.setFixedExpenseAdjustment('bill-1', 7000);
      result.current.setBudgetAdjustment('allowance-1', 25000);
    });
    act(() => {
      result.current.clearAdjustment('bill-1');
    });

    expect(result.current.adjustments.fixedExpenseAdjustments).toEqual({});
    expect(result.current.adjustments.budgetAdjustments).toEqual({ 'allowance-1': 25000 });
    expect(result.current.isWhatIfMode).toBe(true);
  });

  it('switches What If mode off when it clears the only adjustment', () => {
    const { result } = renderHook(() => useWhatIf(), { wrapper });

    act(() => {
      result.current.setBudgetAdjustment('allowance-1', 25000);
    });
    expect(result.current.isWhatIfMode).toBe(true);

    act(() => {
      result.current.clearAdjustment('allowance-1');
    });

    expect(result.current.isWhatIfMode).toBe(false);
  });

  it('does nothing for a rule that has no adjustment', () => {
    const { result } = renderHook(() => useWhatIf(), { wrapper });

    act(() => {
      result.current.setIncomeAdjustment('income-1', 500000);
    });
    act(() => {
      result.current.clearAdjustment('not-adjusted');
    });

    expect(result.current.adjustments.incomeAdjustments).toEqual({ 'income-1': 500000 });
  });
});
