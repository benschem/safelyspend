import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId, now } from '@/lib/utils';
import type { BudgetRule, ForecastRule, Scenario } from '@/lib/types';

const USER_ID = 'local';
const COLLAPSED_KEY = 'budget:whatIfBannerCollapsed';

/**
 * Adjustments are stored as ruleId/categoryId -> cents mappings
 * Only stores values that differ from baseline
 */
export interface WhatIfAdjustments {
  /** Income forecast rule adjustments: ruleId -> cents */
  incomeAdjustments: Record<string, number>;
  /** Budget rule adjustments: categoryId -> cents */
  budgetAdjustments: Record<string, number>;
  /** Fixed expense forecast rule adjustments: ruleId -> cents */
  fixedExpenseAdjustments: Record<string, number>;
  /** Savings forecast rule adjustments: ruleId -> cents */
  savingsAdjustments: Record<string, number>;
}

/** Individual item delta for comparison display */
export interface ItemDelta {
  id: string;
  name: string;
  baselineCents: number;
  adjustedCents: number;
  deltaCents: number;
}

/** Aggregated deltas by category for comparison modal */
export interface CategoryDeltas {
  income: { totalDelta: number; items: ItemDelta[] };
  fixedExpenses: { totalDelta: number; items: ItemDelta[] };
  budgetExpenses: { totalDelta: number; items: ItemDelta[] };
  savings: { totalDelta: number; items: ItemDelta[] };
  /** Net impact on monthly surplus (income - expenses - savings delta) */
  surplusDelta: number;
}

interface WhatIfContextValue {
  /** Current adjustments */
  adjustments: WhatIfAdjustments;
  /** Whether any adjustments differ from saved values */
  isWhatIfMode: boolean;
  /** Original values for comparison (from current scenario) */
  baselineValues: WhatIfAdjustments;

  /** Whether the banner is collapsed into the sidebar */
  isBannerCollapsed: boolean;
  /** Set banner collapsed state */
  setBannerCollapsed: (collapsed: boolean) => void;

  /** Set adjustment for an income forecast rule */
  setIncomeAdjustment: (ruleId: string, cents: number) => void;
  /** Set adjustment for a budget rule (by category) */
  setBudgetAdjustment: (categoryId: string, cents: number) => void;
  /** Set adjustment for a fixed expense forecast rule */
  setFixedExpenseAdjustment: (ruleId: string, cents: number) => void;
  /** Set adjustment for a savings forecast rule */
  setSavingsAdjustment: (ruleId: string, cents: number) => void;

  /** Save current adjustments as a new preset (scenario) */
  saveAsPreset: (name: string) => Promise<Scenario>;
  /** Save current adjustments to the current scenario (overwrites existing values) */
  saveToCurrentScenario: () => Promise<void>;
  /** Reset all adjustments to baseline */
  resetAdjustments: () => void;
  /** Check if a specific value has been adjusted */
  hasAdjustment: (type: 'income' | 'budget' | 'fixedExpense' | 'savings', id: string) => boolean;
  /** Get the delta for an adjustment (adjusted - baseline) */
  getDelta: (type: 'income' | 'budget' | 'fixedExpense' | 'savings', id: string) => number;
  /** Get aggregated deltas by category for comparison modal */
  getCategoryDeltas: () => CategoryDeltas;
}

const emptyAdjustments: WhatIfAdjustments = {
  incomeAdjustments: {},
  budgetAdjustments: {},
  fixedExpenseAdjustments: {},
  savingsAdjustments: {},
};

const WhatIfContext = createContext<WhatIfContextValue | null>(null);

export function useWhatIf() {
  const context = useContext(WhatIfContext);
  if (!context) {
    throw new Error('useWhatIf must be used within a WhatIfProvider');
  }
  return context;
}

interface WhatIfProviderProps {
  children: ReactNode;
  activeScenarioId: string | null;
}

export function WhatIfProvider({ children, activeScenarioId }: WhatIfProviderProps) {
  const [adjustments, setAdjustments] = useState<WhatIfAdjustments>(emptyAdjustments);
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(isBannerCollapsed));
  }, [isBannerCollapsed]);

  const setBannerCollapsed = useCallback((collapsed: boolean) => {
    setIsBannerCollapsed(collapsed);
  }, []);

  // Fetch current scenario data for baseline
  const budgetRules = useLiveQuery(
    () =>
      activeScenarioId ? db.budgetRules.where('scenarioId').equals(activeScenarioId).toArray() : [],
    [activeScenarioId],
  );
  const forecastRules = useLiveQuery(
    () =>
      activeScenarioId
        ? db.forecastRules.where('scenarioId').equals(activeScenarioId).toArray()
        : [],
    [activeScenarioId],
  );
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  // Calculate baseline values from current scenario
  const baselineValues = useMemo((): WhatIfAdjustments => {
    const baseline: WhatIfAdjustments = {
      incomeAdjustments: {},
      budgetAdjustments: {},
      fixedExpenseAdjustments: {},
      savingsAdjustments: {},
    };

    if (!budgetRules || !forecastRules) return baseline;

    // Budget rules are keyed by categoryId
    for (const rule of budgetRules) {
      baseline.budgetAdjustments[rule.categoryId] = rule.amountCents;
    }

    // Forecast rules are keyed by ruleId and separated by type
    for (const rule of forecastRules) {
      if (rule.type === 'income') {
        baseline.incomeAdjustments[rule.id] = rule.amountCents;
      } else if (rule.type === 'expense') {
        baseline.fixedExpenseAdjustments[rule.id] = rule.amountCents;
      } else if (rule.type === 'savings') {
        baseline.savingsAdjustments[rule.id] = rule.amountCents;
      }
    }

    return baseline;
  }, [budgetRules, forecastRules]);

  // Reset adjustments when scenario changes
  useEffect(() => {
    setAdjustments(emptyAdjustments);
  }, [activeScenarioId]);

  // Check if in what-if mode (any adjustments exist)
  const isWhatIfMode = useMemo(() => {
    return (
      Object.keys(adjustments.incomeAdjustments).length > 0 ||
      Object.keys(adjustments.budgetAdjustments).length > 0 ||
      Object.keys(adjustments.fixedExpenseAdjustments).length > 0 ||
      Object.keys(adjustments.savingsAdjustments).length > 0
    );
  }, [adjustments]);

  // Setters for adjustments
  const setIncomeAdjustment = useCallback(
    (ruleId: string, cents: number) => {
      const baseline = baselineValues.incomeAdjustments[ruleId] ?? 0;
      setAdjustments((prev) => {
        const next = { ...prev, incomeAdjustments: { ...prev.incomeAdjustments } };
        if (cents === baseline) {
          delete next.incomeAdjustments[ruleId];
        } else {
          next.incomeAdjustments[ruleId] = cents;
        }
        return next;
      });
    },
    [baselineValues],
  );

  const setBudgetAdjustment = useCallback(
    (categoryId: string, cents: number) => {
      const baseline = baselineValues.budgetAdjustments[categoryId] ?? 0;
      setAdjustments((prev) => {
        const next = { ...prev, budgetAdjustments: { ...prev.budgetAdjustments } };
        if (cents === baseline) {
          delete next.budgetAdjustments[categoryId];
        } else {
          next.budgetAdjustments[categoryId] = cents;
        }
        return next;
      });
    },
    [baselineValues],
  );

  const setFixedExpenseAdjustment = useCallback(
    (ruleId: string, cents: number) => {
      const baseline = baselineValues.fixedExpenseAdjustments[ruleId] ?? 0;
      setAdjustments((prev) => {
        const next = { ...prev, fixedExpenseAdjustments: { ...prev.fixedExpenseAdjustments } };
        if (cents === baseline) {
          delete next.fixedExpenseAdjustments[ruleId];
        } else {
          next.fixedExpenseAdjustments[ruleId] = cents;
        }
        return next;
      });
    },
    [baselineValues],
  );

  const setSavingsAdjustment = useCallback(
    (ruleId: string, cents: number) => {
      const baseline = baselineValues.savingsAdjustments[ruleId] ?? 0;
      setAdjustments((prev) => {
        const next = { ...prev, savingsAdjustments: { ...prev.savingsAdjustments } };
        if (cents === baseline) {
          delete next.savingsAdjustments[ruleId];
        } else {
          next.savingsAdjustments[ruleId] = cents;
        }
        return next;
      });
    },
    [baselineValues],
  );

  const resetAdjustments = useCallback(() => {
    setAdjustments(emptyAdjustments);
  }, []);

  const hasAdjustment = useCallback(
    (type: 'income' | 'budget' | 'fixedExpense' | 'savings', id: string): boolean => {
      switch (type) {
        case 'income':
          return id in adjustments.incomeAdjustments;
        case 'budget':
          return id in adjustments.budgetAdjustments;
        case 'fixedExpense':
          return id in adjustments.fixedExpenseAdjustments;
        case 'savings':
          return id in adjustments.savingsAdjustments;
      }
    },
    [adjustments],
  );

  const getDelta = useCallback(
    (type: 'income' | 'budget' | 'fixedExpense' | 'savings', id: string): number => {
      let adjusted: number | undefined;
      let baseline: number;

      switch (type) {
        case 'income':
          adjusted = adjustments.incomeAdjustments[id];
          baseline = baselineValues.incomeAdjustments[id] ?? 0;
          break;
        case 'budget':
          adjusted = adjustments.budgetAdjustments[id];
          baseline = baselineValues.budgetAdjustments[id] ?? 0;
          break;
        case 'fixedExpense':
          adjusted = adjustments.fixedExpenseAdjustments[id];
          baseline = baselineValues.fixedExpenseAdjustments[id] ?? 0;
          break;
        case 'savings':
          adjusted = adjustments.savingsAdjustments[id];
          baseline = baselineValues.savingsAdjustments[id] ?? 0;
          break;
      }

      if (adjusted === undefined) return 0;
      return adjusted - baseline;
    },
    [adjustments, baselineValues],
  );

  // Build a map of category names for display
  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories ?? []) {
      map[cat.id] = cat.name;
    }
    return map;
  }, [categories]);

  // Build a map of forecast rule names for display
  const forecastNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const rule of forecastRules ?? []) {
      map[rule.id] = rule.description;
    }
    return map;
  }, [forecastRules]);

  // Get aggregated deltas by category for comparison modal
  const getCategoryDeltas = useCallback((): CategoryDeltas => {
    const result: CategoryDeltas = {
      income: { totalDelta: 0, items: [] },
      fixedExpenses: { totalDelta: 0, items: [] },
      budgetExpenses: { totalDelta: 0, items: [] },
      savings: { totalDelta: 0, items: [] },
      surplusDelta: 0,
    };

    // Income adjustments
    for (const [ruleId, adjustedCents] of Object.entries(adjustments.incomeAdjustments)) {
      const baselineCents = baselineValues.incomeAdjustments[ruleId] ?? 0;
      const deltaCents = adjustedCents - baselineCents;
      result.income.items.push({
        id: ruleId,
        name: forecastNameMap[ruleId] ?? 'Income',
        baselineCents,
        adjustedCents,
        deltaCents,
      });
      result.income.totalDelta += deltaCents;
    }

    // Fixed expense adjustments
    for (const [ruleId, adjustedCents] of Object.entries(adjustments.fixedExpenseAdjustments)) {
      const baselineCents = baselineValues.fixedExpenseAdjustments[ruleId] ?? 0;
      const deltaCents = adjustedCents - baselineCents;
      result.fixedExpenses.items.push({
        id: ruleId,
        name: forecastNameMap[ruleId] ?? 'Fixed Expense',
        baselineCents,
        adjustedCents,
        deltaCents,
      });
      result.fixedExpenses.totalDelta += deltaCents;
    }

    // Budget adjustments (keyed by categoryId)
    for (const [categoryId, adjustedCents] of Object.entries(adjustments.budgetAdjustments)) {
      const baselineCents = baselineValues.budgetAdjustments[categoryId] ?? 0;
      const deltaCents = adjustedCents - baselineCents;
      result.budgetExpenses.items.push({
        id: categoryId,
        name: categoryNameMap[categoryId] ?? 'Budget',
        baselineCents,
        adjustedCents,
        deltaCents,
      });
      result.budgetExpenses.totalDelta += deltaCents;
    }

    // Savings adjustments
    for (const [ruleId, adjustedCents] of Object.entries(adjustments.savingsAdjustments)) {
      const baselineCents = baselineValues.savingsAdjustments[ruleId] ?? 0;
      const deltaCents = adjustedCents - baselineCents;
      result.savings.items.push({
        id: ruleId,
        name: forecastNameMap[ruleId] ?? 'Savings',
        baselineCents,
        adjustedCents,
        deltaCents,
      });
      result.savings.totalDelta += deltaCents;
    }

    // Calculate surplus delta: more income = positive, more expenses/savings = negative
    // Surplus = Income - Fixed - Budget - Savings
    // Delta = Income delta - Fixed delta - Budget delta - Savings delta
    result.surplusDelta =
      result.income.totalDelta -
      result.fixedExpenses.totalDelta -
      result.budgetExpenses.totalDelta -
      result.savings.totalDelta;

    return result;
  }, [adjustments, baselineValues, categoryNameMap, forecastNameMap]);

  // Save adjustments to the current scenario (overwrites existing values)
  const saveToCurrentScenario = useCallback(async (): Promise<void> => {
    if (!activeScenarioId || !budgetRules || !forecastRules) {
      throw new Error('No active scenario to save to');
    }

    const timestamp = now();

    // Update budget rules with adjusted values
    const budgetUpdates = budgetRules
      .filter((rule) => rule.categoryId in adjustments.budgetAdjustments)
      .map((rule) => ({
        key: rule.id,
        changes: {
          amountCents: adjustments.budgetAdjustments[rule.categoryId]!,
          updatedAt: timestamp,
        },
      }));

    // Update forecast rules with adjusted values
    const forecastUpdates = forecastRules
      .filter((rule) => {
        if (rule.type === 'income') return rule.id in adjustments.incomeAdjustments;
        if (rule.type === 'expense') return rule.id in adjustments.fixedExpenseAdjustments;
        if (rule.type === 'savings') return rule.id in adjustments.savingsAdjustments;
        return false;
      })
      .map((rule) => {
        let adjustedAmount = rule.amountCents;
        if (rule.type === 'income') {
          adjustedAmount = adjustments.incomeAdjustments[rule.id]!;
        } else if (rule.type === 'expense') {
          adjustedAmount = adjustments.fixedExpenseAdjustments[rule.id]!;
        } else if (rule.type === 'savings') {
          adjustedAmount = adjustments.savingsAdjustments[rule.id]!;
        }
        return {
          key: rule.id,
          changes: {
            amountCents: adjustedAmount,
            updatedAt: timestamp,
          },
        };
      });

    // Save updates in a transaction
    await db.transaction('rw', [db.budgetRules, db.forecastRules], async () => {
      for (const update of budgetUpdates) {
        await db.budgetRules.update(update.key, update.changes);
      }
      for (const update of forecastUpdates) {
        await db.forecastRules.update(update.key, update.changes);
      }
    });

    // Reset adjustments after saving
    setAdjustments(emptyAdjustments);
  }, [activeScenarioId, budgetRules, forecastRules, adjustments]);

  // Save adjustments as a new preset (scenario with rules)
  const saveAsPreset = useCallback(
    async (name: string): Promise<Scenario> => {
      if (!activeScenarioId || !budgetRules || !forecastRules) {
        throw new Error('No active scenario to save from');
      }

      const timestamp = now();

      // Create new scenario
      const newScenario: Scenario = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        name,
        isDefault: false,
      };

      // Create adjusted budget rules
      const newBudgetRules: BudgetRule[] = budgetRules.map((rule) => ({
        ...rule,
        id: generateId(),
        scenarioId: newScenario.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        amountCents: adjustments.budgetAdjustments[rule.categoryId] ?? rule.amountCents,
      }));

      // Create adjusted forecast rules
      const newForecastRules: ForecastRule[] = forecastRules.map((rule) => {
        let adjustedAmount = rule.amountCents;
        if (rule.type === 'income' && rule.id in adjustments.incomeAdjustments) {
          adjustedAmount = adjustments.incomeAdjustments[rule.id]!;
        } else if (rule.type === 'expense' && rule.id in adjustments.fixedExpenseAdjustments) {
          adjustedAmount = adjustments.fixedExpenseAdjustments[rule.id]!;
        } else if (rule.type === 'savings' && rule.id in adjustments.savingsAdjustments) {
          adjustedAmount = adjustments.savingsAdjustments[rule.id]!;
        }

        return {
          ...rule,
          id: generateId(),
          scenarioId: newScenario.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          amountCents: adjustedAmount,
        };
      });

      // Save everything in a transaction
      await db.transaction('rw', [db.scenarios, db.budgetRules, db.forecastRules], async () => {
        await db.scenarios.add(newScenario);
        await db.budgetRules.bulkAdd(newBudgetRules);
        await db.forecastRules.bulkAdd(newForecastRules);
      });

      // Reset adjustments after saving
      setAdjustments(emptyAdjustments);

      return newScenario;
    },
    [activeScenarioId, budgetRules, forecastRules, adjustments],
  );

  const value = useMemo(
    (): WhatIfContextValue => ({
      adjustments,
      isWhatIfMode,
      baselineValues,
      isBannerCollapsed,
      setBannerCollapsed,
      setIncomeAdjustment,
      setBudgetAdjustment,
      setFixedExpenseAdjustment,
      setSavingsAdjustment,
      saveAsPreset,
      saveToCurrentScenario,
      resetAdjustments,
      hasAdjustment,
      getDelta,
      getCategoryDeltas,
    }),
    [
      adjustments,
      isWhatIfMode,
      baselineValues,
      isBannerCollapsed,
      setBannerCollapsed,
      setIncomeAdjustment,
      setBudgetAdjustment,
      setFixedExpenseAdjustment,
      setSavingsAdjustment,
      saveAsPreset,
      saveToCurrentScenario,
      resetAdjustments,
      hasAdjustment,
      getDelta,
      getCategoryDeltas,
    ],
  );

  return <WhatIfContext.Provider value={value}>{children}</WhatIfContext.Provider>;
}
