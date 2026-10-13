# Wording left over from the rename to Bills and Allowances

- **Status:** not started. Left 2026-10-12. `budget-segments.test.ts`, the `prefill`
  prop and the What If fallback names are also listed in `dead-code.md`.
- **Goal:** the wording and leftovers found in the rename audit are fixed or knowingly left.
- **Touches:** `src/components/landing-page.tsx`,
  `src/components/dialogs/forecast-rule-dialog.tsx`,
  `src/contexts/what-if-context.tsx`,
  `src/__tests__/routes/budget-segments.test.ts`.

Left 2026-10-12, from an audit of the rename. Each was already there before
the rename and was deliberately not fixed in it.

- **`budget-segments.test.ts` tests nothing.** It asserts against constants it
  defines itself and never imports `plan-tab.tsx`, so it passes whatever the
  chart shows. Export the segment list from `plan-tab.tsx` and assert on that,
  or delete the test.
- **`ForecastRuleDialog` still takes a `prefill` prop that nothing passes.**
  It edits income and savings, and is only rendered from `plan-tab.tsx`. Its untyped
  branch went in 0.44.2, when it turned out to show for a moment on every
  close. `prefill` and the `PrefillData` type are the same kind of leftover,
  from converting a one-off event into a rule. Remove them.
- **The landing page's check-in card uses wording the app does not have.** It
  reads "Budget pace" and "3 of 4 on track" (`landing-page.tsx`,
  `landing-fixtures.ts`); the check-in says "All categories on track" or "N
  categories over budget". The same page says "your allowances" one section
  before it explains the word. Neither matters much; decide when next
  rewriting that page.
- **Two labels still call an allowance a budget.** "Monthly budget" in the
  setup wizard (`first-run-wizard.tsx:805`) and "Budgeted Spending" in the
  burn-rate chart's legend and series name (`burn-rate-chart.tsx`, four
  places). Seen 2026-10-13.
- **Three comments still say "variable spending"** for the day-to-day figure:
  `cash-flow/index.tsx`, `use-budget-period-data.ts` and
  `burn-rate-chart.tsx`. They match the internal `variable` names, which are
  staying. Undecided whether to reword them.
- **The What If fallback names never render.** `'Bill'` and `'Allowance'` in
  `src/contexts/what-if-context.tsx` fill a per-item list that nothing outside
  the context reads. Remove the list or use it.
- **"Failed to save rule"** in `forecast-rule-dialog.tsx` still uses the
  internal word. It is a rare error path, and no single word covers income
  and savings.
