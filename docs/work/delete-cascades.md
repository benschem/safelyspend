# Deleting a category, goal or scenario leaves references behind, and undo restores only the row

- **Status:** not started. Traced through the code, not clicked through. One
  question is open, under Proposed.
- **Goal:** deleting a category, savings goal or scenario removes or unlinks
  everything that pointed at it, the confirmation says what will go, and
  undoing a category delete puts all of it back.
- **Touches:** `src/hooks/use-categories.ts`, `src/hooks/use-savings-goals.ts`,
  `src/hooks/use-scenarios.ts`, `src/hooks/use-undo-delete.ts`,
  `src/routes/categories/index.tsx`, `src/routes/categories/detail.tsx`.

## Proposed

- **A category that still has bills: refuse the delete, or unlink the bills?**
  The first section below says refuse. The second says clear `categoryId` on
  its forecast rules, which is what the sync merge's relations list does.
  Recommended: refuse. An expense rule needs a category (`types.ts:79`), so
  unlinking leaves a rule the types do not allow. If refusing is chosen, the
  merge still needs its own answer for a delete that arrives from another
  device.
- **Refuse to archive a category that still has bills or allowances?**
  Recommended: yes, with the same "what uses this category" check as delete.
  Archiving then only hides a category from the pickers and frees its name.
  Today it also hides the category's allowances on the Budget page and leaves
  its bills and allowances out of the Budget totals (`plan-tab.tsx`), while
  Cash Flow keeps counting them: nothing in `use-budget-period-data.ts`,
  `category-limits.ts` or `bill-set-aside.ts` reads `isArchived`. Read in the
  code on 2026-10-13, not run. With the guard, the archived filters in
  `plan-tab.tsx`, `src/lib/expenses.ts` and `cash-flow/index.tsx` have nothing
  left to act on and can go. A bill already on an archived or deleted category
  stays listed in the Expenses section so it can be removed. Still to decide:
  what happens to categories archived before the guard that have rules.

## Deleting a category can leave rules behind, or take them without saying

`deleteCategory` (`src/hooks/use-categories.ts:35`) unlinks the category's
transactions and deletes its budget rules, in every scenario. It does not touch
forecast rules, so a bill on a deleted category keeps a `categoryId`
that matches nothing. What each screen then shows for that rule is not checked.

The Categories page guards against this: its bin is disabled while the category
has a transaction, an allowance or a bill. Three holes remain:

- **Other scenarios.** The page only counts the active one. Its Allowance and Bills
  columns come from `useBudgetRules` and `useForecasts`, which both filter to
  the active scenario. A category used only in a What If scenario reads as
  empty, the bin is enabled, and deleting it removes that scenario's allowance
  and orphans its bills.
- **The detail page.** Its Delete checks transactions only (`canDelete`,
  `routes/categories/detail.tsx:216`). A category with an allowance or a
  bill and no transactions can be deleted from there.
- **Undo.** It does not bring the allowance back. `restoreCategory` puts back the
  category row alone, so the budget rules deleted with it are gone. Reachable
  from the detail page today, and from the list through the first hole.

Fix, in one place so both screens agree: a single "what uses this category"
check across every scenario, used by the list and the detail page, with delete
allowed only when the answer is nothing. Then decide whether `deleteCategory`
should refuse on its own or clear `categoryId` on forecast rules as it does for
transactions. An expense rule needs a category (`types.ts:79`), so refusing is
the safer of the two.

## Deleting a category or savings goal leaves references behind

Found 2026-10-13 while tracing references for the sync merge. Does not depend
on sync, so it is its own `fix:`.

- `deleteCategory` handles transactions and budget rules only. Make it also
  null `categoryId` on forecast rules and delete the category's import rules.
- `deleteCategory` finds the category's budget rules with
  `db.budgetRules.where('categoryId')` (`use-categories.ts:67`), and
  `categoryId` is not an index on that table: `db.ts` indexes `id` and
  `scenarioId`. Dexie rejects a `where()` on a field with no index, so the
  delete may fail after the transactions are already unlinked, and the three
  writes are not in one transaction. Read in the code on 2026-10-13, not run,
  and no test covers `deleteCategory`. Use `filter()`, or add the index in a
  new schema version, and wrap the writes in one `db.transaction`.
- `deleteSavingsGoal` handles transactions and anchors only. Make it also
  delete forecast rules for that goal.
- `deleteSavingsGoal` (`use-savings-goals.ts:86-140`, read 2026-10-13) makes
  four writes outside a transaction: the closing withdrawal, unlinking the
  goal's transactions, deleting its anchors and deleting the goal. A failure
  part way leaves the withdrawal without the delete. Wrap them in one
  `db.transaction`.
- `deleteScenario` deletes none of the scenario's budget or forecast rules.
- These match the outcomes in the merge's relations list, so a local delete
  and a merged delete leave the same result. Until this lands the merge's
  orphan sweep cleans them up, but only at a sync.
- Check what the delete confirmation tells the user it will remove, and update
  it to match. The categories list already builds that summary.
- Once the merge has landed, the new deletes go through `deleteWithTombstone`
  and the new edits stamp `updatedAt`.

## Undoing a category delete only restores the category row

The transactions it
uncategorised and the rules it deleted do not come back. Its own `fix:`.

- Have `deleteCategory` return a snapshot of what it changed: the category,
  the ids of the transactions and forecast rules it uncategorised, and the
  budget rules and import rules it deleted. `restoreCategory` takes that
  snapshot and puts all of it back, stamping `updatedAt` on every row.
- `useUndoDelete` passes the captured item to `restoreItem` today. It needs to
  pass on whatever the delete returned instead.
- The other four undo paths do not have this gap: forecast rule and budget
  rule in `plan-tab.tsx`, transaction in `transactions/index.tsx`, and
  forecast rule in `delete-forecast-dialog.tsx`. Each deletes a single row
  that nothing else references. Category is the only delete with both a
  cascade and an undo; scenarios, savings goals, anchors and import rules have
  no undo.
