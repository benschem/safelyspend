# Phase 8 — Household concept in app UI (shared vs personal scope)

- **Goal:** Two people share one household budget, each with a personal spending allowance that accrues and carries over. Shared money is the app as it exists today; personal money is one new screen.
- **Files:** `src/lib/types.ts` (`scope` and `ownerUserId` on `Transaction` and `Category`, allowance rules, member display names); `src/lib/db.ts` (version bump, `scope` index, migration defaulting existing rows to `'household'`); new `src/routes/my-money.tsx`; `src/routes/budget/plan-tab.tsx` (spending-money lines); `src/routes/net-wealth.tsx` (envelope subtraction); `src/routes/transactions/new.tsx` and `src/components/csv-import-dialog.tsx` (whose-is-this choice); `src/routes/settings.tsx` (Members & Allowances pane, display name); `src/components/layout/sidebar.tsx` (one new nav item); `src/lib/cadence.ts` extracted before the allowance becomes its fourth caller.
- **Gates:** none outstanding. Q5 (one household per user) and Q7 (no leaving a household) are both locked and both simplify this phase.
- **Size:** M
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 7](07_invite_flow.md).

---

## v1 scope and decisions, 2026-09-14

This phase stays on the critical path — `00_overview.md` records why: without the
personal allowance the whole couples feature is a joint account with extra steps. The
model below is unchanged and still correct. What follows is what v1 builds, what it
does not, and the decisions the model left open.

### The governing principle: the app is the source of truth

Stated by the maintainer and it settles several things at once. **The app is the ledger;
the bank accounts are plumbing.** Pay for anything on any card, move money between
accounts, change banks — none of it matters as long as the totals mostly match. The
envelopes in the app are how the household knows what is whose.

This is not a compromise the app tolerates; it is what the balance anchor already *is*.
`use-balance-anchors.ts` records "on this date the accounts really held $X" and
`net-wealth.tsx:95` computes forward from the most recent one, so re-anchoring forgives
every accumulated error before that date. "Mostly match up" is the mechanism, not a
concession.

The real setup it has to serve: one shared account and one personal account each, all
three exported and imported. There is no account entity in the app and there will not be
one, so **the anchor figure is the sum of all three balances** on the anchor date.

### Transfers between the household's own accounts must never be imported

This is the hard requirement the principle above creates, and it is stronger than
housekeeping.

An envelope is credited by its **allowance rule**, automatically, whether or not money
physically moved. Import the real transfer as well and the app records it a second time
— as phantom household income and a phantom expense at best, and as a doubled envelope
credit if the incoming side is scoped personal. The bank movement is plumbing; the rule
is the truth; recording both is wrong in every direction.

Both sides of a transfer pair get excluded, which nets correctly against a summed
anchor. The import preview already has per-row skip plus select-all and deselect-all
(`csv-import-dialog.tsx:362`), so this needs **no new code** — it is a habit at import
time, and it belongs in whatever import instructions the app or the docs end up giving.

### CSV import scope — back in, and cheaper than this doc assumed

An earlier version of this section cut the import scope choice outright, on this doc's
own warning that it is the dangerous control. Reading `csv-import-dialog.tsx` changed
the answer: the five-step wizard already has a preview with **per-row category
override** and per-row skip. The scope control is the same pattern on an adjacent field,
not a new mechanism, and the preview the doc wanted people to check is already there and
already being read.

- **Mapping step:** one choice for the file — "Shared", "Mine", or another member.
  Defaults to Shared.
- **Preview step:** per-row override, mirroring the existing category override.
- **Preview step:** skip, which already exists, for the transfer rows.

Three-way rather than a shared/personal toggle, because one person will import the
other's export on their behalf. The control is really "whose is this", so it is a select
over the household members plus Shared.

**Importing another member's file shows you their transactions in the preview, and the
app then hides those rows from you.** That is inherent — you are holding their export —
but it means the scope filter will appear to be doing something it is not. Nothing to
build; [Phase 10](10_privacy_page.md) must not imply otherwise.

### Naming people, without encoding gender

The UI has to name a person on the import control, the Budget line, the members list and
`/my-money`. It must not do so with "his"/"hers", and "partner" is avoided too — it
assumes a relationship shape, and a name makes the word unnecessary.

**Language: "Shared" / "Mine" / "&lt;name&gt;".** From the viewer's seat "Mine" is always
correct and needs no label, so only the other person is ever named.

**The display name lives in the vault, not the account.** `users` has no name column and
adding one means a migration against a schema already applied to production — but more
to the point, the server has no business knowing what either of you is called. Each
member sets their own in Settings; it defaults to the local part of their email so there
is always something to render and signup gains no blocking step. Between the other
member signing up and their first sync you may have only their email; the same default
covers it.

**This rule is about UI copy, not about this document.** The prose below uses "partner"
descriptively, which is fine — it is describing who the feature is for. What ships to
the screen uses a name.

### Adjustments are for agreed changes to a claim, not for missed spending

An earlier draft of this section proposed a personal adjustment as the fix for
"you paid cash and never logged it". **That is wrong.** Unlogged spending is a fact that
happened, and the fix is to record it — `src/routes/transactions/new.tsx` is a full
manual entry form and gains the scope field like any other entry point.

Reserve adjustments for the case where nothing happened in the real world and the
household has agreed to change who has a claim: a birthday top-up, or calling it even
and wiping the slate. Keeping them rare is what stops a mechanism that can hide errors
from being used to hide errors.

So the two reconciliation points are:

- **Household total** — re-anchor. This one genuinely forgives drift; that is its job.
- **Envelopes** — log the missing transaction. Adjustment only by agreement.

Allowances start from zero, so a member joining needs no opening balance and the
`adjustment`-at-join case in the model below does not arise in v1.

### Personal accounts are load-bearing, and the privacy page needs to know why

Worth recording because it is easy to reason the opposite way. The scope split is
UI-enforced: both members hold the household key and either browser can decrypt
everything. What makes the privacy *real* is that the spending happened on a separate
card — buy a present on the shared account and it is on the statement regardless of what
the app does.

So the personal accounts are not bookkeeping to be optimised away. They are the
mechanism; the app is the ledger that keeps the household's totals honest about them.

### What v1 does not build

**`userId` is not refactored.** The data-model section below says `userId` stops being
`'local'` and becomes the real user id across every entity, and calls that unavoidable.
It is avoidable, because a household row genuinely has no owner — only a personal one
does. v1 adds **`ownerUserId`, set only when `scope === 'personal'`**, and leaves
`userId: 'local'` exactly where it is. One optional field and a filter, instead of a
refactor across every entity and hook. The real user id arrives from the account
created in [Phase 4](04_onboarding_rewrite.md), so it is available by the time a
personal row can exist.

If a later phase needs real ownership on household rows — an audit trail, "who entered
this" — that is when the full refactor earns its cost.

**`scope` goes on `Transaction` and `Category` only.** Not `BudgetRule`: the "Decisions
still to make" section already recommends cutting personal sub-budgets on the grounds
that the envelope balance *is* the discipline. Taking that recommendation removes the
third table from the migration. `ForecastRule` was already excluded.

**Net Wealth shows the net figure, not the per-member breakdown.** The subtraction
itself is not optional — without it the balance lies — but surfacing the breakdown
waits.

**No bulk re-scope.** There is no multi-select edit on the transactions table; the
existing "apply to all matching" dialog is description-based and category-specific
(`bulk-category-dialog.tsx`). Exceptions — the groceries bought on a personal card — get
fixed one at a time on the transaction edit form. If that grates in practice, the fix is
to extend the description-matching pattern that already exists rather than to build a
selection tool. Wait and see how many exceptions there actually are.

**The open decisions are taken as recommended**, rather than left open:

- Overspend is allowed and the balance goes negative; the next credit pays it down.
- The envelope balance ignores the header date range and is labelled as a today figure.
  It sits in its own card above the range-filtered content so the exception is visible
  rather than silent.
- The screen is `/my-money`, nav item "My Money".
- Personal categories are labels only.
- The other member sees the envelope balance and the next credit date. Both were already
  settled as yes below; neither reveals anything the household total does not imply.

**Two-writer vault conflicts are not solved here.** The existing pull-or-overwrite UI
stands. `00_overview.md` records that as a v1-wide deferral, not a Phase 8 one.

**Kept, despite looking cuttable:** the effective-dated allowance rules. A single
mutable row per member is barely less work and it retroactively rewrites every past
month's balance the first time an allowance changes — the exact failure the model
section below was written to avoid. It is also the same rule-plus-cadence shape as
`BudgetRule`, which already exists.

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

For the real v1 setup — one shared account and one personal account each — that means the anchor is the sum of all three, and re-anchoring is the monthly ritual that keeps it honest. See "The governing principle" above; it is also why transfers between those accounts must never be imported.

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

This must never be described to users as though the other member *cannot* see the detail. Phase 10's privacy page is where that would get overclaimed by accident.

**What makes the privacy real is the separate card, not the app.** A purchase made on the shared account appears on a statement both members can read, whatever `scope` says. The app's filter keeps the household's numbers honest about a division that already exists in the world; it does not create one. That is the honest sentence for Phase 10, and it is also why the personal accounts are not a detail to be optimised away.

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

Both need a whose-is-this choice — Shared, Mine, or another member.

On the manual form (`src/routes/transactions/new.tsx`) it is one field.

On import it was assumed to be the dangerous one — a mis-scoped import dumps hundreds of rows into the wrong pool, and undoing that by hand is miserable. That worry is answered by machinery the wizard already has rather than by leaving the control out: a file-level default at the mapping step, a per-row override at preview alongside the category override that is already there, and the preview itself stating what is about to land. See "CSV import scope" above for the shape.

### Changed: Settings

A Members & Allowances pane: who is in the household, each member's allowance and cadence, and the invite affordance from [Phase 7](07_invite_flow.md). This is also where an allowance change happens, which means it is where the effective-dated rule gets closed and reopened.

### Unchanged

Scenarios, Savings goals, Insights and Net Wealth's goal tracking all stay purely household. Personal money deliberately does not get scenarios, forecasts, or savings goals in v1.

---

## Data model

- `scope: 'household' | 'personal'` on `Transaction`, `Category`, `BudgetRule`. Existing rows default to `'household'`; the Dexie migration is a straight backfill.
- **`ForecastRule` does not get `scope` in v1.** Recurring personal expenses are plausible but unproven, and forecasting is the heaviest machinery in the app to extend.
- ~~`userId` stops being `'local'` and becomes the real user id.~~ **Not in v1** — see the trim above. `ownerUserId` on personal rows only; `userId: 'local'` is left alone. `DECISIONS.md` calls the full change "a large refactor across every entity and hook", which is exactly why v1 does not take it.
- Member display names live in the vault, not on `users`. The server never learns them.
- New allowance rule entity, effective-dated, per member.
- Personal balance is **computed, never stored**.

---

## Decisions still to make

**All of these are now taken for v1** — see "The open decisions are taken as
recommended" above. They are kept in full because the reasoning is what makes each
answer defensible, and because a post-v1 revisit should start from the argument rather
than from the conclusion.

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
- Import all three real exports for one month. Confirm the computed balance lands on the summed anchor, and that excluding both sides of each transfer pair is what makes it land — importing them should visibly inflate income and expenses while leaving the balance unchanged, which is the failure this is guarding against.
- Import a file scoped to the other member and confirm the rows are invisible afterwards to the person who imported them.
