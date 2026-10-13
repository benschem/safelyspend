# A future month's planned month end skips the months before it

- **Status:** not started. Raised 2026-10-13. Read from the code, not seen in a browser.
- **Goal:** a future month's planned month end includes what the months between
  now and then are planned to do.
- **Touches:** `src/routes/cash-flow/index.tsx`.

Noticed 2026-10-13 while putting the set-aside line on the cash card. Read from
the code, not seen in a browser, and not traced further.

On Cash Flow, a month's starting balance is today's balance with that month's
own transactions undone (`startingBalance` in `cash-flow/index.tsx`). A future
month has no transactions, so it starts from today's balance. Its "Planned
month end" is then today's balance plus that one month's plan. Looking at
December from October leaves out what the rest of October and all of November
are planned to do.

The set-aside line under it is measured at that month's end, so on a future
month the two figures are for the same date but only the set-aside one has
moved forward through the months between.
