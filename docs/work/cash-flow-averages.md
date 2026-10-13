# Cash Flow sets a dated month against a monthly average in two places

- **Status:** not started. Raised 2026-10-13. The What If half goes away if the
  sliders are removed (`remove-what-if.md`).
- **Goal:** Cash Flow's What If differences and its savings progress compare a
  month's dated figures with dated figures, so a plan identical to the default
  shows no difference.
- **Touches:** `src/routes/cash-flow/index.tsx`, `src/hooks/use-scenario-diff.ts`,
  `src/hooks/use-budget-period-data.ts`.

Noticed 2026-10-13 after step 1 of `bills-set-aside.md` moved a
category's limit to due dates. Both are the mix-up that step removed from the
category rows, in figures it did not touch. **Read from the code, not
reproduced.**

- **The What If differences.** Each difference on Cash Flow is the month's
  expected figure less the default plan's (`cash-flow/index.tsx`, the
  "Scenario deltas" block). The month's income, bills and savings are summed
  by due date (`calculatePeriodCashFlow` in `use-budget-period-data.ts`). The
  default plan's are `defaultTotals` in `src/hooks/use-scenario-diff.ts`,
  which runs every rule through `toMonthlyCents`. So a What If plan identical
  to the default would still show a difference: $825 on bills in the month a
  $900 yearly bill is due, and on income in most months for a fortnightly pay
  (two or three pays against an average of 2.17). The month end difference is
  built from the same four, so it is off too.
  - Not traced: the allowance difference (`budgeted.expected`), and the
    per-row difference in the category list, which uses
    `defaultBudgetByCategoryMonthly`.
  - The Budget page uses the same `defaultTotals` and is right to: both of
    its sides are monthly averages. A fix belongs on the Cash Flow side, by
    expanding the default plan's rules over the month.
- **Savings progress per goal.** The `savingsProgress` memo in
  `cash-flow/index.tsx` sets each goal's real transfers in the month against
  an expected figure averaged with `toMonthlyCents`. It shows on the default
  plan too. A fortnightly transfer reads short in a two-transfer month and
  over in a three-transfer month.
