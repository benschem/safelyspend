# Delete dead code and add a check that finds it

- **Status:** not started. Found in the 2026-10-13 code review and in several
  backlog entries.
- **Goal:** no file, export or prop in the repo is unused, and a tool reports
  it when one appears.
- **Touches:** the files listed below, `package.json`, `eslintrc.json`,
  `public/dummyBudgetData.json`, `docs/reference/ARCHITECTURE.md`.

## Why

Unused code still gets read, reworded in renames and reasoned about. One of
these files reads storage keys that no longer exist; another still uses
wording from two renames ago.

## Confirmed unused, 2026-10-13, after 0.47.1

A search of `src` for each file name finds no importer:

- `src/components/dialogs/budget-prompt-dialog.tsx`. It offered to raise a
  category's allowance after a bill was added. That prompt went in 0.42.3,
  when adding a bill stopped creating a matching allowance.
- `src/components/dialogs/delete-forecast-dialog.tsx`. It was missed by the
  rename and still says "Recurring forecast deleted" and "Delete Recurring
  Transaction".
- `src/components/timeline-range-picker.tsx`
- `src/components/date-range-picker.tsx`
- `src/components/scenario-selector.tsx`
- `src/components/charts/trend-sparkline.tsx`
- `src/components/year-grid.tsx`
- `src/hooks/use-multi-period-summary.ts`, imported only for a type by the two
  files above
- `src/hooks/use-data-date-range.ts`, which also reads `budget:transactions`
  from localStorage, a key nothing writes
- `eslintrc.json`, a leftover beside `eslint.config.js`
- `src/__tests__/routes/budget-segments.test.ts` imports only vitest and
  asserts against constants it defines itself

- `api.vault.getHistory()` (`src/lib/api-client.ts:614`) has no caller. It
  also types the response as an array where the worker returns
  `{ versions }` (`worker/src/routes/vault.ts:212`). Delete the client
  method, and decide whether the worker's `GET /vault/history` stays.

Check that nothing lazy-loads a component by path before deleting it.

## Reported, not checked

- `public/dummyBudgetData.json`: the old `HANDOVER.md` called it a legacy fixture that
  nothing references. The file exists.
- Unused exports: `useAdjustedScenarioData`, `calculateCompoundInterest`,
  `calculateInterestEarned`, `fromMonthlyCents`, `formatDuration`,
  `getTransactionsUpTo`. Some still have tests.
- `budgetComparison` is returned by `useReportsData` and read by no route. It
  is the only consumer of `countOccurrences` in `use-budget-rules.ts`, which
  counts 5 weeks in a 31-day month where `toMonthlyCents` gives 4.33.
- `toMonthlyCents` (`utils.ts`) and `toPeriodCents` (`plan-amounts.ts`)
  duplicate each other, as do the `CadenceType` and `Cadence` types.
- `handleInteract`, a no-op passed through four steps of the check-in wizard.
- `earliestAnchorDate`, an unused prop on the savings goal dialog.
- `SummaryCardProps` in `cash-flow/index.tsx` carries about eight props the
  component never reads.
- `src/routes/transactions/new.tsx`: nothing links to it, and saving on it
  navigates to a route that does not exist. See `wrong-links.md`.
- In the worker: envelope B and kind `0x04`, `/auth/rewrap-keys`, and the
  idempotency key.

## Also listed elsewhere

- The `prefill` prop on `ForecastRuleDialog`, and the What If fallback names:
  `bills-rename-loose-ends.md`.
- `useAdjustedScenarioData` and the stale comment in `summary-cards.tsx`:
  `category-limit-loose-ends.md`.

## The check

`knip` is the usual tool for unused files, exports and dependencies in a
TypeScript project. Not tried here. Check the 7 day minimum release age when
adding it.
