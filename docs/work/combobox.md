# Replace the hand-rolled `CreatableSelect` with the shadcn combobox

- **Status:** not started. Noticed 2026-10-11. `empty-categories.md` changes the same picker.
- **Goal:** the category and savings goal pickers are built on the shadcn
  combobox, with "Create" still working on every screen that uses them.
- **Touches:** `src/components/creatable-select.tsx`, `CategorySelect`,
  `SavingsGoalSelect`, `package.json` (adds `cmdk`).

## Why

`src/components/creatable-select.tsx` is about 250 lines of its own filtering,
arrow-key handling, highlight tracking, scroll-into-view and ARIA roles.
`CategorySelect` and `SavingsGoalSelect` both wrap it. The conventional shadcn
answer is its Combobox, which is the `Popover` already in `src/components/ui/`
plus `Command`, built on the `cmdk` library. `cmdk` is not installed.

What the swap buys: keyboard and screen-reader behaviour that is someone else's
to maintain. Disabled options come with it, though no picker hides or
disables an option today.

"Create X" is not built into `cmdk`; it is an extra
item shown when nothing matches, so that behaviour has to be rebuilt and
checked on every screen that uses the picker: the transaction form, the CSV
import preview, the forecast rule dialog and Add Expense. Check the 7 day
minimum release age when adding the dependency.
