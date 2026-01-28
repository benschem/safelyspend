import { z } from 'zod';

// =============================================================================
// Shared Field Schemas
// =============================================================================

/** Money amount as string input, validated to be a positive number */
export const moneyInputSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Amount must be greater than 0',
  });

/** Optional money amount (can be empty string or positive number) */
export const optionalMoneyInputSchema = z
  .string()
  .refine((val) => val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
    message: 'Amount must be 0 or greater',
  });

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
    paymentMethod: z.string(),
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
// Forecast Event Schemas
// =============================================================================

export const forecastEventFormSchema = z
  .object({
    type: forecastTypeSchema,
    date: dateSchema,
    description: requiredStringSchema,
    amount: moneyInputSchema,
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

export type ForecastEventFormData = z.infer<typeof forecastEventFormSchema>;

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
// First Run Wizard Schemas
// =============================================================================

export const firstRunSetupSchema = z.object({
  spendingBalance: optionalMoneyInputSchema,
  balanceDate: dateSchema,
});

export type FirstRunSetupData = z.infer<typeof firstRunSetupSchema>;

// =============================================================================
// Utilities
// =============================================================================

/** Convert string amount to integer cents */
export function parseCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
