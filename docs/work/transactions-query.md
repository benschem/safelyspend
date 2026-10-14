# Every `useTransactions()` call loads the whole table

- **Status:** not started. Read in the code on 2026-10-13 at 0.47.1, apart
  from the callers named below, which were not re-read.
- **Goal:** a screen loads only the transactions it shows, and the whole
  table only where a figure needs it.
- **Touches:** `src/hooks/use-transactions.ts` and its callers.

The hook runs a second live query, `db.transactions.toArray()`, beside the
ranged one, for its `allTransactions` result. Every caller pays for it,
whether or not it reads `allTransactions`.

Not re-read: that `useReportsData` calls the hook twice and `useForecasts`
loads the table again.

Related: `balances-from-anchors.md`. The hook's comment says
`allTransactions` is there for balance calculations, so moving balances onto
`src/lib/balances.ts` may remove most of its readers. Not checked.
