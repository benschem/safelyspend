import Dexie, { type Table } from 'dexie';
import type {
  Scenario,
  Category,
  Transaction,
  BudgetRule,
  ForecastRule,
  ForecastEvent,
  SavingsGoal,
  BalanceAnchor,
  CategoryRule,
  BudgetData,
} from './types';

// App config stored in IndexedDB
export interface AppConfig {
  id: 'singleton';
  isInitialized: boolean;
  isDemo: boolean;
}

// Active scenario reference
export interface ActiveScenario {
  id: 'singleton';
  scenarioId: string | null;
}

// Payment method (simple string list stored as objects)
export interface PaymentMethod {
  id: string;
  name: string;
}

export class BudgetDatabase extends Dexie {
  scenarios!: Table<Scenario, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgetRules!: Table<BudgetRule, string>;
  forecastRules!: Table<ForecastRule, string>;
  forecastEvents!: Table<ForecastEvent, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  balanceAnchors!: Table<BalanceAnchor, string>;
  categoryRules!: Table<CategoryRule, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  appConfig!: Table<AppConfig, 'singleton'>;
  activeScenario!: Table<ActiveScenario, 'singleton'>;

  constructor() {
    super('BudgetApp');
    this.version(1).stores({
      scenarios: 'id, isDefault',
      categories: 'id, isArchived',
      // date index for range queries, importFingerprint for dedup
      transactions: 'id, date, categoryId, savingsGoalId, importFingerprint',
      budgetRules: 'id, scenarioId',
      forecastRules: 'id, scenarioId',
      // compound index for "events in scenario within date range"
      forecastEvents: 'id, scenarioId, [scenarioId+date], date',
      savingsGoals: 'id',
      balanceAnchors: 'id, date',
      categoryRules: 'id, priority',
      paymentMethods: 'id',
      appConfig: 'id',
      activeScenario: 'id',
    });
  }
}

export const db = new BudgetDatabase();

// Current data version for export/import
export const CURRENT_DATA_VERSION = 2;

// Budget backup type for export/import
export interface BudgetBackup extends BudgetData {
  version: number;
  exportedAt: string;
  activeScenarioId: string | null;
  paymentMethods?: string[];
}

/**
 * Export all data from IndexedDB
 */
export async function exportAllData(): Promise<BudgetBackup> {
  const [
    scenarios,
    categories,
    transactions,
    budgetRules,
    forecastRules,
    forecastEvents,
    savingsGoals,
    balanceAnchors,
    categoryRules,
    paymentMethodRecords,
    activeScenario,
  ] = await Promise.all([
    db.scenarios.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgetRules.toArray(),
    db.forecastRules.toArray(),
    db.forecastEvents.toArray(),
    db.savingsGoals.toArray(),
    db.balanceAnchors.toArray(),
    db.categoryRules.toArray(),
    db.paymentMethods.toArray(),
    db.activeScenario.get('singleton'),
  ]);

  return {
    version: CURRENT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    scenarios,
    categories,
    transactions,
    budgetRules,
    forecastRules,
    forecastEvents,
    savingsGoals,
    balanceAnchors,
    categoryRules,
    paymentMethods: paymentMethodRecords.map((pm) => pm.name),
    activeScenarioId: activeScenario?.scenarioId ?? null,
  };
}

/**
 * Import all data into IndexedDB (replaces existing data)
 */
export async function importAllData(
  backup: BudgetData & { activeScenarioId?: string | null; paymentMethods?: string[] },
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.scenarios,
      db.categories,
      db.transactions,
      db.budgetRules,
      db.forecastRules,
      db.forecastEvents,
      db.savingsGoals,
      db.balanceAnchors,
      db.categoryRules,
      db.paymentMethods,
      db.activeScenario,
      db.appConfig,
    ],
    async () => {
      // Clear all tables
      await Promise.all([
        db.scenarios.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgetRules.clear(),
        db.forecastRules.clear(),
        db.forecastEvents.clear(),
        db.savingsGoals.clear(),
        db.balanceAnchors.clear(),
        db.categoryRules.clear(),
        db.paymentMethods.clear(),
      ]);

      // Import using bulkPut (idempotent)
      await Promise.all([
        db.scenarios.bulkPut(backup.scenarios),
        db.categories.bulkPut(backup.categories),
        db.transactions.bulkPut(backup.transactions),
        db.budgetRules.bulkPut(backup.budgetRules),
        db.forecastRules.bulkPut(backup.forecastRules),
        db.forecastEvents.bulkPut(backup.forecastEvents),
        db.savingsGoals.bulkPut(backup.savingsGoals),
        db.balanceAnchors.bulkPut(backup.balanceAnchors ?? []),
        db.categoryRules.bulkPut(backup.categoryRules ?? []),
      ]);

      // Import payment methods
      if (backup.paymentMethods) {
        const paymentMethodRecords = backup.paymentMethods.map((name, index) => ({
          id: `pm_${index}`,
          name,
        }));
        await db.paymentMethods.bulkPut(paymentMethodRecords);
      }

      // Set active scenario
      if (backup.activeScenarioId !== undefined) {
        await db.activeScenario.put({
          id: 'singleton',
          scenarioId: backup.activeScenarioId,
        });
      }

      // Mark as initialized
      await db.appConfig.put({
        id: 'singleton',
        isInitialized: true,
        isDemo: false,
      });
    },
  );
}

/**
 * Reset IndexedDB only (preserves localStorage preferences)
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.scenarios,
      db.categories,
      db.transactions,
      db.budgetRules,
      db.forecastRules,
      db.forecastEvents,
      db.savingsGoals,
      db.balanceAnchors,
      db.categoryRules,
      db.paymentMethods,
      db.activeScenario,
      db.appConfig,
    ],
    async () => {
      await Promise.all([
        db.scenarios.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgetRules.clear(),
        db.forecastRules.clear(),
        db.forecastEvents.clear(),
        db.savingsGoals.clear(),
        db.balanceAnchors.clear(),
        db.categoryRules.clear(),
        db.paymentMethods.clear(),
        db.activeScenario.clear(),
        db.appConfig.clear(),
      ]);
    },
  );
}

/**
 * Full reset - clears IndexedDB and localStorage preferences
 */
export async function fullReset(): Promise<void> {
  // Clear IndexedDB
  await resetDatabase();

  // Clear localStorage preferences
  const keysToRemove = ['budget:viewState', 'budget:theme'];
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Load demo data into IndexedDB
 */
export async function loadDemoData(data: BudgetData): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.scenarios,
      db.categories,
      db.transactions,
      db.budgetRules,
      db.forecastRules,
      db.forecastEvents,
      db.savingsGoals,
      db.balanceAnchors,
      db.categoryRules,
      db.activeScenario,
      db.appConfig,
    ],
    async () => {
      // Clear existing data
      await Promise.all([
        db.scenarios.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgetRules.clear(),
        db.forecastRules.clear(),
        db.forecastEvents.clear(),
        db.savingsGoals.clear(),
        db.balanceAnchors.clear(),
        db.categoryRules.clear(),
      ]);

      // Insert demo data
      await Promise.all([
        db.scenarios.bulkPut(data.scenarios),
        db.categories.bulkPut(data.categories),
        db.transactions.bulkPut(data.transactions),
        db.budgetRules.bulkPut(data.budgetRules),
        db.forecastRules.bulkPut(data.forecastRules),
        db.forecastEvents.bulkPut(data.forecastEvents),
        db.savingsGoals.bulkPut(data.savingsGoals),
        db.balanceAnchors.bulkPut(data.balanceAnchors),
        db.categoryRules.bulkPut(data.categoryRules),
      ]);

      // Set active scenario to first scenario
      const firstScenarioId = data.scenarios[0]?.id ?? null;
      await db.activeScenario.put({
        id: 'singleton',
        scenarioId: firstScenarioId,
      });

      // Mark as initialized with demo flag
      await db.appConfig.put({
        id: 'singleton',
        isInitialized: true,
        isDemo: true,
      });
    },
  );
}
