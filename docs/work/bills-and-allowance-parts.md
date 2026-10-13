# Show a category's bills and allowance as two parts of one total

- **Status:** not started. The Budget page shows the parts as of 0.49.0; the
  item under Proposed remains.
- **Goal:** a category with both a bill and an allowance shows the two parts of
  its total on Cash Flow's rows.
- **Touches:** `src/routes/cash-flow/index.tsx`.

## Why

An allowance is in addition to a category's bills, and every screen judges a
category against bills plus allowance. Rule start and end dates are the
exception; see `category-limit-loose-ends.md`. The Budget page lists each
category's bills and allowances under one heading with their total. Cash
Flow's rows do not show the two parts.

What a bill and an allowance are, and how a category's limit is made of both,
is in `docs/reference/ARCHITECTURE.md` under "What is SafelySpend?" and
"Cadence system".

## Proposed

- **Cash Flow rows.** For a category with both, the row reads "Budgeted
  $2,500" and "Spent $X (N% of budget)", where the $2,500 is the two added
  together, beside a "$2,000 bills" pill. The allowance is left for the
  reader to subtract. Show the parts, for example "$2,000 bills + $500
  allowance", or decide the pill is enough.
