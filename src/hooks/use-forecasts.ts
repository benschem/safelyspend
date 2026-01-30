import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type {
  ForecastRule,
  ForecastEvent,
  ExpandedForecast,
  CreateEntity,
  SavingsGoal,
  Transaction,
} from '@/lib/types';
import { generateId, now, getLastDayOfMonth, formatISODate } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Expand a forecast rule into individual forecast instances over a date range
 */
/**
 * Parse a YYYY-MM-DD string as a local date (not UTC)
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

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

  // Parse as local dates to avoid timezone issues with date comparisons
  const start = parseLocalDate(effectiveStart);
  const end = parseLocalDate(effectiveEnd);

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
 * Generate interest forecasts for savings goals with interest rates
 * Uses monthly compounding and generates one entry per month per goal
 */
function generateInterestForecasts(
  savingsGoals: SavingsGoal[],
  savingsTransactions: Transaction[],
  savingsForecasts: ExpandedForecast[],
  rangeStart: string,
  rangeEnd: string,
): ExpandedForecast[] {
  const results: ExpandedForecast[] = [];

  // Filter goals with interest rates
  const goalsWithInterest = savingsGoals.filter((g) => g.annualInterestRate && g.annualInterestRate > 0);
  if (goalsWithInterest.length === 0) return results;

  // Calculate current balance per goal (from transactions up to rangeStart)
  const currentBalances: Record<string, number> = {};
  for (const t of savingsTransactions) {
    if (t.savingsGoalId && t.date < rangeStart) {
      currentBalances[t.savingsGoalId] = (currentBalances[t.savingsGoalId] ?? 0) + t.amountCents;
    }
  }

  // Group actual transactions by goal and month (within range)
  const transactionsByGoalAndMonth: Record<string, Record<string, number>> = {};
  for (const t of savingsTransactions) {
    if (!t.savingsGoalId || t.date < rangeStart || t.date > rangeEnd) continue;
    const goalId = t.savingsGoalId;
    const monthKey = t.date.slice(0, 7); // YYYY-MM
    if (!transactionsByGoalAndMonth[goalId]) {
      transactionsByGoalAndMonth[goalId] = {};
    }
    const goalTxns = transactionsByGoalAndMonth[goalId]!;
    goalTxns[monthKey] = (goalTxns[monthKey] ?? 0) + t.amountCents;
  }

  // Group forecasts by goal and month
  const forecastsByGoalAndMonth: Record<string, Record<string, number>> = {};
  for (const f of savingsForecasts) {
    if (!f.savingsGoalId) continue;
    const goalId = f.savingsGoalId;
    const monthKey = f.date.slice(0, 7); // YYYY-MM
    if (!forecastsByGoalAndMonth[goalId]) {
      forecastsByGoalAndMonth[goalId] = {};
    }
    const goalForecasts = forecastsByGoalAndMonth[goalId]!;
    goalForecasts[monthKey] = (goalForecasts[monthKey] ?? 0) + f.amountCents;
  }

  // Generate monthly interest for each goal
  for (const goal of goalsWithInterest) {
    const rate = goal.annualInterestRate! / 100; // Convert percentage to decimal
    const monthlyRate = goal.compoundingFrequency === 'yearly'
      ? 0 // Yearly compounding - only apply at year end
      : goal.compoundingFrequency === 'daily'
        ? Math.pow(1 + rate / 365, 30) - 1 // Approximate daily compounding per month
        : rate / 12; // Monthly compounding

    let balance = currentBalances[goal.id] ?? 0;

    // Iterate month by month
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    let year = start.getFullYear();
    let month = start.getMonth();

    while (true) {
      const lastDay = getLastDayOfMonth(year, month);
      const monthEndDate = new Date(year, month, lastDay);

      if (monthEndDate > end) break;

      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Add actual transactions for this month to balance first
      const actualContributions = transactionsByGoalAndMonth[goal.id]?.[monthKey] ?? 0;
      balance += actualContributions;

      // Add forecast contributions for this month
      const forecastContributions = forecastsByGoalAndMonth[goal.id]?.[monthKey] ?? 0;
      balance += forecastContributions;

      // Calculate interest on end-of-month balance
      let interestAmount = 0;
      if (goal.compoundingFrequency === 'yearly') {
        // Only apply interest in December (or goal's deadline month if set)
        if (month === 11) {
          interestAmount = Math.round(balance * rate);
        }
      } else {
        interestAmount = Math.round(balance * monthlyRate);
      }

      if (interestAmount > 0) {
        results.push({
          type: 'savings',
          date: formatISODate(monthEndDate),
          amountCents: interestAmount,
          description: `Interest (${goal.name})`,
          categoryId: null,
          savingsGoalId: goal.id,
          sourceType: 'interest',
          sourceId: goal.id,
        });

        // Add interest to balance for compounding
        balance += interestAmount;
      }

      // Move to next month
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
  }

  return results;
}

/**
 * Hook for managing forecast rules and events
 */
export function useForecasts(scenarioId: string | null, startDate?: string, endDate?: string) {
  const rawRules = useLiveQuery(() => db.forecastRules.toArray(), []);
  const rawEvents = useLiveQuery(() => db.forecastEvents.toArray(), []);
  const rawSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []);
  const rawTransactions = useLiveQuery(() => db.transactions.toArray(), []);

  const allRules = useMemo(() => rawRules ?? [], [rawRules]);
  const allEvents = useMemo(() => rawEvents ?? [], [rawEvents]);
  const savingsGoals = useMemo(() => rawSavingsGoals ?? [], [rawSavingsGoals]);
  const allTransactions = useMemo(() => rawTransactions ?? [], [rawTransactions]);

  const isLoading = rawRules === undefined || rawEvents === undefined;

  // Filter savings transactions
  const savingsTransactions = useMemo(
    () => allTransactions.filter((t) => t.type === 'savings'),
    [allTransactions],
  );

  // Filter rules to current scenario
  const rules = useMemo(
    () => (scenarioId ? allRules.filter((r) => r.scenarioId === scenarioId) : []),
    [allRules, scenarioId],
  );

  // Filter events to current scenario
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

  // Get base savings forecasts (without interest)
  const baseSavingsForecasts = useMemo(
    () => expandedForecasts.filter((f) => f.type === 'savings'),
    [expandedForecasts],
  );

  // Generate interest forecasts and combine with base savings
  const savingsForecasts = useMemo(() => {
    if (!startDate || !endDate) return baseSavingsForecasts;

    const interestForecasts = generateInterestForecasts(
      savingsGoals,
      savingsTransactions,
      baseSavingsForecasts,
      startDate,
      endDate,
    );

    // Combine and sort
    const combined = [...baseSavingsForecasts, ...interestForecasts];
    combined.sort((a, b) => a.date.localeCompare(b.date));
    return combined;
  }, [baseSavingsForecasts, savingsGoals, savingsTransactions, startDate, endDate]);

  // CRUD for rules
  const addRule = useCallback(async (data: CreateEntity<ForecastRule>) => {
    const timestamp = now();
    const newRule: ForecastRule = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.forecastRules.add(newRule);
    return newRule;
  }, []);

  const updateRule = useCallback(
    async (id: string, updates: Partial<Omit<ForecastRule, 'id' | 'userId' | 'createdAt'>>) => {
      await db.forecastRules.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteRule = useCallback(async (id: string) => {
    await db.forecastRules.delete(id);
  }, []);

  // CRUD for events
  const addEvent = useCallback(async (data: CreateEntity<ForecastEvent>) => {
    const timestamp = now();
    const newEvent: ForecastEvent = {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...data,
    };
    await db.forecastEvents.add(newEvent);
    return newEvent;
  }, []);

  const updateEvent = useCallback(
    async (id: string, updates: Partial<Omit<ForecastEvent, 'id' | 'userId' | 'createdAt'>>) => {
      await db.forecastEvents.update(id, { ...updates, updatedAt: now() });
    },
    [],
  );

  const deleteEvent = useCallback(async (id: string) => {
    await db.forecastEvents.delete(id);
  }, []);

  // Duplicate rules and events from one scenario to another
  const duplicateToScenario = useCallback(
    async (fromScenarioId: string, toScenarioId: string) => {
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

      await Promise.all([
        db.forecastRules.bulkAdd(newRules),
        db.forecastEvents.bulkAdd(newEvents),
      ]);
    },
    [allRules, allEvents],
  );

  return {
    // Raw data
    rules,
    events,
    eventsInRange,
    isLoading,
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
