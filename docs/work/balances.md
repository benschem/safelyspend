# Balance maths has no single home, and Net Wealth ignores savings anchors

- **Status:** in progress. Steps 1 to 4 are done and step 5 is next. Steps written
  and decisions made 2026-10-13 at 0.49.1.
- **Goal:** one tested module works out a cash balance and a savings goal's
  balance as of a date, from anchors and transactions, and every screen uses
  it.
- **Touches:** a new `src/lib/balances.ts` and
  `src/__tests__/lib/balances.test.ts`, `src/hooks/use-balance-anchors.ts`,
  `src/hooks/use-savings-anchors.ts`, `src/hooks/use-cash-surplus.ts`,
  `src/hooks/use-savings-goals.ts`, `src/hooks/use-reports-data.ts`,
  `src/routes/cash-flow/index.tsx`, `src/routes/net-wealth.tsx`,
  `src/routes/insights.tsx`, `src/components/check-in-wizard.tsx`,
  `src/lib/types.ts`, `docs/reference/ARCHITECTURE.md`. Deleted:
  `src/__tests__/lib/anchors.test.ts`.

## Why

A balance is the latest anchor on or before a date plus the transactions after
it. That rule is written out wherever a balance is needed. The copies have
drifted, and Net Wealth's savings figures never read savings anchors at all.

Everything in this section was read in the code on 2026-10-13. None of it was
run.

### Figures that are wrong

- **Net Wealth ignores savings anchors.** `totalSavings` and
  `emergencyFundBalance` in `net-wealth.tsx` sum every savings transaction.
  The first-run wizard and the goal dialog's "already saved" option both
  store a starting balance as a savings anchor, so a goal set up either way
  counts as $0 towards net wealth while the Savings page shows its balance.
- **A range that ends before today starts too high.** `startingBalance` in
  the `savingsByGoal` memo of `use-reports-data.ts` is today's balance less
  the transactions in the range, so transactions after the range ends are
  counted as saved before it began.

### Copies that disagree

- **Cash counts the anchor's own day and savings does not.** Cash takes
  transactions with `date >= anchor.date`; savings takes `date > anchor.date`.
  `BalanceAnchor` and `SavingsAnchor` in `types.ts` both say "balance as of
  START of this date", which is the cash rule. The first-run wizard tells
  people to enter balances as of the starting date and transactions "from
  this date onwards", so under the savings rule a transfer on the starting
  date is dropped.
- **Cash stops at today and savings does not.** Every cash copy takes
  transactions up to the date asked for. No savings copy has an upper bound,
  so a savings transaction dated in the future is already in the balance.
- **The check-in's cash estimate with no anchor leaves savings out.** With an
  anchor, a savings transfer lowers cash. In the confirm-balance step of
  `check-in-wizard.tsx`, the fallback for no anchor subtracts expenses only.
  Confirming that step saves the estimate as an anchor.

### The copies

- **Cash, five times:** `useCashSurplus`, `currentBalance` in
  `net-wealth.tsx`, `balanceInfo` in `insights.tsx`, and two `currentBalance`
  memos in `check-in-wizard.tsx`.
- **Savings, six times:** the `savingsProgress` and `savingsByGoal` memos in
  `use-reports-data.ts`, `deleteSavingsGoal` in `use-savings-goals.ts`,
  `totalSavingsBalance` in `cash-flow/index.tsx`, and
  `useSavingsGoalsWithBalance` and `savingsData` in `check-in-wizard.tsx`.
- **Finding the active anchor, three times:** `getActiveAnchor` in each anchor
  hook, and inline in `deleteSavingsGoal`.
- **`anchors.test.ts` tests functions defined inside the test file.** Its
  `calculateBalance` uses the cash signs with the savings boundary, which
  matches no copy in the app.

## Decided

- **The maths is pure functions in `src/lib/balances.ts`**, taking arrays of
  anchors and transactions. No new hook: every caller already holds both.
- **A cash balance before the first anchor stays `null`.** Insights already
  says "Cash shown only from" that anchor's date.
- **A savings balance with no anchor is the sum of the goal's transactions**
  up to the date, as now.
- **Anchors mean the start of the day, for cash and savings alike.** A
  transaction on the anchor's date counts. This matches the comments in
  `types.ts`, the first-run wizard's wording and the cash code, and changes
  savings. The accepted cost: the check-in and Settings default an anchor's
  date to today, and someone who types in the balance their bank shows now,
  having already imported today's transactions, counts those twice. That is
  already true of cash.
- **The check-in's no-anchor estimate subtracts savings transfers**, like
  every other cash figure. It is the sum of `cashEffectCents` over every
  transaction up to today.
- **Interest is left out entirely.** Interest forecasts keep ignoring savings
  anchors until interest is done as one piece of work. See Not in this plan.

## Steps

1. **The module, with tests, and nothing calling it.** In
   `src/lib/balances.ts`:
   - `findActiveAnchor(anchors, asOfDate)`: the latest anchor on or before
     the date, or `null`.
   - `cashEffectCents(transaction)`: what one transaction does to cash.
     Income and adjustments add; expenses and savings subtract.
   - `cashBalanceOn(balanceAnchors, transactions, asOfDate)`: the balance at
     the end of that day, or `null` with no anchor on or before it.
   - `savingsBalanceOn(savingsAnchors, transactions, savingsGoalId,
     asOfDate)`: the same for one goal.

   `getActiveAnchor` in both anchor hooks calls `findActiveAnchor`. Tests
   cover a transaction on the anchor's date, a transaction after the date
   asked for, a later anchor replacing an earlier one, no anchor, each
   transaction type, and a second goal's anchors and transactions being left
   out. Delete `anchors.test.ts`, and say in `ARCHITECTURE.md` where balance
   maths lives. No figure changes.
2. **Cash callers.** `useCashSurplus`, `net-wealth.tsx`, both memos in
   `check-in-wizard.tsx`, and `balanceInfo` in `insights.tsx`, which wants
   the balance before the range starts and so asks for
   `addDays(startDate, -1)`. The check-in's no-anchor estimate now subtracts
   savings transfers, which is the only figure that changes. Version bump
   and changelog line.
3. **Savings callers.** The two memos in `use-reports-data.ts`,
   `totalSavingsBalance` in `cash-flow/index.tsx`, the two in
   `check-in-wizard.tsx`, and `deleteSavingsGoal`. Figures change for a goal
   with a transaction on its anchor's date or dated in the future. Version
   bump and changelog line.
4. **Net Wealth reads savings anchors.** `totalSavings` becomes the sum of
   `savingsBalanceOn` over every goal, and `emergencyFundBalance` the one
   goal's. Version bump and changelog line.
5. **A savings range starts from its own start date.** `startingBalance` in
   `savingsByGoal` becomes `savingsBalanceOn` for the day before `startDate`.
   Read `perGoalBalanceInfo` in `insights.tsx` first: when a goal's only
   anchor falls inside the range, the chart starts from `startingBalance` in
   the anchor's month, and what that figure should be is not worked out.
   Version bump and changelog line.
6. **Finish.** Remove the queue line and this file.

Each step is one commit and ends with `npm run lint`, `npm run build`,
`npm run test:run`, and Prettier on the files touched. Version numbers follow
on from 0.53.0.

## Related work

- `future-month-end.md` owns `startingBalance` in `cash-flow/index.tsx`,
  which undoes the period's actuals from today's balance. This plan leaves it
  alone. `cashBalanceOn` for the day before the period would replace it for
  past and current months.
- `bills-set-aside.md` starts its safe-to-spend walk from the cash balance
  in `useCashSurplus`. After step 2 that is `cashBalanceOn`.
- `delete-cascades.md` also edits `deleteSavingsGoal`. Step 3 changes only
  how it works out the closing balance.
- `sync-merge-duplicates.md` keeps one anchor per date. `findActiveAnchor`
  assumes it: with two anchors on one date, which one wins is not defined.
- `cash-flow-averages.md` edits a different `savingsProgress` memo, the one
  in `cash-flow/index.tsx`.
- `dead-code.md` already lists `use-data-date-range.ts`,
  `calculateCompoundInterest` and the `earliestAnchorDate` prop.

## Not in this plan

- Date parsing and "today", which live in `src/lib/dates.ts`. A balance "as
  of today" takes its date from `today()` there.
- Balances for dates before the first anchor, by walking backwards from it.
- Interest, which is one piece of work of its own:
  - Interest forecasts ignore savings anchors. `generateInterestForecasts`
    in `use-forecasts.ts` takes each goal's opening balance from the savings
    transactions before the range, so a goal with a $10,000 anchor at 5% and
    no transactions forecasts no interest. The fix is `savingsBalanceOn` for
    the day before the range.
  - Three more month-by-month interest loops that share no code:
    `summaryStats` in `savings/index.tsx` (twice) and
    `calculateExpectedCompletion` in `savings-goal-progress-card.tsx`.
  - `generateInterestForecasts` adds a month's real transfers and its
    planned transfers to the balance, for past months as well as future
    ones.
  - Forecast interest is shown as "actual" in the savings charts but is not
    in any balance, so a chart's running total and the goal's balance can
    differ.
  - Whether interest already entered as real transactions is counted again.
- The cash anchor and savings anchor panels in Settings
  (`review-findings.md`).

## Not checked

- Nothing was run. Every finding comes from reading the code.
- Whether the list of savings forecasts passed to
  `generateInterestForecasts` holds past dates. `useForecasts` expands rules
  over the whole range and its callers filter on `date > today` themselves,
  which suggests it does.
- Whether `periodCashFlow` counts `adjustment` transactions. A search of
  `use-budget-period-data.ts` finds none, so the Cash Flow starting balance
  may be out by any adjustment in the period.
- Whether `getEarliestAnchorDate` in `use-savings-anchors.ts` has a caller.
  A search of `src` found none.
- How a real interest payment reaches the app. The Up import treats
  "Interest" as income.
