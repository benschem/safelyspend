# Three undo toasts are hand-rolled beside `useUndoDelete`

- **Status:** not started. Raised 2026-10-13.
- **Goal:** every delete-then-undo toast goes through `useUndoDelete`.
- **Touches:** `src/routes/budget/plan-tab.tsx`, `src/routes/transactions/index.tsx`.

## Why

`useUndoDelete` already provides the delete-then-undo toast, but four call
sites build their own: forecast rule and budget rule in `plan-tab.tsx`,
transaction in `transactions/index.tsx`, and forecast rule in
`delete-forecast-dialog.tsx`. The last is in an unused file that
`dead-code.md` deletes, which leaves three. Moving them onto the hook would
leave one undo implementation. A `refactor:` with no behaviour change.
