import { db } from '@/lib/db';
import type { Expense, NewExpense } from '@/lib/expenses';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

/**
 * Replace an expense with one of the other kind. A bill that loses its due
 * date becomes an allowance, and an allowance that gains one becomes a bill.
 *
 * Bills and allowances are stored in different tables, so the old record is
 * deleted and the new one added under a new id. Both writes are in one
 * transaction: a failure leaves the original in place.
 */
export async function replaceExpenseWithOtherKind(
  expense: Expense,
  replacement: NewExpense,
): Promise<void> {
  if (expense.kind === replacement.kind) {
    throw new Error('An expense can only be replaced by one of the other kind');
  }

  const timestamp = now();
  const baseFields = {
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // The base fields go last so the new id and timestamps always win, even if
  // the data was built from an existing rule and still carries that rule's
  await db.transaction('rw', [db.budgetRules, db.forecastRules], async () => {
    if (replacement.kind === 'bill') {
      await db.budgetRules.delete(expense.rule.id);
      await db.forecastRules.add({ ...replacement.data, ...baseFields });
    } else {
      await db.forecastRules.delete(expense.rule.id);
      await db.budgetRules.add({ ...replacement.data, ...baseFields });
    }
  });
}
