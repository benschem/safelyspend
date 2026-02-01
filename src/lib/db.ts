import Dexie, { type Table } from 'dexie';
import type {
  Scenario,
  Category,
  Transaction,
  BudgetRule,
  ForecastRule,
  SavingsGoal,
  BalanceAnchor,
  CategoryRule,
  BudgetData,
} from './types';
import { STORAGE_KEYS } from './storage-keys';

// =============================================================================
// Schema Version History
// =============================================================================
// Version 1 (App v1.0.0): Initial schema
//   - All core tables: scenarios, categories, transactions, budgetRules,
//     forecastRules, forecastEvents, savingsGoals, balanceAnchors, categoryRules
//   - Config tables: appConfig, activeScenario
//
// Version 2 (App v0.16.0): Remove forecastEvents
//   - Removed forecastEvents table (one-off forecast items)
//   - Simplified model: use transactions for actuals, forecast rules for recurring
//
// IMPORTANT: When adding schema changes:
// 1. Add a new version() call with the next version number
// 2. Only define indexes that changed (Dexie merges with previous)
// 3. Add .upgrade() if data migration is needed
// 4. Update CURRENT_SCHEMA_VERSION constant
// 5. Update CURRENT_DATA_VERSION if export format changed
// 6. Document the change in this header
// =============================================================================

/** Current schema version - increment when IndexedDB structure changes */
export const CURRENT_SCHEMA_VERSION = 2;

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

export class BudgetDatabase extends Dexie {
  scenarios!: Table<Scenario, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgetRules!: Table<BudgetRule, string>;
  forecastRules!: Table<ForecastRule, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  balanceAnchors!: Table<BalanceAnchor, string>;
  categoryRules!: Table<CategoryRule, string>;
  appConfig!: Table<AppConfig, 'singleton'>;
  activeScenario!: Table<ActiveScenario, 'singleton'>;

  constructor() {
    super('BudgetApp');

    // Version 1: Initial schema (App v1.0.0)
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
      appConfig: 'id',
      activeScenario: 'id',
    });

    // Version 2: Remove forecastEvents table (App v0.16.0)
    // Setting to null removes the table from the schema
    this.version(2).stores({
      forecastEvents: null,
    });
  }
}

export const db = new BudgetDatabase();

/** Current data export version - increment when export format changes */
export const CURRENT_DATA_VERSION = 2;

// Budget backup type for export/import
export interface BudgetBackup extends BudgetData {
  version: number;
  exportedAt: string;
  activeScenarioId: string | null;
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
    savingsGoals,
    balanceAnchors,
    categoryRules,
    activeScenario,
  ] = await Promise.all([
    db.scenarios.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgetRules.toArray(),
    db.forecastRules.toArray(),
    db.savingsGoals.toArray(),
    db.balanceAnchors.toArray(),
    db.categoryRules.toArray(),
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
    savingsGoals,
    balanceAnchors,
    categoryRules,
    activeScenarioId: activeScenario?.scenarioId ?? null,
  };
}

/**
 * Import all data into IndexedDB (replaces existing data)
 */
export async function importAllData(
  backup: BudgetData & { activeScenarioId?: string | null },
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.scenarios,
      db.categories,
      db.transactions,
      db.budgetRules,
      db.forecastRules,
      db.savingsGoals,
      db.balanceAnchors,
      db.categoryRules,
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
        db.savingsGoals.clear(),
        db.balanceAnchors.clear(),
        db.categoryRules.clear(),
      ]);

      // Import using bulkPut (idempotent)
      await Promise.all([
        db.scenarios.bulkPut(backup.scenarios),
        db.categories.bulkPut(backup.categories),
        db.transactions.bulkPut(backup.transactions),
        db.budgetRules.bulkPut(backup.budgetRules),
        db.forecastRules.bulkPut(backup.forecastRules),
        db.savingsGoals.bulkPut(backup.savingsGoals),
        db.balanceAnchors.bulkPut(backup.balanceAnchors ?? []),
        db.categoryRules.bulkPut(backup.categoryRules ?? []),
      ]);

      // Set active scenario
      if (backup.activeScenarioId !== undefined) {
        await db.activeScenario.put({
          id: 'singleton',
          scenarioId: backup.activeScenarioId,
        });
      }

      // Mark as initialised
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
      db.savingsGoals,
      db.balanceAnchors,
      db.categoryRules,
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
        db.savingsGoals.clear(),
        db.balanceAnchors.clear(),
        db.categoryRules.clear(),
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
  const keysToRemove = [STORAGE_KEYS.VIEW_STATE, STORAGE_KEYS.THEME];
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

      // Mark as initialised with demo flag
      await db.appConfig.put({
        id: 'singleton',
        isInitialized: true,
        isDemo: true,
      });
    },
  );
}
