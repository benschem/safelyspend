import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type {
  ForecastRule,
  ExpandedForecast,
  CreateEntity,
  SavingsGoal,
  Transaction,
} from '@/lib/types';
import { generateId, now, getLastDayOfMonth, formatISODate } from '@/lib/utils';
import { getEffectiveRate } from '@/lib/interest-rate';

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

function expandRule(rule: ForecastRule, rangeStart: string, rangeEnd: string): ExpandedForecast[] {
  const results: ExpandedForecast[] = [];

  // Determine effective start/end for the rule
  const effectiveStart =
    rule.startDate && rule.startDate > rangeStart ? rule.startDate : rangeStart;
  const effectiveEnd = rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) return results;

  // Parse as local dates to avoid timezone issues with date comparisons
  const start = parseLocalDate(effectiveStart);
  const end = parseLocalDate(effectiveEnd);

  // Build a Set of excluded dates for fast lookup
  const excludedSet = new Set(rule.excludedDates ?? []);

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
      // Anchor the fortnightly cadence to the rule's own startDate so that
      // generated dates are consistent regardless of the query range.
      // Without this, querying Jan-Dec vs Mar-Mar produces different
      // fortnightly alignments within the same calendar month.
      const anchor = rule.startDate ? parseLocalDate(rule.startDate) : new Date(2020, 0, 1);
      const current = new Date(anchor);
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }
      // Skip forward to the effective start of the query range
      while (current < start) {
        current.setDate(current.getDate() + 14);
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

  // Filter out excluded dates
  return results.filter((forecast) => !excludedSet.has(forecast.date));
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

  // Filter goals with interest rates (base rate or scheduled rates)
  const goalsWithInterest = savingsGoals.filter(
    (g) =>
      (g.annualInterestRate && g.annualInterestRate > 0) ||
      (g.interestRateSchedule && g.interestRateSchedule.length > 0),
  );
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
      const monthDate = formatISODate(monthEndDate);

      // Get the effective rate for this month
      const effectiveRate = getEffectiveRate(goal, monthDate) / 100;
      const monthlyRate =
        goal.compoundingFrequency === 'yearly'
          ? 0 // Yearly compounding - only apply at year end
          : goal.compoundingFrequency === 'daily'
            ? Math.pow(1 + effectiveRate / 365, 30) - 1 // Approximate daily compounding per month
            : effectiveRate / 12; // Monthly compounding

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
          interestAmount = Math.round(balance * effectiveRate);
        }
      } else {
        interestAmount = Math.round(balance * monthlyRate);
      }

      if (interestAmount > 0) {
        results.push({
          type: 'savings',
          date: monthDate,
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
 * Hook for managing forecast rules
 */
export function useForecasts(scenarioId: string | null, startDate?: string, endDate?: string) {
  const rawRules = useLiveQuery(() => db.forecastRules.toArray(), []);
  const rawSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []);
  const rawTransactions = useLiveQuery(() => db.transactions.toArray(), []);

  const allRules = useMemo(() => rawRules ?? [], [rawRules]);
  const savingsGoals = useMemo(() => rawSavingsGoals ?? [], [rawSavingsGoals]);
  const allTransactions = useMemo(() => rawTransactions ?? [], [rawTransactions]);

  const isLoading = rawRules === undefined;

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

  // Expand all rules over the date range
  const expandedForecasts = useMemo(() => {
    if (!startDate || !endDate) return [];

    const expanded: ExpandedForecast[] = [];

    // Expand rules
    for (const rule of rules) {
      expanded.push(...expandRule(rule, startDate, endDate));
    }

    // Sort by date
    expanded.sort((a, b) => a.date.localeCompare(b.date));

    return expanded;
  }, [rules, startDate, endDate]);

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

  const restoreRule = useCallback(async (rule: ForecastRule) => {
    await db.forecastRules.put(rule);
    return rule;
  }, []);

  // Exclude a single occurrence of a recurring rule by adding the date to excludedDates
  const excludeOccurrence = useCallback(
    async (ruleId: string, date: string) => {
      const rule = allRules.find((r) => r.id === ruleId);
      if (!rule) return;

      const excludedDates = [...(rule.excludedDates ?? []), date];
      await db.forecastRules.update(ruleId, { excludedDates, updatedAt: now() });
    },
    [allRules],
  );

  // Duplicate rules from one scenario to another
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

      await db.forecastRules.bulkAdd(newRules);
    },
    [allRules],
  );

  return {
    // Raw data
    rules,
    isLoading,
    // Expanded forecasts (materialized from rules)
    expandedForecasts,
    incomeForecasts,
    expenseForecasts,
    savingsForecasts,
    // Rule CRUD
    addRule,
    updateRule,
    deleteRule,
    restoreRule,
    excludeOccurrence,
    // Utilities
    duplicateToScenario,
  };
}
