import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Forecast, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:forecasts';
const USER_ID = 'local';

export function useForecasts(periodId: string | null) {
  const [allForecasts, setForecasts] = useLocalStorage<Forecast[]>(STORAGE_KEY, []);

  // Filter to current period
  const forecasts = useMemo(
    () => (periodId ? allForecasts.filter((f) => f.periodId === periodId) : []),
    [allForecasts, periodId],
  );

  const incomeForecasts = useMemo(() => forecasts.filter((f) => f.type === 'income'), [forecasts]);
  const expenseForecasts = useMemo(
    () => forecasts.filter((f) => f.type === 'expense'),
    [forecasts],
  );

  const addForecast = useCallback(
    (data: CreateEntity<Forecast>) => {
      const timestamp = now();
      const newForecast: Forecast = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setForecasts((prev) => [...prev, newForecast]);
      return newForecast;
    },
    [setForecasts],
  );

  const updateForecast = useCallback(
    (id: string, updates: Partial<Omit<Forecast, 'id' | 'userId' | 'createdAt'>>) => {
      setForecasts((prev) =>
        prev.map((forecast) =>
          forecast.id === id ? { ...forecast, ...updates, updatedAt: now() } : forecast,
        ),
      );
    },
    [setForecasts],
  );

  const deleteForecast = useCallback(
    (id: string) => {
      setForecasts((prev) => prev.filter((forecast) => forecast.id !== id));
    },
    [setForecasts],
  );

  return {
    forecasts,
    incomeForecasts,
    expenseForecasts,
    addForecast,
    updateForecast,
    deleteForecast,
  };
}
