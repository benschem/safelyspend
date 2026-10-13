# With no plan, the cash card says you are negative and behind

- **Status:** not started. Raised 2026-10-11. Direction not yet decided; the options are below.
- **Goal:** someone who has imported transactions but has no income or bills set
  up sees their real balance and a prompt to add a plan, not a negative
  projection and a "behind" pill.
- **Touches:** `src/routes/cash-flow/index.tsx`,
  `src/components/cash-flow/summary-cards.tsx`,
  `src/hooks/use-budget-period-data.ts`.

Raised 2026-10-11, by the maintainer straight after importing: categories
arrived, no budget or forecast rules existed yet, and Cash Flow showed a
negative projected month end with a "behind" pill. Behind what? **Traced
through the code, not reproduced**, and on the assumption that there were no
forecast rules.

The pill is projected month end minus planned month end (`diff` in
`summary-cards.tsx`). With no rules:

- **The plan is empty, so it says the balance will not move.** Planned month
  end is the starting balance plus expected income, less bills,
  allowances and planned savings (`plannedEnd` in `cash-flow/index.tsx`). All
  four come from rules and are zero.
- **The projection counts no income.** It adds `income.expected`, which sums
  forecast rules only (`expectedIncome` in `calculatePeriodCashFlow`). Pay
  that has already been imported is ignored unless a rule predicted it.
- **The projection treats every expense as variable and scales it up.** Fixed
  costs are whatever expense rules say was due, which is nothing, so rent and
  bills are extrapolated with the groceries (`projectedVariable` in
  `calculatePeriodCashFlow`). On the 11th of a 31-day month that is the
  month's spending times about 2.8.

So the card reads: starting balance, less nearly three times everything spent
so far, with no income. The "behind" figure is that whole projected spend. It
is the first screen a new person sees after importing.

The spending message already handles this state, falling back to "Spent (no
budget set)" when there are no budget rules (`budgetStatus` in
`cash-flow/index.tsx`). The cash card has no equivalent.

Directions, not yet decided:

- **Hide the pill and the projection until there is a plan**, and show the
  actual balance with a prompt to add income and bills. Matches what the
  spending message does. Needs a definition of "has a plan": any forecast rule,
  any budget rule, or an income rule specifically.
- **Say what "behind" is behind.** "Behind plan" at the least. Worth doing
  whatever else is chosen, since the word confused the person who wrote it.
- **Count actual income in the projection**: income received so far plus
  forecast income still to come, as `net.projected` already does
  (`projectedNet` in `calculatePeriodCashFlow`). A change to what the number
  means for everyone, not only new users, so decide it separately.
- **Offer to build rules from the import.** Recurring pay and bills are
  visible in a few months of transactions. Bigger; goes with
  `onboarding-questions.md`.

Not checked: whether the wizard's budget step, which creates budget rules but
no forecast rules (`addBudgetRule` in `SetupWizard`, `first-run-wizard.tsx`),
leaves a new user in a milder version of the same state.
