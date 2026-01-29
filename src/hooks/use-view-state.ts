import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { ViewState, TimelineMode, TimelineUnit } from '@/lib/types';
import { calculateTimelineDateRange, TIMELINE_UNIT_BOUNDS } from '@/lib/utils';

const STORAGE_KEY = 'budget:viewState';

const DEFAULT_STATE: ViewState = {
  mode: 'around-present',
  amount: 6,
  unit: 'months',
};

/**
 * Hook for managing the current view state (timeline picker state)
 * Computes actual date range based on mode, amount, and unit
 */
export function useViewState() {
  const [rawViewState, setViewState] = useLocalStorage<ViewState>(STORAGE_KEY, DEFAULT_STATE);

  // Ensure amount and unit have valid defaults (handles old stored state)
  const viewState = useMemo(() => ({
    ...rawViewState,
    amount: rawViewState.amount ?? DEFAULT_STATE.amount,
    unit: rawViewState.unit ?? DEFAULT_STATE.unit,
  }), [rawViewState]);

  // Compute the actual date range from the state
  const dateRange = useMemo(() => {
    return calculateTimelineDateRange(
      viewState.mode,
      viewState.amount,
      viewState.unit,
      viewState.customStartDate,
      viewState.customEndDate,
    );
  }, [viewState.mode, viewState.amount, viewState.unit, viewState.customStartDate, viewState.customEndDate]);

  const setMode = useCallback(
    (mode: TimelineMode) => {
      setViewState((prev) => ({ ...prev, mode }));
    },
    [setViewState],
  );

  const setAmount = useCallback(
    (amount: number) => {
      setViewState((prev) => ({ ...prev, amount }));
    },
    [setViewState],
  );

  const setUnit = useCallback(
    (unit: TimelineUnit) => {
      // When changing unit, clamp amount to valid bounds
      setViewState((prev) => {
        const bounds = TIMELINE_UNIT_BOUNDS[unit];
        const clampedAmount = Math.min(Math.max(prev.amount, bounds.min), bounds.max);
        return { ...prev, unit, amount: clampedAmount };
      });
    },
    [setViewState],
  );

  const setAmountAndUnit = useCallback(
    (amount: number, unit: TimelineUnit) => {
      setViewState((prev) => ({ ...prev, amount, unit }));
    },
    [setViewState],
  );

  const setCustomDateRange = useCallback(
    (customStartDate: string, customEndDate: string) => {
      setViewState((prev) => ({
        ...prev,
        mode: 'custom' as TimelineMode,
        customStartDate,
        customEndDate,
      }));
    },
    [setViewState],
  );

  const resetToDefault = useCallback(() => {
    setViewState(DEFAULT_STATE);
  }, [setViewState]);

  return {
    // State
    viewState,
    mode: viewState.mode,
    amount: viewState.amount,
    unit: viewState.unit,
    customStartDate: viewState.customStartDate,
    customEndDate: viewState.customEndDate,

    // Computed date range
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,

    // Actions
    setMode,
    setAmount,
    setUnit,
    setAmountAndUnit,
    setCustomDateRange,
    setViewState,
    resetToDefault,
  };
}
