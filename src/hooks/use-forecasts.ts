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
import { formatISODate, formatYearMonth, parseLocalDate } from '@/lib/dates';
import { generateId, now, getLastDayOfMonth } from '@/lib/utils';
import { getEffectiveRate } from '@/lib/interest-rate';
import { expandForecastRule } from '@/lib/cadence';

const USER_ID = 'local';

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
    const start = parseLocalDate(rangeStart);
    const end = parseLocalDate(rangeEnd);
    let year = start.getFullYear();
    let month = start.getMonth();

    while (true) {
      const lastDay = getLastDayOfMonth(year, month);
      const monthEndDate = new Date(year, month, lastDay);

      if (monthEndDate > end) break;

      const monthKey = formatYearMonth(monthEndDate);
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

export interface ForecastsByType {
  incomeForecasts: ExpandedForecast[];
  expenseForecasts: ExpandedForecast[];
  /** Savings contributions from rules. Never holds interest. */
  savingsForecasts: ExpandedForecast[];
  /** Interest each savings goal is expected to earn, one entry per goal per month */
  interestForecasts: ExpandedForecast[];
}

/**
 * Split dated forecasts into income, bills and savings contributions, and work
 * out the interest each savings goal should earn over the same range.
 *
 * Interest is kept in a list of its own. A savings contribution is money that
 * leaves the spending account; interest is money the bank adds to the savings
 * account. Adding the two together overstates what has to be set aside.
 *
 * With no date range there is nothing to forecast, so there is no interest.
 */
export function groupForecastsByType(
  expandedForecasts: ExpandedForecast[],
  savingsGoals: SavingsGoal[],
  savingsTransactions: Transaction[],
  startDate?: string,
  endDate?: string,
): ForecastsByType {
  const savingsForecasts = expandedForecasts.filter((forecast) => forecast.type === 'savings');

  const interestForecasts =
    startDate && endDate
      ? generateInterestForecasts(
          savingsGoals,
          savingsTransactions,
          savingsForecasts,
          startDate,
          endDate,
        )
      : [];

  return {
    incomeForecasts: expandedForecasts.filter((forecast) => forecast.type === 'income'),
    expenseForecasts: expandedForecasts.filter((forecast) => forecast.type === 'expense'),
    savingsForecasts,
    interestForecasts,
  };
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
      expanded.push(...expandForecastRule(rule, startDate, endDate));
    }

    // Sort by date
    expanded.sort((a, b) => a.date.localeCompare(b.date));

    return expanded;
  }, [rules, startDate, endDate]);

  // Split by type, with forecast interest kept apart from savings contributions
  const { incomeForecasts, expenseForecasts, savingsForecasts, interestForecasts } = useMemo(
    () =>
      groupForecastsByType(
        expandedForecasts,
        savingsGoals,
        savingsTransactions,
        startDate,
        endDate,
      ),
    [expandedForecasts, savingsGoals, savingsTransactions, startDate, endDate],
  );

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
    interestForecasts,
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
