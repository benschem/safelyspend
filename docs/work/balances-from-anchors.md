# Every balance comes from `src/lib/balances.ts`

- **Status:** not started. No steps. Each bug below is as its Inbox line
  reported it and has not been read in the code for this file.
- **Goal:** every cash and savings balance on every screen comes from
  `src/lib/balances.ts`, so a balance entered on any date is honoured
  everywhere, and no hook or route works one out itself.
- **Touches:** not yet traced. Likely `src/routes/cash-flow/index.tsx`,
  `src/components/check-in-wizard.tsx`, `src/hooks/use-reports-data.ts`
  and the savings and cash charts.

## Why

`src/lib/balances.ts` holds the rule: a balance is the latest anchor on or
before a date plus the transactions after it. `docs/reference/DECISIONS.md`
says balance handling is still spread across hooks and routes. These bugs
look like places that work a balance out their own way:

- Cash Flow's starting balance may ignore adjustments in the period.
- Savings and cash charts ignore a balance entered part-way through the
  range.
- A goal with no entered balance starts its own savings chart at $0.
- Confirming the check-in's cash estimate counts today's transactions twice.

Steps start by finding every place that works out a balance, and checking
each bug against the code.

## Related work

- `interest.md`: interest also ignores savings anchors. It has its own plan,
  and its fix uses `savingsBalanceOn` from the same module.
- `transactions-query.md`: `allTransactions` is loaded for balance
  calculations, so this work may remove most of its readers. Not checked.
- `cash-flow-split.md`: the Cash Flow starting balance lives in the page it
  splits.
