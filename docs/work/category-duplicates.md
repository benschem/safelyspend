# Two categories can still end up with the same name

- **Status:** not started. Mostly fixed 2026-10-12; what is left is below.
- **Goal:** restoring an archived category cannot create a second active category
  of the same name, and existing duplicates can be merged.
- **Touches:** `src/hooks/use-categories.ts`, `src/routes/categories/index.tsx`,
  `src/routes/categories/detail.tsx`,
  `src/components/dialogs/category-budget-dialog.tsx`.

Noticed 2026-10-11, mostly fixed 2026-10-12. `addCategory` and `updateCategory`
in `src/hooks/use-categories.ts` now refuse a name another active category
has, ignoring case and surrounding spaces, and the rename dialog shows the
message. Archived categories are ignored on both sides, matching `getOrCreate`.
Covered by `src/__tests__/hooks/use-categories.test.ts`.

What is left:

- **Restoring an archived category onto a taken name.** Archive "Groceries",
  create a new "Groceries", restore the old one: two active categories of the
  same name. The check runs on a rename, not on a restore. Closing it means the
  archive and restore buttons have to show an error, and none of the three
  callers catches one today: the Categories list, the category detail page and
  `category-budget-dialog.tsx`.
- **Existing duplicates.** Anyone who used the old Add Category dialog may
  already have them. The Categories list shows them side by side, and nothing
  merges them. Merge has to repoint transactions, budget rules, forecast rules
  and import rules, and decide what happens when both have an allowance.
- **A CSV import can bring back an old name.** Imports match categories by name
  (`bulkGetOrCreate`), so after renaming "Food" to "Groceries" a file that
  still says "Food" makes a new "Food". Arguably correct, and import rules are
  the existing way to steer it. Left alone on purpose.
- **Not checked:** whether two household members who each create the same name
  on their own device both keep theirs after a sync. A check in the hook cannot
  stop that.
