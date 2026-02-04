import { z } from 'zod';
import { CURRENT_DATA_VERSION } from './db';
import { debug } from './debug';

// =============================================================================
// Import Schema Validation
// =============================================================================
// Strict validation for imported JSON data to prevent malformed/malicious data
// =============================================================================

// Re-export for convenience
export { CURRENT_DATA_VERSION };

// Base entity schema - relaxed ID validation for legacy data
const baseEntitySchema = z.object({
  id: z.string().min(1),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Cadence enum
const cadenceSchema = z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly']);

// Scenario
const scenarioSchema = baseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean(),
});

// Category
const categorySchema = baseEntitySchema.extend({
  name: z.string().min(1).max(100),
  isArchived: z.boolean(),
});

// Budget Rule
const budgetRuleSchema = baseEntitySchema.extend({
  scenarioId: z.string().min(1),
  categoryId: z.string().min(1),
  amountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  cadence: cadenceSchema,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfQuarter: z.number().int().min(0).max(2).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Forecast Rule
const forecastRuleSchema = baseEntitySchema.extend({
  scenarioId: z.string().min(1),
  type: z.enum(['income', 'expense', 'savings']),
  amountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  cadence: cadenceSchema,
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(0).max(11).optional(),
  monthOfQuarter: z.number().int().min(0).max(2).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().max(500),
  categoryId: z.string().nullable(),
  savingsGoalId: z.string().nullable(),
  notes: z.string().max(1000).optional(),
  excludedDates: z.array(z.string()).optional(), // v1.0: Dates to skip when expanding
});

// Transaction
// Note: amountCents can be negative for savings withdrawals
const transactionSchema = baseEntitySchema.extend({
  type: z.enum(['income', 'expense', 'savings', 'adjustment']),
  date: z.string(),
  amountCents: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  description: z.string().max(500),
  categoryId: z.string().nullable(),
  savingsGoalId: z.string().nullable(),
  notes: z.string().max(1000).optional(),
  importFingerprint: z.string().max(500).optional(),
  importSource: z.string().max(50).optional(),
  importedAt: z.string().optional(),
});

// Interest Rate Schedule Entry
const interestRateEntrySchema = z.object({
  effectiveDate: z.string(),
  annualRate: z.number().min(0).max(100),
});

// Savings Goal
const savingsGoalSchema = baseEntitySchema.extend({
  name: z.string().min(1).max(100),
  targetAmountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  deadline: z.string().optional(),
  annualInterestRate: z.number().min(0).max(100).optional(),
  compoundingFrequency: z.enum(['daily', 'monthly', 'yearly']).optional(),
  isEmergencyFund: z.boolean().optional(),
  interestRateSchedule: z.array(interestRateEntrySchema).max(100).optional(),
});

// Balance Anchor
const balanceAnchorSchema = baseEntitySchema.extend({
  date: z.string(),
  balanceCents: z.number().int().max(Number.MAX_SAFE_INTEGER),
  label: z.string().max(100).optional(),
});

// Savings Anchor
const savingsAnchorSchema = baseEntitySchema.extend({
  savingsGoalId: z.string().min(1),
  date: z.string(),
  balanceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  label: z.string().max(100).optional(),
});

// Category Rule
const categoryRuleSchema = baseEntitySchema.extend({
  name: z.string().min(1).max(100),
  matchField: z.enum(['description', 'payee']),
  matchType: z.enum(['contains', 'startsWith', 'equals']),
  matchValue: z.string().max(200),
  categoryId: z.string().min(1),
  amountMinCents: z.number().int().min(0).optional(),
  amountMaxCents: z.number().int().min(0).optional(),
  transactionType: z.enum(['income', 'expense']).optional(),
  priority: z.number().int().min(0),
  enabled: z.boolean(),
});

// Full budget data schema with reasonable limits
export const budgetDataSchema = z.object({
  // Version for future migrations
  version: z.number().int().min(1).optional(),
  exportedAt: z.string().optional(),

  // Core data
  scenarios: z.array(scenarioSchema).max(100),
  categories: z.array(categorySchema).max(500),
  transactions: z.array(transactionSchema).max(100000),
  budgetRules: z.array(budgetRuleSchema).max(1000),
  forecastRules: z.array(forecastRuleSchema).max(1000),
  // Deprecated: forecastEvents removed in v2, but accept for backward compatibility
  forecastEvents: z.array(z.unknown()).max(10000).optional(),
  savingsGoals: z.array(savingsGoalSchema).max(100),
  balanceAnchors: z.array(balanceAnchorSchema).max(100).optional(),
  savingsAnchors: z.array(savingsAnchorSchema).max(1000).optional(),
  categoryRules: z.array(categoryRuleSchema).max(500).optional(),

  // Optional state
  activeScenarioId: z.string().nullable().optional(),
});

export type ValidatedBudgetData = z.infer<typeof budgetDataSchema>;

/**
 * Sanitize object to prevent prototype pollution attacks.
 * Removes __proto__, constructor, and prototype keys recursively.
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block prototype pollution keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      debug.warn('security', `Blocked dangerous key in import: ${key}`);
      continue;
    }
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Migrate imported data from older versions to current format.
 * This ensures backward compatibility with exports from older app versions.
 */
function migrateImportData(data: ValidatedBudgetData): ValidatedBudgetData {
  const version = data.version ?? 1;

  // Already at current version, no migration needed
  if (version >= CURRENT_DATA_VERSION) {
    return data;
  }

  debug.info('import', `Migrating import data from version ${version} to ${CURRENT_DATA_VERSION}`);

  // Clone to avoid mutating input
  const { forecastEvents, ...migrated } = { ...data };

  // v1 -> v2: forecastEvents removed (already stripped above)
  if (version < 2 && forecastEvents && Array.isArray(forecastEvents) && forecastEvents.length > 0) {
    debug.info('import', `Discarding ${forecastEvents.length} forecastEvents (removed in v2)`);
  }

  // Ensure savingsAnchors array exists (added in v3)
  if (!migrated.savingsAnchors) {
    migrated.savingsAnchors = [];
  }

  // Update version to current
  migrated.version = CURRENT_DATA_VERSION;

  return migrated;
}

/**
 * Validate imported JSON data against schema.
 * Returns validated data or throws ZodError.
 */
export function validateImport(rawData: unknown): ValidatedBudgetData {
  // First sanitize to prevent prototype pollution
  const sanitized = sanitizeObject(rawData);

  // Then validate against schema
  const validated = budgetDataSchema.parse(sanitized);

  // Migrate to current version if needed
  return migrateImportData(validated);
}

/**
 * Get a human-readable error message from a ZodError.
 */
export function getImportErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'The file doesn\u2019t appear to be a valid budget export. Make sure the file was exported from this app.';
  }

  const path = firstIssue.path.join(' \u203A ');
  if (path) {
    return `The import file contains invalid data (${path}: ${firstIssue.message}). Make sure the file was exported from this app.`;
  }
  return firstIssue.message;
}
