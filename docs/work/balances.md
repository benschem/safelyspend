# Balance maths is written eleven times, and interest forecasts ignore anchors

- **Status:** not started. Found in the 2026-10-13 code review. Steps to be
  written when this is picked up.
- **Goal:** one tested module works out a cash balance and a savings goal's
  balance as of a date, from anchors and transactions, and every screen uses
  it.
- **Touches:** a new `src/lib/balances.ts`, `src/hooks/use-cash-surplus.ts`,
  `src/hooks/use-savings-goals.ts`, `src/hooks/use-reports-data.ts`,
  `src/hooks/use-forecasts.ts`, `src/routes/cash-flow/index.tsx`,
  `src/routes/net-wealth.tsx`, `src/routes/insights.tsx`,
  `src/components/check-in-wizard.tsx`, `src/__tests__/lib/anchors.test.ts`.

## Why

A balance is the latest anchor on or before a date plus the transactions after
it. That rule is written out wherever a balance is needed, and the last month
of commits is largely fixes for the same figure differing between screens.

Line numbers are as of 0.44.7; re-check them.

## Confirmed in the code

- **Interest forecasts start from transactions only**
  (`src/hooks/use-forecasts.ts:38`). The opening balance for each goal is the
  sum of its savings transactions before the range. Anchors are not read.
- **A custom range that ends before today starts too high.** `startingBalance`
  (`src/hooks/use-reports-data.ts:497`, read 2026-10-13 at 0.47.1) is today's
  balance less the transactions in the range, so transactions after the range
  ends are counted as saved before it began.

## Reported by the sub-reviews, not checked

- **The other half of the interest bug:** "already saved" in the goal dialog
  creates a savings anchor, not a transaction
  (`savings-goal-dialog.tsx:166`). If so, a goal with a $10,000 anchor at 5%
  and no transactions forecasts no interest.
- **Cash balance from an anchor is written five times:**
  `use-cash-surplus.ts:46`, `net-wealth.tsx:99`, `insights.tsx:387`,
  `check-in-wizard.tsx:719` and `:1119`.
- **Savings balance is written six times:** `use-reports-data.ts:384` and
  `:481`, `use-savings-goals.ts:102`, `cash-flow/index.tsx:594`,
  `check-in-wizard.tsx:402` and `:918`.
- **The copies agree with each other, but cash and savings differ.** Cash
  counts transactions on the anchor's own date (`>=`); savings does not
  (`>`). `types.ts:122` documents both as "start of this date". Decide which
  is meant before merging them.
- **`anchors.test.ts` tests its own copy of the logic** ("this mirrors the
  logic in…"), so it guards nothing.
- Routes and charts hold further interest loops that nobody audited:
  `savings/index.tsx:159`, `savings-goal-progress-card.tsx:65` and `:127`.
- Unsure: whether interest already imported as real transactions is counted
  again by the synthetic "actual" interest (`use-reports-data.ts:432`). Read
  2026-10-13: each month's actual is its savings transactions plus the
  forecast interest, with nothing that leaves out a transaction that is
  itself interest. Not tried with data.

## Not in this plan

- Date parsing and "today", which live in `src/lib/dates.ts`. A balance "as
  of today" takes its date from `today()` there.
