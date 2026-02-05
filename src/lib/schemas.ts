import { z } from 'zod';

// =============================================================================
// Constants
// =============================================================================

/** Maximum amount in dollars (approximately $1 billion) */
export const MAX_AMOUNT_DOLLARS = 999_999_999;

/** Maximum amount in cents */
export const MAX_AMOUNT_CENTS = MAX_AMOUNT_DOLLARS * 100;

// =============================================================================
// Shared Field Schemas
// =============================================================================

/** Money amount as string input, validated to be a positive number within bounds */
export const moneyInputSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num > 0 && num <= MAX_AMOUNT_DOLLARS;
    },
    {
      message: `Amount must be between $0.01 and $${MAX_AMOUNT_DOLLARS.toLocaleString()}`,
    },
  );

/** Optional money amount (can be empty string or positive number within bounds) */
export const optionalMoneyInputSchema = z.string().refine(
  (val) => {
    if (val === '') return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= MAX_AMOUNT_DOLLARS;
  },
  {
    message: `Amount must be between $0 and $${MAX_AMOUNT_DOLLARS.toLocaleString()}`,
  },
);

/** ISO date string (YYYY-MM-DD) */
export const dateSchema = z.string().min(1, 'Date is required');

/** Optional ISO date string */
export const optionalDateSchema = z.string().optional();

/** Non-empty trimmed string */
export const requiredStringSchema = z.string().min(1, 'This field is required');

/** Cadence type */
export const cadenceSchema = z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly']);

/** Transaction type */
export const transactionTypeSchema = z.enum(['income', 'expense', 'savings', 'adjustment']);

/** Forecast type */
export const forecastTypeSchema = z.enum(['income', 'expense', 'savings']);

// =============================================================================
// Transaction Schemas
// =============================================================================

export const transactionFormSchema = z
  .object({
    type: transactionTypeSchema,
    date: dateSchema,
    description: requiredStringSchema,
    amount: moneyInputSchema,
    categoryId: z.string(),
    savingsGoalId: z.string(),
    notes: z.string(),
  })
  .refine(
    (data) => {
      if (data.type === 'savings') {
        return data.savingsGoalId.length > 0;
      }
      return true;
    },
    {
      message: 'Savings goal is required',
      path: ['savingsGoalId'],
    },
  );

export type TransactionFormData = z.infer<typeof transactionFormSchema>;

// =============================================================================
// Savings Goal Schemas
// =============================================================================

export const savingsGoalFormSchema = z.object({
  name: requiredStringSchema,
  targetAmount: moneyInputSchema,
  startingBalance: optionalMoneyInputSchema,
  deadline: optionalDateSchema,
});

export type SavingsGoalFormData = z.infer<typeof savingsGoalFormSchema>;

export const savingsGoalEditSchema = z.object({
  name: requiredStringSchema,
  targetAmount: moneyInputSchema,
  deadline: optionalDateSchema,
});

export type SavingsGoalEditData = z.infer<typeof savingsGoalEditSchema>;

// =============================================================================
// Forecast Rule Schemas
// =============================================================================

export const forecastRuleFormSchema = z
  .object({
    type: forecastTypeSchema,
    description: requiredStringSchema,
    amount: moneyInputSchema,
    cadence: cadenceSchema,
    dayOfMonth: z.string(),
    dayOfWeek: z.string(),
    monthOfYear: z.string(),
    monthOfQuarter: z.string(),
    categoryId: z.string(),
    savingsGoalId: z.string(),
  })
  .refine(
    (data) => {
      if (data.type === 'savings') {
        return data.savingsGoalId.length > 0;
      }
      return true;
    },
    {
      message: 'Savings goal is required',
      path: ['savingsGoalId'],
    },
  );

export type ForecastRuleFormData = z.infer<typeof forecastRuleFormSchema>;

// =============================================================================
// Scenario Schemas
// =============================================================================

export const scenarioFormSchema = z.object({
  name: requiredStringSchema,
  description: z.string(),
  copyFromId: z.string(),
});

export type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

export const scenarioEditSchema = z.object({
  name: requiredStringSchema,
  description: z.string(),
});

export type ScenarioEditData = z.infer<typeof scenarioEditSchema>;

// =============================================================================
// Category Schemas
// =============================================================================

export const categoryFormSchema = z.object({
  name: requiredStringSchema,
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert string amount to integer cents with overflow protection.
 * Throws if amount exceeds safe bounds.
 */
export function parseCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed > MAX_AMOUNT_DOLLARS) {
    throw new Error(`Amount exceeds maximum of $${MAX_AMOUNT_DOLLARS.toLocaleString()}`);
  }
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Amount precision error');
  }
  return cents;
}
