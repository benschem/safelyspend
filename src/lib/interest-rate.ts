import type { SavingsGoal } from './types';

/**
 * Returns the effective annual interest rate for a goal on a given date.
 * Walks the schedule to find the most recent entry on or before `date`.
 * Falls back to goal.annualInterestRate if no schedule entry applies.
 */
export function getEffectiveRate(goal: SavingsGoal, date: string): number {
  if (!goal.interestRateSchedule?.length) {
    return goal.annualInterestRate ?? 0;
  }

  // Schedule is sorted ascending by effectiveDate
  let rate = goal.annualInterestRate ?? 0;
  for (const entry of goal.interestRateSchedule) {
    if (entry.effectiveDate <= date) {
      rate = entry.annualRate;
    } else {
      break;
    }
  }
  return rate;
}
