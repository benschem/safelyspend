# One Expenses list for bills and allowances

- **Status:** not started. Steps written 2026-10-13 and not yet reviewed.
  Several allowances per category, which this builds on, landed in 0.48.0.
- **Goal:** the Budget page lists and adds bills and allowances as one thing,
  an expense, with an optional due date.
- **Touches:** `src/components/budget/slider-sections.tsx`,
  `src/components/dialogs/allowance-dialog.tsx`,
  `src/components/dialogs/forecast-rule-dialog.tsx`,
  `src/routes/budget/plan-tab.tsx`, `src/contexts/what-if-context.tsx`.

## Why

A category can hold several named allowances, each with its own amount and
frequency. An allowance is then a bill without a due date, so the Budget page
can offer one list and one dialog, and nobody has to choose between the two
before entering anything.

## Decided

- **Budget page**: one Expenses list and one dialog.
- **Storage**: two tables, as now. An expense with a due date is a forecast
  rule and one without is a budget rule. Merging the tables is a migration and
  an export format change that no user would see.
- **Behaviour**: unchanged, and decided by the due date. With one, an expense
  counts in the month it falls due. Without one, it is averaged to a monthly
  rate (`src/lib/category-limits.ts`). A quarterly or yearly expense builds a
  set-aside reserve only with a due date (`src/lib/bill-set-aside.ts`).

## Proposed

1. **Totals**: the Bills and Spending Allowances cards and chart segments
   stay, and both cards scroll to the Expenses section. The alternative is one
   Expenses figure. Cash Flow, Insights and the category page still use both
   words.
2. **Wording**: "Expenses" for the section. "Add Expense" and "Edit Expense"
   for the dialog. "Due on a set date" for the switch that reveals the day
   pickers. An allowance with no name already shows as "General spending"
   (`src/lib/allowances.ts`), which is also open to change here.
3. **Changing the due date**: an expense can gain or lose its due date when
   edited. It moves between tables and gets a new id.
4. **Dialog footer**: Archive and Delete category go, and Remove is added.
   The two category buttons act on the category the allowance started on,
   which may not be the one showing in the picker. Removing an allowance is
   done by clearing the amount, which nothing on screen says.
5. **Dialog helpers**: the expense dialog keeps all three for every expense.
   The allowance dialog has the average-spending hint and the "Room in
   budget" line, and the bill dialog warns of a similar existing bill.

## Steps

1. One Expenses section replaces the Bills and Spending Allowances sections
   in `slider-sections.tsx`, grouped by category, each group listing its bills
   and allowances under a heading with the category's total. A bill's row says
   when it is due. `?section=fixed` and `?section=variable` both open it.
2. One expense dialog: category, name, amount, frequency and the due date
   switch. The day pickers move out of `forecast-rule-dialog.tsx` into a
   shared component, and that dialog keeps income and savings. Name is
   required with a due date and optional without. Helpers as agreed under
   Proposed 5.
3. Changing the switch on an existing expense moves it between tables in one
   Dexie transaction and clears any What If adjustment under the old id.
4. Summary cards and chart as agreed under Proposed 1.
5. Remove the help line in each dialog that points to the other one.
6. Changelog entry and 0.49.0. Remove the Budget page item from
   `bills-and-allowance-parts.md`. Check `bills-rename-loose-ends.md` for
   wording this changes.
7. Verify in the browser: add one of each; flip an expense both ways and check
   Cash Flow moves it between dated and averaged; check the page totals are
   equal before and after; check a quarterly expense leaves the set-aside
   figure when it loses its due date.

## Overlap

- `sync-merge.md`: this plan lands first, decided by the maintainer on
  2026-10-13.
  - Data is at version 4 and the schema at 5. The merge takes data 5 and
    schema 6.
  - Moving an expense between tables (Proposed 3) deletes one record and adds
    another. The merge's tombstone step lists it as a delete site.
- `bills-and-allowance-parts.md`: this plan does its Budget page item and
  leaves its Cash Flow item.
- `sync-merge-duplicates.md`: decides what a merge does with two allowances
  of one name in a category. The allowance dialog refuses to make them.
- `remove-what-if.md`: removes the sliders this plan rearranges.
- `review-findings.md`: its forms section rebuilds every dialog, the
  allowance dialog among them.
- `dead-code.md`: lists `budget-prompt-dialog.tsx`, in the same folder as the
  allowance dialog.
- `combobox.md` and `empty-categories.md`: both change the category picker
  the expense dialog uses.
- `delete-cascades.md`: deleting a category deletes its allowances, and its
  "what uses this category" check counts several per category.
- `demo-personas-budgets.md`: the personas keep one `budgets` entry per
  category.
- `household-personal-money.md`: whether `scope` goes on `BudgetRule` is
  unresolved there.

## Checked

Read in the code:

- Unallocated is income less bills less allowances less savings, each
  converted from amount and frequency (`plan-tab.tsx`). This plan does not
  change it.
- Only `plan-tab.tsx` opens `ForecastRuleDialog` and `AllowanceDialog`.
- A category can be archived and restored from the Categories list
  (`src/routes/categories/index.tsx`), so Proposed 4 does not remove the
  only way to archive one.

Not checked:

- What uses `ForecastRuleDialog`'s `prefill`.
- Whether the demo personas or the landing page say one allowance per
  category.
- The version 5 Dexie upgrade has no automated test, because the project has
  no in-memory IndexedDB. Its conversion function is tested, and the upgrade
  was run once in a browser on 2026-10-13 against a hand-built version 4
  database.
- Several allowances in one category on Insights, and saving What If
  adjustments to them, have not been tried in a browser.

## Not in this plan

- Merging `budgetRules` into `forecastRules`.
- Removing the What If sliders.
- Spending against one allowance. Transactions are measured against the
  category's total, so there is no "spent on Lashes" figure.
- Both parts on Cash Flow's rows.
- Renaming "bill" and "allowance" outside the Budget page.
