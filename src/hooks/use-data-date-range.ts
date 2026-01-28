import { useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Transaction, ForecastEvent, BalanceAnchor } from '@/lib/types';

/**
 * Hook that calculates the full date range of available data
 * Returns the earliest and latest dates across transactions, forecast events, and balance anchors
 */
export function useDataDateRange() {
  const [transactions] = useLocalStorage<Transaction[]>('budget:transactions', []);
  const [forecastEvents] = useLocalStorage<ForecastEvent[]>('budget:forecastEvents', []);
  const [balanceAnchors] = useLocalStorage<BalanceAnchor[]>('budget:balanceAnchors', []);

  const dataRange = useMemo((): { startDate: string; endDate: string } | null => {
    const allDates: string[] = [];

    // Collect all dates
    for (const t of transactions) {
      allDates.push(t.date);
    }
    for (const e of forecastEvents) {
      allDates.push(e.date);
    }
    for (const a of balanceAnchors) {
      allDates.push(a.date);
    }

    if (allDates.length === 0) {
      return null;
    }

    // Sort and get min/max
    allDates.sort();
    const first = allDates[0];
    const last = allDates[allDates.length - 1];

    // Type guard - we already checked length > 0
    if (!first || !last) {
      return null;
    }

    return {
      startDate: first,
      endDate: last,
    };
  }, [transactions, forecastEvents, balanceAnchors]);

  return dataRange;
}
