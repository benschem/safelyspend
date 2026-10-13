# Replace the hand-rolled `CreatableSelect` with the shadcn combobox

- **Status:** not started. Noticed 2026-10-11. `empty-categories.md` changes the same picker.
- **Goal:** the category and savings goal pickers are built on the shadcn
  combobox, with "Create" still working on every screen that uses them.
- **Touches:** `src/components/creatable-select.tsx`, `CategorySelect`,
  `SavingsGoalSelect`, `package.json` (adds `cmdk`).

## Why

Noticed 2026-10-11 while putting a category picker into the Add Allowance dialog.

`src/components/creatable-select.tsx` is about 250 lines of its own filtering,
arrow-key handling, highlight tracking, scroll-into-view and ARIA roles.
`CategorySelect` and `SavingsGoalSelect` both wrap it. The conventional shadcn
answer is its Combobox, which is the `Popover` already in `src/components/ui/`
plus `Command`, built on the `cmdk` library. `cmdk` is not installed.

What the swap buys: keyboard and screen-reader behaviour that is someone else's
to maintain, and disabled options for free.

The Add Allowance picker hides categories that already have an allowance, and
a separate `unavailableLabels` prop stops it offering to create one of them by
name. Disabled options would have replaced both. `expenses-one-list.md` lets a
category hold several allowances and stops hiding them, so that reason goes
when it lands, and the prop with it.

"Create X" is not built into `cmdk`; it is an extra
item shown when nothing matches, so that behaviour has to be rebuilt and
checked on every screen that uses the picker: the transaction form, the CSV
import preview, the forecast rule dialog and Add Allowance. Check the 7 day
minimum release age when adding the dependency.
