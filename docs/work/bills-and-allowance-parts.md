# Show a category's bills and allowance as two parts of one total

- **Status:** not started. Most of the original question was answered in 0.43.4
  to 0.44.1; the two items under Proposed remain.
- **Goal:** a category with both a bill and an allowance shows the two parts of
  its total on the Budget page and on Cash Flow's rows.
- **Touches:** `src/routes/budget/plan-tab.tsx`, `src/routes/cash-flow/index.tsx`.

## Why

Raised 2026-10-11: is an allowance in addition to a category's bills, or the
same money? It is in addition. The dialogs now say so, and every screen judges
a category against bills plus allowance. Rule start and end dates are the
exception; see `category-limit-loose-ends.md`. Two places still do not show
the two parts.

What a bill and an allowance are, and how a category's limit is made of both,
is in `docs/reference/ARCHITECTURE.md` under "What is SafelySpend?" and
"Cadence system".

## Proposed

- **Budget page.** Show the two together per category, as Cash Flow already
  does, so a category with rent and an allowance reads as one total made of
  two parts. `plan-tab.tsx` works out a `totalAmount` per category and nothing
  displays it.
- **Cash Flow rows.** For a category with both, the row reads "Budgeted
  $2,500" and "Spent $X (N% of budget)", where the $2,500 is the two added
  together, beside a "$2,000 bills" pill. The allowance is left for the
  reader to subtract. Show the parts, for example "$2,000 bills + $500
  allowance", or decide the pill is enough.
