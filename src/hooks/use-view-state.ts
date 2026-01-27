import { useLocalStorage } from './use-local-storage';
import type { ViewState } from '@/lib/types';
import { getCurrentFinancialYear } from '@/lib/utils';

const STORAGE_KEY = 'budget:viewState';

/**
 * Hook for managing the current view state (date range selection)
 * Defaults to current financial year (Australian: July 1 - June 30)
 */
export function useViewState() {
  const defaultState = getCurrentFinancialYear();

  const [viewState, setViewState] = useLocalStorage<ViewState>(STORAGE_KEY, defaultState);

  const setDateRange = (startDate: string, endDate: string) => {
    setViewState({ startDate, endDate });
  };

  const resetToFinancialYear = () => {
    setViewState(getCurrentFinancialYear());
  };

  return {
    viewState,
    startDate: viewState.startDate,
    endDate: viewState.endDate,
    setDateRange,
    setViewState,
    resetToFinancialYear,
  };
}
