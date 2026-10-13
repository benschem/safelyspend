# Interest ignores savings anchors and is worked out four times

- **Status:** not started. Steps to be written when this is picked up.
- **Goal:** one tested module works out a savings goal's interest, starting
  from the goal's balance in `src/lib/balances.ts`, and every screen uses it.
- **Touches:** `src/hooks/use-forecasts.ts`, `src/routes/savings/index.tsx`,
  `src/components/charts/savings-goal-progress-card.tsx`,
  `src/hooks/use-reports-data.ts`.

## Why

Everything in this section was read in the code on 2026-10-13 at 0.49.1. None
of it was run, and none of it was re-read after `src/lib/balances.ts` landed
in 0.53.4.

- **Interest forecasts ignore savings anchors.** `generateInterestForecasts`
  in `use-forecasts.ts` takes each goal's opening balance from the savings
  transactions before the range, so a goal with a $10,000 anchor at 5% and no
  transactions forecasts no interest. The fix is `savingsBalanceOn` for the
  day before the range.
- **Interest is worked out in four places that share no code.**
  `generateInterestForecasts`, `summaryStats` in `savings/index.tsx` (twice),
  and `calculateExpectedCompletion` in `savings-goal-progress-card.tsx`. Each
  is its own month-by-month loop.
- **Past months count planned transfers as well as real ones.**
  `generateInterestForecasts` adds a month's real transfers and its planned
  transfers to the balance, for past months as well as future ones.
- **Forecast interest is drawn as "actual" but is in no balance.** The savings
  charts add it to each month's actual figure in `use-reports-data.ts`.
  `savingsBalanceOn` does not include it, so a chart's running total and the
  goal's balance can differ.

## Decided

Nothing yet.

## Proposed

- Whether forecast interest belongs in a goal's balance at all, or only in
  projections of future months.

## Steps

Not written.

## Related work

- `dead-code.md` lists `calculateCompoundInterest` in `src/lib/utils.ts`.
- `cash-flow-averages.md` and `future-month-end.md` read savings figures on
  the Cash Flow page. Check both for overlap before planning.

## Not in this plan

- Balances from anchors and transactions, which live in
  `src/lib/balances.ts`.

## Not checked

- Whether interest already entered as real transactions is counted again by
  the forecast interest.
- How a real interest payment reaches the app. The Up import treats
  "Interest" as income.
- Whether the list of savings forecasts passed to `generateInterestForecasts`
  holds past dates. `useForecasts` expands rules over the whole range and its
  callers filter on `date > today` themselves, which suggests it does.
