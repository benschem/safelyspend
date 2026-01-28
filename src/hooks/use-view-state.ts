import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { ViewState, TimelineMode, ZoomLevel } from '@/lib/types';
import { calculateTimelineDateRange } from '@/lib/utils';

const STORAGE_KEY = 'budget:viewState';

const DEFAULT_STATE: ViewState = {
  mode: 'around-present',
  zoomLevel: 'quarters',
};

/**
 * Hook for managing the current view state (timeline picker state)
 * Computes actual date range based on mode and zoom level
 */
export function useViewState() {
  const [viewState, setViewState] = useLocalStorage<ViewState>(STORAGE_KEY, DEFAULT_STATE);

  // Compute the actual date range from the state
  const dateRange = useMemo(() => {
    return calculateTimelineDateRange(
      viewState.mode,
      viewState.zoomLevel,
      viewState.customStartDate,
      viewState.customEndDate,
    );
  }, [viewState.mode, viewState.zoomLevel, viewState.customStartDate, viewState.customEndDate]);

  const setMode = useCallback(
    (mode: TimelineMode) => {
      setViewState((prev) => ({ ...prev, mode }));
    },
    [setViewState],
  );

  const setZoomLevel = useCallback(
    (zoomLevel: ZoomLevel) => {
      setViewState((prev) => ({ ...prev, zoomLevel }));
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
    zoomLevel: viewState.zoomLevel,
    customStartDate: viewState.customStartDate,
    customEndDate: viewState.customEndDate,

    // Computed date range
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,

    // Actions
    setMode,
    setZoomLevel,
    setCustomDateRange,
    setViewState,
    resetToDefault,
  };
}
