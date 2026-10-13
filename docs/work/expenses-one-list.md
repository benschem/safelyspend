# Several allowances in a category, and one Expenses list

- **Status:** not started. Steps written 2026-10-13 and not yet reviewed.
- **Goal:** a category can hold several named allowances, each with its own
  amount and frequency, and the Budget page lists and adds bills and
  allowances as one thing, an expense, with an optional due date.
- **Touches:** `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/import-schema.ts`,
  `src/lib/allowance-items.ts`, `src/hooks/use-budget-rules.ts`,
  `src/hooks/use-adjusted-values.ts`, `src/hooks/use-scenario-diff.ts`,
  `src/contexts/what-if-context.tsx`,
  `src/components/budget/slider-sections.tsx`,
  `src/components/dialogs/category-budget-dialog.tsx`,
  `src/components/dialogs/forecast-rule-dialog.tsx`,
  `src/routes/budget/plan-tab.tsx`, `src/routes/categories/index.tsx`,
  `src/routes/categories/detail.tsx`.

## Why

An allowance split into items has two problems.

- **Total**: the Allowance field becomes a read-only sum but still looks like
  an input, and sits above the items, so people type into it.
- **Frequency**: every item runs at the allowance's frequency. Lashes every
  fortnight and nails every month under one category is not possible.

An item with its own name, amount and frequency is an allowance stored inside
another one. Letting a category hold several allowances removes the computed
total, and the first problem with it.

An allowance is then a bill without a due date, so the Budget page can offer
one list and one dialog, and nobody has to choose between the two before
entering anything.

## Decided

- **Model**: several allowances per category. Items go.
- **Budget page**: one Expenses list and one dialog.
- **Storage**: two tables, as now. An expense with a due date is a forecast
  rule and one without is a budget rule. Merging the tables is a migration and
  an export format change that no user would see.
- **Behaviour**: unchanged, and decided by the due date. With one, an expense
  counts in the month it falls due. Without one, it is averaged to a monthly
  rate (`src/lib/category-limits.ts`). A quarterly or yearly expense builds a
  set-aside reserve only with a due date (`src/lib/bill-set-aside.ts`).

## Proposed

1. **Existing items**: convert each into a named allowance at the old
   allowance's frequency. The alternative is to keep the total as one unnamed
   allowance and re-enter the split by hand. Converting costs little more,
   because the `items` field has to be taken off stored rules either way.
   Re-entering is acceptable to the maintainer: only a handful exist.
2. **Commits**: two. Part 1 is the data change and fixes both problems alone.
   Part 2 is the fold. The upgrade in Part 1 is easier to check, and to back
   out, without the fold on top. One commit was agreed before the fold was
   in scope.
3. **Totals**: the Bills and Spending Allowances cards and chart segments
   stay, and both cards scroll to the Expenses section. The alternative is one
   Expenses figure. Cash Flow, Insights and the category page still use both
   words.
4. **Wording**: "Expenses" for the section. "Add Expense" and "Edit Expense"
   for the dialog. "Due on a set date" for the switch that reveals the day
   pickers. "General spending" for an allowance with no name.
5. **What If**: rekey allowance adjustments from category to allowance, as
   bills are. Part of that is wasted if `remove-what-if.md` goes ahead.
6. **Changing the due date**: an expense can gain or lose its due date when
   edited. It moves between tables and gets a new id.
7. **Dialog footer**: Archive and Delete category go, and Remove is added.
   The two category buttons act on the category the allowance started on,
   which may not be the one showing in the picker. Removing an allowance is
   done by clearing the amount, which nothing on screen says.
8. **Dialog helpers**: the expense dialog keeps all three for every expense.
   The allowance dialog has the average-spending hint and the "Room in
   budget" line, and the bill dialog warns of a similar existing bill.
9. **Names within a category**: must an allowance's name be unique in its
   category? Step 5 of Part 1 matches an allowance to the default plan by
   category and name, and one with no name shows as "General spending", so
   two with the same name, or two with none, cannot be told apart there.
   Recommended: the dialog refuses a second allowance with the same name in
   the category, counting no name as a name. What a merge does with two that
   arrive from two devices is `sync-merge-duplicates.md`.

## Steps

### Part 1: several allowances per category (0.48.0)

1. Confirm in `src/hooks/use-sync.ts` that a pull still replaces the device's
   data. This plan lands before `sync-merge.md`, so there is no merge and no
   tombstone to allow for.
2. Add an optional `name` to `BudgetRule`. Remove `items` and `AllowanceItem`
   from `types.ts`. The import schema adds `name` and keeps accepting `items`,
   so a 0.47.0 backup validates. Bump `CURRENT_DATA_VERSION` to 4.
3. Write one pure function that turns a stored rule with items into a list of
   rules. The first item keeps the rule's id and the others take their item's
   id, so two devices converting the same rule produce the same records. Call
   it from a version 5 Dexie upgrade and from `migrateImportData` for data
   older than version 4. Test the function, the upgrade and the import. Delete
   `src/lib/allowance-items.ts` and its test. The upgrade reads the rules and
   writes them back, because `.modify()`, which version 4 uses, cannot add
   rows.
4. In `use-budget-rules.ts`, `getBudgetForCategory` and `expandedBudgets` add
   up every rule in the category, and `getRuleForCategory` returns a list.
   Remove `setBudgetForCategory`; `addBudgetRule` and `updateBudgetRule` do
   its job.
5. Key `budgetAdjustments` by rule id in `what-if-context.tsx`,
   `use-adjusted-values.ts` and `slider-sections.tsx`, and remove the three
   itemised-allowance guards. `use-scenario-diff.ts` matches an allowance to
   the default plan by category and name, because ids differ between
   scenarios. The What If comparison labels an allowance change with its
   category's name; it takes the allowance's name, falling back to the
   category's.
6. The allowance dialog takes a rule, with one instance in `plan-tab.tsx` for
   add and edit. Fields: category, name (optional), amount, frequency. The
   picker stops hiding categories that already have an allowance. The items
   UI and `focusLimit` go. Rename `CategoryBudgetDialog` and its props for an
   allowance. Changing the category becomes one `updateBudgetRule` call that
   keeps the rule's id, in place of a set on the new category and a delete on
   the old one.
7. The Spending Allowances section groups by category as the Bills section
   does, with the category's total on the heading and one slider per
   allowance. The average-spending hint moves to the heading.
8. Category rows in `plan-tab.tsx` add up every allowance in the category.
9. `src/routes/categories/index.tsx` and `detail.tsx` take every allowance for
   the category.
10. Test two allowances in one category, at different frequencies, for steps
    4, 5, 8 and 9. Those sites compile either way and would undercount.
11. Changelog entry and 0.48.0. Update the domain model in `CLAUDE.md` and any
    reference doc that says one allowance per category.
12. Verify in the browser: upgrade a database holding an itemised allowance
    made on 0.47.1; import a 0.47.0 backup; put a fortnightly and a monthly
    allowance in one category and check the Budget page, Cash Flow, the
    category page and Insights agree; move a slider on each, save, and save
    as a new plan.

### Part 2: one Expenses list (0.49.0)

1. One Expenses section replaces the Bills and Spending Allowances sections
   in `slider-sections.tsx`, grouped by category, each group listing its bills
   and allowances under a heading with the category's total. A bill's row says
   when it is due. `?section=fixed` and `?section=variable` both open it.
2. One expense dialog: category, name, amount, frequency and the due date
   switch. The day pickers move out of `forecast-rule-dialog.tsx` into a
   shared component, and that dialog keeps income and savings. Name is
   required with a due date and optional without. Helpers as agreed under
   Proposed 8.
3. Changing the switch on an existing expense moves it between tables in one
   Dexie transaction and clears any What If adjustment under the old id.
4. Summary cards and chart as agreed under Proposed 3.
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
  - This plan takes data 4 and schema 5. The merge takes data 5 and schema 6.
  - Two allowances in one category is a state the merge can produce. Once
    this plan has landed the app handles it.
  - Moving an expense between tables (Proposed 6) deletes one record and adds
    another. The merge's tombstone step lists it as a delete site.
- `bills-and-allowance-parts.md`: Part 2 does its Budget page item and leaves
  its Cash Flow item.
- `sync-merge-duplicates.md`: decides what a merge does with two allowances
  of one name in a category.
- `remove-what-if.md`: see Proposed 5.
- `review-findings.md`: its forms section rebuilds every dialog, the
  allowance dialog among them.
- `dead-code.md`: lists `budget-prompt-dialog.tsx`, in the same folder as the
  allowance dialog.
- `combobox.md` and `empty-categories.md`: both change the category picker,
  which step 6 of Part 1 also changes.
- `delete-cascades.md`: deleting a category deletes its allowances, and its
  "what uses this category" check would count several per category.
- `demo-personas-budgets.md`: the personas keep one `budgets` entry per
  category.
- `household-personal-money.md`: whether `scope` goes on `BudgetRule` is
  unresolved there, and this plan reshapes that type.

## Checked

Read in the code:

- Unallocated is income less bills less allowances less savings, each
  converted from amount and frequency (`plan-tab.tsx:322-334`). Neither part
  changes it.
- `category-limits.ts` adds up several allowances in a category.
- Only `plan-tab.tsx` calls `CategoryBudgetDialog`, `getRuleForCategory` and
  `setBudgetForCategory`.
- The first-match and overwrite sites named in Part 1.
- A category can be archived and restored from the Categories list
  (`src/routes/categories/index.tsx:208`), so Proposed 7 does not remove the
  only way to archive one.
- Nothing calls `use-multi-period-summary.ts`. `dead-code.md` deletes it.

Seen in a search and not opened: `use-budget-period-data.ts` and
`use-reports-data.ts` appear to add up rules.

Not checked: how sync carries rules and deletes; who else opens
`ForecastRuleDialog` for an expense and what uses its `prefill`; whether the
demo personas or the landing page say one allowance per category.

## Not in this plan

- Merging `budgetRules` into `forecastRules`.
- Removing the What If sliders.
- Spending against one allowance. Transactions are measured against the
  category's total, so there is no "spent on Lashes" figure.
- Both parts on Cash Flow's rows.
- Renaming "bill" and "allowance" outside the Budget page.
