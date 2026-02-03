import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { ViewState, TimelineMode, TimelineUnit, PresetTimelineMode } from '@/lib/types';
import { calculateTimelineDateRange, TIMELINE_UNIT_BOUNDS } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/storage-keys';

const DEFAULT_PRESET_MODE: PresetTimelineMode = 'around-present';

const DEFAULT_STATE: ViewState = {
  mode: DEFAULT_PRESET_MODE,
  amount: 6,
  unit: 'months',
  lastPresetMode: DEFAULT_PRESET_MODE,
};

/**
 * Hook for managing the current view state (timeline picker state)
 * Computes actual date range based on mode, amount, and unit
 */
export function useViewState() {
  const [rawViewState, setViewState] = useLocalStorage<ViewState>(
    STORAGE_KEYS.VIEW_STATE,
    DEFAULT_STATE,
  );

  // Ensure amount and unit have valid defaults (handles old stored state)
  const viewState = useMemo(
    () => ({
      ...rawViewState,
      amount: rawViewState.amount ?? DEFAULT_STATE.amount,
      unit: rawViewState.unit ?? DEFAULT_STATE.unit,
    }),
    [rawViewState],
  );

  // Compute the actual date range from the state
  const dateRange = useMemo(() => {
    return calculateTimelineDateRange(
      viewState.mode,
      viewState.amount,
      viewState.unit,
      viewState.customStartDate,
      viewState.customEndDate,
    );
  }, [
    viewState.mode,
    viewState.amount,
    viewState.unit,
    viewState.customStartDate,
    viewState.customEndDate,
  ]);

  const setMode = useCallback(
    (mode: TimelineMode) => {
      setViewState((prev) => {
        // Track last preset mode for restoring from custom
        if (mode !== 'custom') {
          return { ...prev, mode, lastPresetMode: mode as PresetTimelineMode };
        }
        return { ...prev, mode };
      });
    },
    [setViewState],
  );

  const setAmount = useCallback(
    (amount: number) => {
      setViewState((prev) => {
        // If in custom mode, switch back to last preset mode
        if (prev.mode === 'custom') {
          const mode = prev.lastPresetMode ?? DEFAULT_PRESET_MODE;
          return { ...prev, amount, mode };
        }
        return { ...prev, amount };
      });
    },
    [setViewState],
  );

  const setUnit = useCallback(
    (unit: TimelineUnit) => {
      // When changing unit, clamp amount to valid bounds
      setViewState((prev) => {
        const bounds = TIMELINE_UNIT_BOUNDS[unit];
        const clampedAmount = Math.min(Math.max(prev.amount, bounds.min), bounds.max);
        // If in custom mode, switch back to last preset mode
        if (prev.mode === 'custom') {
          const mode = prev.lastPresetMode ?? DEFAULT_PRESET_MODE;
          return { ...prev, unit, amount: clampedAmount, mode };
        }
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
    lastPresetMode: viewState.lastPresetMode ?? DEFAULT_PRESET_MODE,
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
