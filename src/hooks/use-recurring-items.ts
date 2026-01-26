import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { RecurringItem, CreateEntity, Forecast } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:recurringItems';
const USER_ID = 'local';

/**
 * Calculate all occurrence dates for a recurring item within a date range
 */
function getOccurrencesInRange(item: RecurringItem, startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Helper to format date as YYYY-MM-DD
  const formatDate = (d: Date): string => d.toISOString().slice(0, 10);

  // Helper to get last day of month
  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  switch (item.frequency) {
    case 'weekly': {
      const targetDay = item.dayOfWeek ?? 0;
      const current = new Date(start);
      // Move to first occurrence of target day
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      while (current <= end) {
        if (current >= start) {
          dates.push(formatDate(current));
        }
        current.setDate(current.getDate() + 7);
      }
      break;
    }

    case 'fortnightly': {
      const targetDay = item.dayOfWeek ?? 0;
      const current = new Date(start);
      // Move to first occurrence of target day
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      while (current <= end) {
        if (current >= start) {
          dates.push(formatDate(current));
        }
        current.setDate(current.getDate() + 14);
      }
      break;
    }

    case 'monthly': {
      const targetDay = item.dayOfMonth ?? 1;
      let year = start.getFullYear();
      let month = start.getMonth();

      while (true) {
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          dates.push(formatDate(date));
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      break;
    }

    case 'quarterly': {
      const targetDay = item.dayOfMonth ?? 1;
      let year = start.getFullYear();
      let month = start.getMonth();
      // Align to quarter start (0, 3, 6, 9)
      month = Math.floor(month / 3) * 3;

      while (true) {
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          dates.push(formatDate(date));
        }

        month += 3;
        if (month > 11) {
          month = month - 12;
          year++;
        }
      }
      break;
    }

    case 'yearly': {
      const targetDay = item.dayOfMonth ?? 1;
      // For yearly, we use the month from when we'd expect it (assume January if not specified)
      let year = start.getFullYear();

      while (true) {
        // Yearly items occur on the same month/day each year
        // We'll use January by default, user can adjust the generated forecast
        const lastDay = getLastDayOfMonth(year, 0);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, 0, actualDay);

        if (date > end) break;
        if (date >= start) {
          dates.push(formatDate(date));
        }

        year++;
      }
      break;
    }
  }

  return dates;
}

export function useRecurringItems() {
  const [recurringItems, setRecurringItems] = useLocalStorage<RecurringItem[]>(STORAGE_KEY, []);

  const activeItems = useMemo(
    () => recurringItems.filter((item) => item.isActive),
    [recurringItems],
  );

  const addRecurringItem = useCallback(
    (data: CreateEntity<RecurringItem>) => {
      const timestamp = now();
      const newItem: RecurringItem = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setRecurringItems((prev) => [...prev, newItem]);
      return newItem;
    },
    [setRecurringItems],
  );

  const updateRecurringItem = useCallback(
    (id: string, updates: Partial<Omit<RecurringItem, 'id' | 'userId' | 'createdAt'>>) => {
      setRecurringItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: now() } : item)),
      );
    },
    [setRecurringItems],
  );

  const deleteRecurringItem = useCallback(
    (id: string) => {
      setRecurringItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setRecurringItems],
  );

  /**
   * Generate forecast entries for all active recurring items within a period
   * Returns forecast-shaped objects (without id/timestamps) ready to be created
   */
  const generateForecastsForPeriod = useCallback(
    (
      periodId: string,
      startDate: string,
      endDate: string,
    ): Array<
      Omit<Forecast, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { recurringItemId: string }
    > => {
      const forecasts: Array<
        Omit<Forecast, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { recurringItemId: string }
      > = [];

      for (const item of activeItems) {
        const occurrences = getOccurrencesInRange(item, startDate, endDate);

        for (const date of occurrences) {
          forecasts.push({
            periodId,
            type: item.type,
            date,
            amountCents: item.amountCents,
            description: item.name,
            categoryId: item.categoryId,
            ...(item.notes && { notes: item.notes }),
            recurringItemId: item.id,
          });
        }
      }

      // Sort by date
      forecasts.sort((a, b) => a.date.localeCompare(b.date));

      return forecasts;
    },
    [activeItems],
  );

  return {
    recurringItems,
    activeItems,
    addRecurringItem,
    updateRecurringItem,
    deleteRecurringItem,
    generateForecastsForPeriod,
  };
}
