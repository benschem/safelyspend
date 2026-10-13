# Cash Flow's savings progress sets a dated month against a monthly average

- **Status:** not started. Raised 2026-10-13.
- **Goal:** Cash Flow's savings progress compares a month's dated transfers
  with what is due in that month.
- **Touches:** `src/routes/cash-flow/index.tsx`,
  `src/hooks/use-budget-period-data.ts`.

This is the mix-up that step 1 of `bills-set-aside.md` removed from the
category rows, in a figure it did not touch. **Read from the code, not
reproduced.**

- **Savings progress per goal.** The `savingsProgress` memo in
  `cash-flow/index.tsx` sets each goal's real transfers in the month against
  an expected figure averaged with `toMonthlyCents`. A fortnightly transfer
  reads short in a two-transfer month and over in a three-transfer month.
