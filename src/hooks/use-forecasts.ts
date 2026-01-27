import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type {
  ForecastRule,
  ForecastEvent,
  ExpandedForecast,
  CreateEntity,
} from '@/lib/types';
import { generateId, now, getLastDayOfMonth, formatISODate } from '@/lib/utils';

const RULES_STORAGE_KEY = 'budget:forecastRules';
const EVENTS_STORAGE_KEY = 'budget:forecastEvents';
const USER_ID = 'local';

/**
 * Expand a forecast rule into individual forecast instances over a date range
 */
function expandRule(
  rule: ForecastRule,
  rangeStart: string,
  rangeEnd: string,
): ExpandedForecast[] {
  const results: ExpandedForecast[] = [];

  // Determine effective start/end for the rule
  const effectiveStart = rule.startDate && rule.startDate > rangeStart ? rule.startDate : rangeStart;
  const effectiveEnd = rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) return results;

  const start = new Date(effectiveStart);
  const end = new Date(effectiveEnd);

  switch (rule.cadence) {
    case 'weekly': {
      const targetDay = rule.dayOfWeek ?? 0;
      const current = new Date(start);
      // Move to first occurrence of target day
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      while (current <= end) {
        results.push({
          type: rule.type,
          date: formatISODate(current),
          amountCents: rule.amountCents,
          description: rule.description,
          categoryId: rule.categoryId,
          savingsGoalId: rule.savingsGoalId,
          sourceType: 'rule',
          sourceId: rule.id,
        });
        current.setDate(current.getDate() + 7);
      }
      break;
    }

    case 'fortnightly': {
      const targetDay = rule.dayOfWeek ?? 0;
      const current = new Date(start);
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      while (current <= end) {
        results.push({
          type: rule.type,
          date: formatISODate(current),
          amountCents: rule.amountCents,
          description: rule.description,
          categoryId: rule.categoryId,
          savingsGoalId: rule.savingsGoalId,
          sourceType: 'rule',
          sourceId: rule.id,
        });
        current.setDate(current.getDate() + 14);
      }
      break;
    }

    case 'monthly': {
      const targetDay = rule.dayOfMonth ?? 1;
      let year = start.getFullYear();
      let month = start.getMonth();

      while (true) {
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
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
      const targetDay = rule.dayOfMonth ?? 1;
      const monthOffset = rule.monthOfQuarter ?? 0; // 0 = 1st month, 1 = 2nd month, 2 = 3rd month
      let year = start.getFullYear();
      let quarter = Math.floor(start.getMonth() / 3);

      while (true) {
        // Calculate the target month within the quarter
        const month = quarter * 3 + monthOffset;
        const lastDay = getLastDayOfMonth(year, month);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, month, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
        }

        quarter++;
        if (quarter > 3) {
          quarter = 0;
          year++;
        }
      }
      break;
    }

    case 'yearly': {
      const targetDay = rule.dayOfMonth ?? 1;
      const targetMonth = rule.monthOfYear ?? 0; // 0 = January, 11 = December
      let year = start.getFullYear();

      while (true) {
        const lastDay = getLastDayOfMonth(year, targetMonth);
        const actualDay = Math.min(targetDay, lastDay);
        const date = new Date(year, targetMonth, actualDay);

        if (date > end) break;
        if (date >= start) {
          results.push({
            type: rule.type,
            date: formatISODate(date),
            amountCents: rule.amountCents,
            description: rule.description,
            categoryId: rule.categoryId,
            savingsGoalId: rule.savingsGoalId,
            sourceType: 'rule',
            sourceId: rule.id,
          });
        }

        year++;
      }
      break;
    }
  }

  return results;
}

/**
 * Hook for managing forecast rules and events
 */
export function useForecasts(scenarioId: string | null, startDate?: string, endDate?: string) {
  const [allRules, setRules] = useLocalStorage<ForecastRule[]>(RULES_STORAGE_KEY, []);
  const [allEvents, setEvents] = useLocalStorage<ForecastEvent[]>(EVENTS_STORAGE_KEY, []);

  // Filter rules and events to current scenario
  const rules = useMemo(
    () => (scenarioId ? allRules.filter((r) => r.scenarioId === scenarioId) : []),
    [allRules, scenarioId],
  );

  const events = useMemo(
    () => (scenarioId ? allEvents.filter((e) => e.scenarioId === scenarioId) : []),
    [allEvents, scenarioId],
  );

  // Filter events by date range
  const eventsInRange = useMemo(() => {
    if (!startDate || !endDate) return events;
    return events.filter((e) => e.date >= startDate && e.date <= endDate);
  }, [events, startDate, endDate]);

  // Expand all rules over the date range and combine with events
  const expandedForecasts = useMemo(() => {
    if (!startDate || !endDate) return [];

    const expanded: ExpandedForecast[] = [];

    // Expand rules
    for (const rule of rules) {
      expanded.push(...expandRule(rule, startDate, endDate));
    }

    // Add events
    for (const event of eventsInRange) {
      expanded.push({
        type: event.type,
        date: event.date,
        amountCents: event.amountCents,
        description: event.description,
        categoryId: event.categoryId,
        savingsGoalId: event.savingsGoalId,
        sourceType: 'event',
        sourceId: event.id,
      });
    }

    // Sort by date
    expanded.sort((a, b) => a.date.localeCompare(b.date));

    return expanded;
  }, [rules, eventsInRange, startDate, endDate]);

  // Filter expanded forecasts by type
  const incomeForecasts = useMemo(
    () => expandedForecasts.filter((f) => f.type === 'income'),
    [expandedForecasts],
  );
  const expenseForecasts = useMemo(
    () => expandedForecasts.filter((f) => f.type === 'expense'),
    [expandedForecasts],
  );
  const savingsForecasts = useMemo(
    () => expandedForecasts.filter((f) => f.type === 'savings'),
    [expandedForecasts],
  );

  // CRUD for rules
  const addRule = useCallback(
    (data: CreateEntity<ForecastRule>) => {
      const timestamp = now();
      const newRule: ForecastRule = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setRules((prev) => [...prev, newRule]);
      return newRule;
    },
    [setRules],
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>) => {
      setRules((prev) =>
        prev.map((rule) =>
          rule.id === id ? { ...rule, ...updates, updatedAt: now() } : rule,
        ),
      );
    },
    [setRules],
  );

  const deleteRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((rule) => rule.id !== id));
    },
    [setRules],
  );

  // CRUD for events
  const addEvent = useCallback(
    (data: CreateEntity<ForecastEvent>) => {
      const timestamp = now();
      const newEvent: ForecastEvent = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      setEvents((prev) => [...prev, newEvent]);
      return newEvent;
    },
    [setEvents],
  );

  const updateEvent = useCallback(
    (id: string, updates: Partial<Omit<ForecastEvent, 'id' | 'userId' | 'createdAt'>>) => {
      setEvents((prev) =>
        prev.map((event) =>
          event.id === id ? { ...event, ...updates, updatedAt: now() } : event,
        ),
      );
    },
    [setEvents],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((event) => event.id !== id));
    },
    [setEvents],
  );

  // Duplicate rules and events from one scenario to another
  const duplicateToScenario = useCallback(
    (fromScenarioId: string, toScenarioId: string) => {
      const timestamp = now();

      // Duplicate rules
      const rulesToCopy = allRules.filter((r) => r.scenarioId === fromScenarioId);
      const newRules = rulesToCopy.map((rule) => ({
        ...rule,
        id: generateId(),
        scenarioId: toScenarioId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      // Duplicate events
      const eventsToCopy = allEvents.filter((e) => e.scenarioId === fromScenarioId);
      const newEvents = eventsToCopy.map((event) => ({
        ...event,
        id: generateId(),
        scenarioId: toScenarioId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      setRules((prev) => [...prev, ...newRules]);
      setEvents((prev) => [...prev, ...newEvents]);
    },
    [allRules, allEvents, setRules, setEvents],
  );

  return {
    // Raw data
    rules,
    events,
    eventsInRange,
    // Expanded forecasts (materialized from rules + events)
    expandedForecasts,
    incomeForecasts,
    expenseForecasts,
    savingsForecasts,
    // Rule CRUD
    addRule,
    updateRule,
    deleteRule,
    // Event CRUD
    addEvent,
    updateEvent,
    deleteEvent,
    // Utilities
    duplicateToScenario,
  };
}
