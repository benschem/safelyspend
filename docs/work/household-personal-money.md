# Personal spending money for each household member

- **Status:** not started. No steps written. Placed in Later by the
  maintainer, 2026-10-13. Size M.
- **Goal:** two people share one household budget, and each has a personal
  spending allowance that carries over what they do not spend. The detail is
  private to its owner and the total is visible to both.
- **Touches:** `src/lib/types.ts`, `src/lib/db.ts`, a new
  `src/routes/my-money.tsx`, `src/routes/budget/plan-tab.tsx`,
  `src/routes/net-wealth.tsx`, `src/routes/transactions/new.tsx`,
  `src/components/csv-import-dialog.tsx`, `src/routes/settings.tsx`,
  `src/components/layout/sidebar.tsx`.

This was Phase 8 of the auth rewrite ("household concept in app UI"). The
design was copied from `docs/auth-rewrite/08_household_ui_scope.md` on
2026-10-13, including edits that had not been committed. That folder was
deleted the same day and is in git history up to commit `ae63e9b`.

The design had two layers: the original model, and an addendum dated
2026-09-14 that set the v1 scope. The addendum says the model is unchanged and
still correct, and that the decisions the model left open are taken as it
recommended. So where the two differ, the addendum is the decision. This file
states the result once, under Decided.

## What the addendum settled

The original left each of these open or said something else. The reasoning is
kept because a later revisit should start from the argument.

- **`scope` is on `Transaction` and `Category`, not `BudgetRule`.** The
  original data model had it on all three. Personal categories are labels
  only, so personal sub-budgets are cut, which removes a third table from the
  migration. Once an envelope balance exists the balance is the discipline.
  Sub-budgets are cheap to add later and hard to remove once people rely on
  them.
- **Allowances start from zero.** The original had an adjustment cover the
  opening balance when a member joins. Starting from zero means a joining
  member needs none, so the case does not arise in v1.
- **Net Wealth shows the net figure only.** The original wanted the
  per-member breakdown as well, because Net Wealth is where the app is
  reconciled against the bank and an unexplained gap is what a user will
  chase. The breakdown waits.
- **The screen is `/my-money` and the nav item is "My Money".** The original
  weighed "Mine", "My Money" and "Spending Money". Which sidebar group it
  sits in is still open: see Proposed.
- **Overspend is allowed.** The balance goes negative and the next credit
  pays it down. A negative envelope means the household was borrowed from,
  which is what happened, and transactions are facts that should not be
  blocked. The original also asked whether an allowance needs a hard stop or
  may run negative indefinitely. v1 has no stop.
- **The other member sees the envelope balance and the next credit date.** It
  makes the household's forward view accurate and reveals nothing the
  household total does not imply.

## Changed since the design was written

- **Two people editing at once.** The addendum left the conflict unsolved and
  kept the pull-or-overwrite UI, as a v1-wide deferral. `sync-merge.md` now
  plans a record-by-record merge and is a prerequisite of this work. Its docs
  step says to correct the description of the old behaviour in this file.
- **Scenarios.** The design says Scenarios stay as they are, purely
  household. `remove-what-if.md` (parked) would remove the What If sliders
  and keep scenarios as plain named plans.
- **Joining.** The design depends on the auth rewrite's Phase 7 invite flow,
  and its Settings pane includes "the invite affordance from Phase 7".
  `household-join.md` replaces the Phase 7 key handoff with a one-time code.
  Invites by email stay.
- **Priority.** The addendum kept this phase on the auth rewrite's critical
  path. The maintainer placed it in Later on 2026-10-13.

## Why

Without a personal allowance the couples feature is a joint account with
extra steps: a couple could share one login and skip the household work. The
auth rewrite's overview called this phase "the one the whole feature exists
for".

Shared money is the app as it exists today. Personal money is one new screen.

## Depends on

- Joining a household (`household-join.md`) and two people editing at once
  (`sync-merge.md`). See "Changed since the design was written" for both.
- Figures that can be trusted (`balances.md`).
- The original also listed the auth rewrite's Phase 2 (backend schema and
  endpoints, now described in `docs/reference/api-design.md`) and Phase 3
  (client crypto rewrite).
- One household per user, and leaving a household is not supported
  (`docs/reference/DECISIONS.md`). Both are locked and both simplify this
  work. No other gates are outstanding.

## Decided

### The app is the ledger

Stated by the maintainer. The app is the source of truth and the bank
accounts are plumbing. Pay on any card, move money between accounts, change
banks: none of it matters as long as the totals mostly match. The envelopes
in the app are how the household knows what is whose. Whose name is on which
card is not modelled.

The balance anchor already works this way. `use-balance-anchors.ts` records
"on this date the accounts really held $X" and `currentBalance` in
`net-wealth.tsx` computes forward from the most recent anchor, so re-anchoring
forgives every error accumulated before that date.

There is no account entity and there will not be one. The setup this has to
serve is one shared account and one personal account each, all three exported
and imported, so the anchor figure is the sum of all three balances on the
anchor date. The anchor must cover every account personal spending can come
out of. If a personal card sits outside it, personal transactions pull the
computed balance away from reality and the drift will look like an envelope
bug. Re-anchoring monthly keeps the figure right.

### Transfers between the household's own accounts are never imported

An envelope is credited by its allowance rule, automatically, whether or not
money moved. Importing the real transfer as well records it a second time: as
household income and a matching expense that did not happen, or as a doubled
envelope credit if the incoming side is scoped personal.

Both sides of a transfer pair are skipped, which nets correctly against a
summed anchor. This needs no new code. The import preview already has per-row
skip and select-all (`toggleSkip`, `selectAll` and `deselectAll` in
`csv-import-dialog.tsx`). It is a habit at import time and belongs in
whatever import instructions the app or the docs give.

### An allowance is a transfer, not an expense

Modelling "Ben's spending money" as a household budget rule of $200 a month
fails the first month Ben underspends. The household books $200 gone, $80
stays in the bank, and the household's numbers report an $80 saving that does
not exist. The error compounds monthly. Granting an allowance does not move
money out of the household. It changes who has a claim on it.

Two views follow, and neither is correct alone:

- **Flow.** In the budget and cash flow, the household spends $200 a month on
  Ben's money as it spends $180 a month on electricity: a constant line,
  whatever Ben spent. The other member sees a total, as for any bill, and no
  itemisation.
- **Stock.** The unspent remainder is still in the account, so the
  anchor-derived balance must subtract every member's envelope. $3,400 in the
  bank is household operating money plus Ben's $280 plus Sarah's $150 plus
  savings.

`type: 'savings'` already means "in the bank, not free to spend, tracked
separately" (see `currentBalance` in `src/routes/net-wealth.tsx`). A personal
allowance has that shape, so reuse the pattern.

Personal balance = every allowance credit to date − every personal
transaction to date. It carries over, and it is computed, never stored.

### Allowance rules are effective-dated

Raising $200 to $250 must not re-credit past months. So an allowance is a
rule per member, `{ memberId, amountCents, cadence, startDate, endDate? }`.
Changing the allowance closes the current row and opens a new one. The
balance is computed by expanding all rows to today and subtracting personal
spending. Nothing runs, nothing is deduplicated, and it is the same
rule-plus-cadence shape as `BudgetRule`.

- **First credit.** It lands on the first cadence date on or after the rule's
  start date. No proration.
- **Amount change.** It affects future credits only.
- **Rejected: one mutable row per member.** Barely less work, and the first
  change of amount rewrites every past month's balance.
- **Rejected: writing each credit as a ledger row when it falls due.**
  Auditable, but something has to run it, and two people on two devices would
  both generate the same credit on the 1st. That needs an idempotency key per
  member per period and a merge rule for it.

`src/lib/cadence.ts` now exists (`expandForecastRule`), so the cadence logic
the design wanted extracted before adding the allowance as another caller has
been extracted.

### Adjustments are for agreed changes to a claim

An adjustment is for when nothing happened in the real world and the
household agrees to change who has a claim: a birthday top-up, or calling it
even and wiping the slate. Keeping them rare stops them being used to hide
errors. It is stored as a transaction with `type: 'adjustment'`, which
already exists for manual corrections.

Unlogged spending, such as cash that was never entered, is not an adjustment.
It happened, so it is recorded as a transaction on the manual entry form
(`src/routes/transactions/new.tsx`).

So there are two ways to reconcile:

- **Household total.** Re-anchor. This forgives drift.
- **Envelopes.** Log the missing transaction. Adjust only by agreement.

### Privacy is enforced by the UI, and made real by the separate card

Both members hold the same household key and either browser can decrypt
everything. The filter is a `scope` check in a hook, and devtools defeats it.

- **Shared.** The allowance line, and each member's envelope balance.
- **Private.** What the personal money was spent on: categories,
  transactions, notes.

The envelope balance is visible to the other member because otherwise
household available has an unexplained hole. It is the one number that
reveals saving behaviour.

What keeps a purchase private is that it was made on a separate card. A
purchase on the shared account is on a statement both members can read,
whatever `scope` says. So the personal accounts are part of the design, not
bookkeeping to remove, and the app's filter only keeps the household's
numbers consistent with a division that already exists.

The privacy page (`src/routes/privacy.tsx`) must never say the other member
cannot see the detail. What it can say is that a purchase is private because
it was made on a separate card.

### Naming people

The UI names a person on the import control, the Budget line, the members
list and `/my-money`. It does not use "his" or "hers", and it avoids
"partner", which assumes a relationship shape.

- **Labels.** "Shared", "Mine" and the other member's name. "Mine" is always
  correct from the viewer's seat, so only the other person is ever named.
- **Display name.** It lives in the vault. `users` has no name column, adding
  one means a migration against a schema already applied to production, and
  the server has no need to know what anyone is called. Each member sets
  their own in Settings.
- **Default.** The local part of their email, so there is always something to
  show and signup gains no blocking step. It also covers the gap between the
  other member signing up and their first sync, when only their email is
  known.

### Data model

- **`scope`.** `'household' | 'personal'` on `Transaction` and `Category`,
  and not on `BudgetRule`. Indexed, with a `db.ts` version bump.
  The migration backfills existing rows to `'household'`.
- **`ForecastRule`.** No `scope` in v1. Recurring personal expenses are
  plausible but unproven, and forecasting is the heaviest machinery in the
  app to extend.
- **`ownerUserId`.** Set only when `scope === 'personal'`. `userId: 'local'`
  stays where it is. The original design made `userId` the real user id on
  every entity. v1 does not, because a household row has no owner, and one
  optional field and a filter replace a refactor across every entity and
  hook (see `userId` in `docs/reference/DECISIONS.md`). The real user id
  comes from the account created at signup, so it exists before any personal
  row can. If household rows later need ownership, for an audit trail or
  "who entered this", do the full refactor then.
- **Allowance rule.** A new entity, as above.
- **Personal categories.** Labels only.

### Screens

- **`/my-money` (new).** The whole personal experience on one addressable
  page. There is no mode or global toggle to be left in by accident. It leads
  with the envelope balance, "$280", with the next credit date below it. Then
  this period's personal spending, personal categories, and a personal
  transaction list with an add button. One new sidebar item.
- **Envelope balance and the date range.** Every other number on `/my-money`
  follows the header date range. The envelope balance does not, because it is
  a claim on a bank balance that exists today, which is also why
  `net-wealth.tsx` computes against `today`. It sits in its own card above
  the range-filtered content and is labelled as a today figure.
- **Budget.** A spending-money section with one line per member, spent of
  allowance for the current period, shown like any other expense line. Your
  own line links to `/my-money`. The other member's links nowhere.
- **Net Wealth.** `currentBalance` subtracts every member's envelope balance.
  Without the subtraction the balance is wrong.
- **Transaction entry.** One whose-is-this field on the manual form: Shared,
  Mine, or another member.
- **Settings.** A Members & Allowances pane: who is in the household, each
  member's allowance and cadence, the display name, and inviting. An
  allowance change is made here, so this is where the rule is closed and
  reopened.
- **Unchanged.** Savings goals, Insights and Net Wealth's goal tracking stay
  household only. Personal money gets no scenarios, forecasts or savings
  goals in v1.

### CSV import asks whose the file is

A mis-scoped import puts hundreds of rows in the wrong pool, and undoing that
by hand is miserable. The wizard's preview already has a per-row category
override and per-row skip, so the scope control is the same pattern on
another field.

- **Mapping step.** One choice for the file: Shared, Mine, or another member.
  Defaults to Shared.
- **Preview step.** A per-row override, like the category override, and the
  existing skip for transfer rows. The preview says what is about to land in
  each pool.

It is a select over the members plus Shared, not a shared/personal toggle,
because one person will import the other's export for them.

Importing another member's file shows you their transactions in the preview,
and the app then hides those rows from you. That comes with holding their
export, and nothing is built for it. The privacy page must not imply
otherwise.

### Retagging rows imported before this ships

Decided 2026-10-11, reversing "no bulk re-scope". Real statements are being
imported before the scope field exists. The migration backfills all of them
to `'household'`, and the personal-account rows among them then need moving
to their owner. A whole statement cannot be done one row at a time. It ships
with the scope field, because the backfilled rows are wrong from the moment
the migration runs.

The retag works a file at a time, which is how the mistake is made:

- **By import run.** `bulkImport` in `use-transactions.ts` stamps every row
  in a run with one `createdAt`, so a run is identifiable with no new field.
  Pick a run, pick whose it is, apply.
- **By account, Up imports only.** The Up fingerprint includes the account's
  BSB and number (`createFingerprint` in `up-csv-parser.ts`), so those rows can be
  grouped by account even when one run mixed several. The generic CSV
  fingerprint is date, amount and description, and cannot be split this way.

This only works if imports made before this ships are one account per run. A
generic CSV run that mixed accounts can only be untangled row by row.

Single exceptions, such as groceries bought on a personal card, are fixed on
the transaction edit form. There is no multi-select edit on the transactions
table. The "apply to all matching" dialog
(`src/components/dialogs/bulk-category-dialog.tsx`) matches on description
and only sets a category. If one-off fixes become tedious, extend that
pattern and do not build a selection tool.

## Proposed

Nothing here has a yes.

- **A removed member's personal data.** Leaving a household is not supported
  and account deletion is the only exit, so v1 avoids the question. The
  envelope sharpens it: a departing member has a balance, which is a claim on
  money still in the account.
- **Where "My Money" sits in the sidebar.** In its own group or under Track.
  The addendum named the item and not the group.
- **Total committed to envelopes.** Whether a household-level figure is worth
  showing, or per-member is enough.
- **The word "allowance".** Since this design was written the UI has come to
  use "allowance" for a category's spending limit. This design uses it for a
  member's spending money.
- **Unifying envelopes and savings goals.** Both are "in the bank, not free
  to spend". If a third case appears, unify them then.
- **Storage quota copy.** The 50MB quota is per household, which halves it
  for a couple (`docs/reference/api-design.md`). The copy needs to say so.

Reconciliation should improve: today the only check is app total against bank
total, and with envelopes a drift narrows to one pot.

## Not in this plan

- **Real accounts.** If the app ever models accounts, the rule that one
  anchor covers everything goes and envelopes become a view over several
  balances. Nothing here blocks that or prepares for it.
- **`scope` on `ForecastRule`**, and personal scenarios, forecasts and
  savings goals.
- **`userId` as a real user id** on every entity.
- **Multi-select edit** on the transactions table.

## Verification

A manual walkthrough by the maintainer in two browsers, since this is the
first work where behaviour depends on who is looking. Each case below could
look right and be wrong:

- Underspend a month, then check that household available dropped by the full
  allowance while the bank total did not move.
- Change an allowance amount and confirm no past month's balance changed.
- Overspend into a negative balance, then confirm the next credit pays it
  down and does not reset it.
- Scroll the date range back a year and confirm the envelope balance does not
  follow it.
- Log a personal transaction as one member and confirm the other sees the
  balance move but not the description.
- Import all three real exports for one month. Confirm the computed balance
  lands on the summed anchor, and that skipping both sides of each transfer
  pair is what makes it land. Importing them should visibly inflate income
  and expenses while leaving the balance unchanged.
- Import a file scoped to the other member and confirm the rows are invisible
  afterwards to the person who imported them.
- Retag an earlier import run to one member and confirm every row from that
  run moves, no row from another run does, and the household balance and that
  member's envelope both shift by the run's total.

## Checked and not checked

Checked against the code on 2026-10-13: `src/App.tsx` has no `/my-money`
route and `src/routes/my-money.tsx` does not exist; `src/lib/cadence.ts`
exists; `toggleSkip`, `selectAll` and `deselectAll` in
`csv-import-dialog.tsx`; the single `createdAt` in `bulkImport`; the account
BSB and number in the Up fingerprint (`up-csv-parser.ts:192`); the path of
`bulk-category-dialog.tsx`; the preview's per-row category override
(`categoryOverrides`, `csv-import-dialog.tsx:95`); the generic CSV
fingerprint of date, amount and description (`csv-parser.ts:383`); and that
`BudgetRule` is an amount, a cadence and optional start and end dates
(`types.ts:55-63`).

Not checked:

- Whether any of the feature is built. It is assumed not. The missing route
  is the only evidence looked at.
- That the bulk category dialog only sets a category.
- Whether `expandForecastRule` can expand an allowance rule as it stands.
- Whether the auth rewrite's Phases 2 and 3 are complete.
