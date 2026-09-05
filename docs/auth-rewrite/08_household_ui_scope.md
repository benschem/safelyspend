# Phase 8 — Household concept in app UI (shared vs personal scope)

- **Goal:** Two people share one household budget, each with a personal spending allowance that accrues and carries over. Shared money is the app as it exists today; personal money is one new screen.
- **Files:** `src/lib/types.ts` (`scope` on entities, real `userId`, allowance rules); `src/lib/db.ts` (version bump, `scope` index, migration defaulting existing rows to `'household'`); new `src/routes/my-money.tsx`; `src/routes/budget/plan-tab.tsx` (spending-money lines); `src/routes/net-wealth.tsx` (envelope subtraction); `src/routes/transactions/new.tsx` and the CSV import flow (scope choice); `src/routes/settings.tsx` (Members & Allowances pane); `src/components/layout/sidebar.tsx` (one new nav item).
- **Gates:** none outstanding. Q5 (one household per user) and Q7 (no leaving a household) are both locked and both simplify this phase.
- **Size:** M
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 7](07_invite_flow.md).

---

## The model

### An allowance is a transfer, not an expense

The obvious model — "Ben's spending money" is a household budget rule of $200/month — is wrong, and it fails on the first month Ben underspends. The household books $200 gone, $80 stays in the bank, and the household's numbers report an $80 saving that isn't one. The error compounds every month.

Money does not leave the household when the allowance is granted. **It changes who has a claim on it.**

### Flow and stock are both true

- **Flow** — the budget and cash-flow view. The household spends $200/month on Ben's money exactly as it spends $180/month on electricity. A constant line item, regardless of what Ben actually spent. This is what the partner sees, at the same granularity as any other bill: a total, not an itemisation.
- **Stock** — the balance view. The unspent remainder is still physically in the account, so the anchor-derived balance must subtract every member's envelope. $3,400 in the bank is household operating money *plus* Ben's $280 *plus* Sarah's $150 *plus* savings.

An expense paid into an envelope still sits in the account until the envelope is drawn down. Neither view alone is correct.

### Personal money is an envelope, and the app is already half an envelope system

`type: 'savings'` already means "in the bank, not free to spend, tracked separately" — see the `currentBalance` calculation in `src/routes/net-wealth.tsx`. A personal allowance has exactly that shape. Reuse the pattern rather than building a parallel one.

**Personal balance = every allowance credit to date − every personal transaction to date.** It carries over. Skip two months and buy something bigger.

### All money is "our" money

The split lives in the app, not in the bank. Whose name is on which card is bookkeeping the app does not model — there is no account entity, one anchor, one figure.

**This makes the anchor load-bearing: the figure entered must cover every account personal spending can come out of.** If a personal card sits outside it, personal transactions drag the computed balance away from reality and the drift will read as an envelope bug rather than a missing account.

### Allowance history: effective-dated rules

The balance must not be rewritten when the allowance changes. Raising $200 to $250 must not retroactively re-credit every past month.

**Chosen:** effective-dated allowance rules — `{ memberId, amountCents, cadence, startDate, endDate? }`. Changing the allowance closes the current row and opens a new one; history is described by the old row and is untouched. Balance is computed by expanding all rows to today and subtracting personal spending. Nothing to run, nothing to deduplicate, no rows accumulating, and it is the same rule-plus-cadence shape as every other plan entity in the app.

**Rejected: materialising credits as ledger rows** when each period falls due. Auditable, but it needs something to *run*, and with two people on two devices both clients generate the same credit on the 1st. That means per-member-per-period idempotency keys and a merge story stacked on top of the two-writer vault conflict this phase already inherits. Wrong problem to take on.

**Plus adjustments for everything irregular** — birthday top-up, an agreed slate-wipe, an opening balance when a member joins. `type: 'adjustment'` already does this job for opening balances; reuse it.

Two boring sub-decisions, both deliberate: a rule's first credit lands on the first cadence date **on or after** its start date (no proration), and an amount change affects future credits only.

### Privacy line

Unchanged from `../couples-feature-plan.md` and still **UI-enforced, not cryptographic**. Both members hold the same household key and both browsers can decrypt every byte. The filtering is a `scope` check in a hook, and devtools defeats it.

- Shared: the allowance line item, and each member's envelope balance.
- Private: what the personal money was actually spent on — categories, transactions, notes.

This must never be described to users as though the partner *cannot* see the detail. Phase 10's privacy page is where that would get overclaimed by accident.

---

## Screens

### New: `/my-money`

The whole personal experience in one place. Not a mode, not a global toggle — a place, addressable and linkable, that you cannot be accidentally "in".

Leads with the **envelope balance**, not a this-month gauge: "$280" with the next credit dated below it. Then this period's personal spending, personal categories (labels only — see below), and a personal transaction list with an add button.

One new sidebar item. Sits in its own group, or under Track — a naming call, since "Mine"/"My Money"/"Spending Money" all read differently next to a partner's screen showing the same nav.

### Changed: Budget

Gains a spending-money section — one line per member, `spent of allowance` for the current period, presented like any other expense line. Your own line links to `/my-money`; your partner's does not link anywhere.

### Changed: Net Wealth

`currentBalance` subtracts every member's envelope balance. Worth surfacing the breakdown rather than only the net figure, because this is where reconciliation against the bank actually happens and an unexplained gap is the thing a user will chase.

### Changed: transaction entry and CSV import

Both need a shared-or-personal choice. On the form it is one field. **On import it is the dangerous one** — a mis-scoped import dumps hundreds of rows into the wrong pool, and undoing that by hand is miserable. A single explicit choice at import time, defaulting to shared, with the count shown before commit.

### Changed: Settings

A Members & Allowances pane: who is in the household, each member's allowance and cadence, and the invite affordance from [Phase 7](07_invite_flow.md). This is also where an allowance change happens, which means it is where the effective-dated rule gets closed and reopened.

### Unchanged

Scenarios, Savings goals, Insights and Net Wealth's goal tracking all stay purely household. Personal money deliberately does not get scenarios, forecasts, or savings goals in v1.

---

## Data model

- `scope: 'household' | 'personal'` on `Transaction`, `Category`, `BudgetRule`. Existing rows default to `'household'`; the Dexie migration is a straight backfill.
- **`ForecastRule` does not get `scope` in v1.** Recurring personal expenses are plausible but unproven, and forecasting is the heaviest machinery in the app to extend.
- `userId` stops being `'local'` and becomes the real user id. `DECISIONS.md` calls this "a large refactor across every entity and hook" — it is, and it is unavoidable here.
- New allowance rule entity, effective-dated, per member.
- Personal balance is **computed, never stored**.

---

## Decisions still to make

- **The date-range trap.** Every other number on `/my-money` respects the header date range. The envelope balance must not — it is a claim on a real bank balance that exists today, the same reasoning that makes `net-wealth.tsx` compute against `today`. Scrolling back to March must not report a March-shaped envelope. Decide how to present a page where one number ignores the filter the rest obeys, because silently ignoring it is confusing and obeying it is wrong.
- **Overspend.** Recommendation: allow it, let the balance go negative, let the next credit pay it down. A negative envelope means the household was borrowed from, which is exactly what happened. Transactions are facts and should not be blocked — but confirm, because the alternative (warn and require a reason) is defensible.
- **Two-writer vault conflicts**, carried from Phase 2. `X-Expected-Version` already rejects a stale push, but with two people on one vault a rejection means someone's work is on the server and yours is not. Today that resolves by discarding. This is the first genuinely new failure mode couples introduce and it needs a real answer: auto-merge, prompt, or refuse.
- **Personal sub-budgets.** The Feb plan had personal categories carrying their own mini-budgets. Once an envelope balance exists, the balance *is* the discipline. Recommendation: cut them from v1, keep personal categories as labels only. Cheap to add later; hard to remove once people rely on them.
- **Nav naming and placement** for the personal screen.
- **Whether the envelope balance is visible to the partner at all.** Settled as yes — otherwise household available has an unexplained hole — but it is worth being deliberate about, since it is the one number that reveals saving behaviour.

## Things to consider

- **`src/lib/cadence.ts` becomes more worth extracting, not less.** Allowance expansion is a fourth caller of logic already duplicated across three hooks (`HANDOVER.md` refactor plan). Extract it before adding the fourth, not after.
- **Envelopes and savings goals are the same primitive.** Both are "in the bank, not free to spend". If a third case ever appears, that is the moment to unify them rather than add a third bespoke mechanism.
- **Reconciliation gets better, not worse.** Today the only check is app-total against bank-total. With envelopes, a drift narrows to a pot.
- **The 50MB storage quota is now per household**, not per person — a real halving for a couple. Phase 2 flagged it; the copy needs to say so.
- **Direction not taken: multi-account.** If the app ever models real accounts, the "one anchor covers everything" rule dissolves and envelopes become a view over several balances. Nothing here blocks that, but nothing here anticipates it either.

## Open questions

- What happens to personal data when a member is removed? Q7 defers leaving a household entirely (account deletion is the only exit), so v1 avoids this — but the envelope makes it sharper, because a departing member has a *balance*, and a balance is a claim on money that is still in the account.
- Does a member's allowance need a hard stop, or is a negative balance allowed to run indefinitely?
- Should the partner see the *next credit date* as well as the balance? It makes the household's forward view accurate, and reveals nothing.
- Is there a household-level view of "total committed to envelopes" worth showing, or is per-member enough?

## Verification

Manual walkthrough by the maintainer, in two browsers, since this is the first phase where the app's behaviour depends on who is looking.

Specifically worth exercising, because each is a case where the model could look right and be wrong:

- Underspend a month, then check that household available dropped by the full allowance while the bank total did not move.
- Change an allowance amount and confirm no past month's balance changed.
- Overspend into a negative balance, then confirm the next credit pays it down rather than resetting.
- Scroll the date range back a year and confirm the envelope balance does not follow it.
- Log a personal transaction as one member and confirm the other sees the balance move but not the description.
