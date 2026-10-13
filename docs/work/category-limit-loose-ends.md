# Loose ends from moving every screen to one category limit

- **Status:** not started. Left 2026-10-12.
- **Goal:** the gaps left by that change are closed: tests for the untested
  limits and named arguments for the `calculate…` functions.
- **Touches:** `src/hooks/use-reports-data.ts`, `src/hooks/use-budget-period-data.ts`,
  `src/routes/categories/detail.tsx`, `src/lib/category-limits.ts`.

Left 2026-10-12, from an audit of the change that made the category page, the
over/on-track counts, Insights and the check-in's "Top spending" take a
category's limit from `buildMonthlyLimitsByCategory` in
`src/lib/category-limits.ts`. Each was found and deliberately not done then.

- **Insights' budget line and the category page have no test.**
  `calculateSummary`, `calculatePeriodSpending` and `calculatePeriodCashFlow`
  are now exported and covered in
  `src/__tests__/hooks/use-budget-period-data.test.ts`. Still untested:
  `monthlyBudgetComparison`, which sits inside a `useMemo` in
  `src/hooks/use-reports-data.ts` and has to be pulled out into a function
  first, and the limit on `src/routes/categories/detail.tsx`.
- **Rule start and end dates are honoured in the helper only.** No dialog sets
  them; they arrive through import, so this is rare. For such data an ended
  allowance drops out of Cash Flow. `src/hooks/use-multi-period-summary.ts`
  adds up every rule whatever its dates, but nothing calls it and
  `dead-code.md` deletes it. Not checked: whether the Budget page's totals
  in `plan-tab.tsx` honour rule dates. The category page's chart drew this
  month's limit across all twelve months; fixed in 0.44.6, which gives each
  month its own limit.
- **`calculateSummary` takes 11 positional arguments**, three of them adjacent
  date strings, so swapping two would still type-check. The other `calculate…`
  functions in that file have the same shape, and `calculatePeriodCashFlow`
  now takes 12. An options object fixes it; do them together. The tests wrap
  each call in a helper that takes named inputs, which is the shape to copy.
- **The allowance half of the limit is only exact in month view.** Bills were
  fixed in 0.44.6: the helper is given the whole range and returns every bill
  due in it. The allowance is still a monthly figure that the hook multiplies
  by 3 or 12 for a quarter or year, so an allowance active for one day of a
  year would count for all twelve months. Nothing passes a view mode other
  than `month` today. The planned totals in the same file use the helper and
  the multiplier too, so they share the approximation.
- **The comment at the top of `summary-cards.tsx` is out of date.** Noticed
  2026-10-13. It says the landing page feeds the two cards a fixture; only
  `cash-flow/index.tsx` imports them. Reword it, or drop the claim.
- **Three checks for "is this rule active in a range".** `isRuleActiveBetween`
  is a yes or no; the two in `use-forecasts.ts` and `use-budget-rules.ts` are
  clamps that work out an effective start and end, so it cannot replace them
  as they stand. All three now treat an empty date as no date. Left alone on
  purpose; only worth merging if expansion is restructured.
