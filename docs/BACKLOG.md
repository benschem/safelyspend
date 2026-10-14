# Backlog

The only list of work. One line per item, and position is priority: the top
line of Now is the next thing to do. Read [`README.md`](README.md) before
adding to this file or working from it.

**Areas:** sync, household, auth, bills, budget, cash-flow, categories,
import, forms, onboarding, savings, settings, scenarios, landing, demo,
release, tooling, codebase.

`tooling` is the build, test and hosting setup. `codebase` is code with no
single home in the app.

## Now (at most three)

- [feature] Sync merges both people's edits → work/sync-merge.md _(sync)_
- [cleanup] Faster tests, and a pre-push hook runs every check → work/ci.md _(tooling)_

## Next (aim for 5 in here)

- [feature] Show unsynced changes and changes to pull → work/sync-indicator.md _(sync)_ · after sync-merge
- [feature] One sync prompt, and sign-in syncs → work/sync-prompt.md _(sync, household)_ · after sync-merge
- [bug]     An older app version drops newer fields on a sync pull, prevent pulling if the version is newer → work/sync-newer-data.md _(sync)_ · after sync-merge
- [bug]     A merge can leave two of something, an import included → work/sync-merge-duplicates.md _(sync, import)_ · after sync-merge
- [feature] Check-in cadence does not sync → work/sync-follow-ups.md _(sync)_ · after sync-merge
- [bug]     A fortnightly rule can land in the wrong week → work/fortnightly-anchor.md _(bills, cash-flow)_
- [bug]     With no plan, the cash card says negative and behind → work/cash-card-no-plan.md _(cash-flow, onboarding)_
- [bug]     Cash Flow compares a dated month with an average → work/cash-flow-averages.md _(cash-flow, scenarios)_
- [bug]     A future month's planned month end skips the months before → work/future-month-end.md _(cash-flow)_
- [bug]     Demo personas count their bills twice → work/demo-personas-budgets.md _(demo)_

## Later

- [cleanup] Delete dead code, and add a check for it → work/dead-code.md _(codebase)_
- [feature] Transactions filters, sort and page live in the URL _(categories)_
- [feature] Safe to spend → work/bills-set-aside.md _(bills, cash-flow)_
- [cleanup] Split the Cash Flow page; one table, not four → work/cash-flow-split.md _(cash-flow)_
- [bug]     Deletes leave references behind, and undo is partial → work/delete-cascades.md _(categories, savings, scenarios)_
- [bug]     Signup with an invite can overwrite a user's keys → work/security-hardening.md _(auth, household)_
- [feature] Join a household with a code → work/household-join.md _(household, auth)_
- [bug]     No floor on Argon2id parameters from the server → work/security-hardening.md _(auth)_
- [bug]     A rolled-back vault looks like a current one → work/security-hardening.md _(sync)_
- [bug]     The "daily" OTP lockout only looks back an hour → work/security-hardening.md _(auth)_
- [bug]     CSRF protection relies on `SameSite` alone → work/security-hardening.md _(auth)_
- [bug]     A rotated recovery session gets a fresh reset window → work/security-hardening.md _(auth)_
- [bug]     Five wrong codes block sign-in for ten minutes, new code or not → work/security-hardening.md _(auth)_
- [feature] An Account page, a findable log out, a sign-up entrance → work/account-page.md _(settings, auth)_
- [feature] Personal spending money for each member → work/household-personal-money.md _(household, budget)_
- [cleanup] Split `SettingsPage`; one panel for both anchors → work/settings-split.md _(settings)_
- [bug]     Two categories can end up with the same name → work/category-duplicates.md _(categories)_
- [bug]     Links and redirects that land in the wrong place → work/wrong-links.md _(categories, import, budget)_
- [polish]  Create a category on save, not on pick → work/empty-categories.md _(categories)_
- [polish]  Show a category's bills and allowance as two parts → work/bills-and-allowance-parts.md _(cash-flow)_
- [cleanup] Loose ends from one category limit → work/category-limit-loose-ends.md _(cash-flow)_
- [bug]     A failed import leaves the dialog stuck; two copies of it → work/import-dialogs.md _(import)_
- [polish]  Form errors are not announced to screen readers → work/form-errors.md _(forms)_
- [polish]  Form labels sit tight against their inputs → work/form-labels.md _(forms)_
- [polish]  Show-password toggle cannot be reached by keyboard → work/password-toggle.md _(forms, auth)_
- [cleanup] One way to build a form → work/one-form-pattern.md _(forms)_
- [cleanup] Replace `CreatableSelect` with the shadcn combobox → work/combobox.md _(forms)_
- [polish]  Revoke button loses its name while it works → work/revoke-button-name.md _(settings)_
- [polish]  Wording left over from the Bills rename → work/bills-rename-loose-ends.md _(landing, bills)_
- [polish]  Category names do not look like links → work/category-links.md _(categories)_
- [polish]  Landing page still sets bills apart from allowances _(landing)_
- [cleanup] Put `components.json` back for the shadcn CLI _(tooling)_
- [bug]     The worker accepts any string as an invite address → work/invite-address-check.md _(household)_
- [cleanup] Test against a real Dexie database with `fake-indexeddb` → work/fake-indexeddb.md _(tooling)_

## Maybe

- [cleanup] Sync tombstones are never pruned → work/sync-follow-ups.md _(sync)_ · after sync-merge
- [bug]     Logging out forgets the vault version → work/logout-vault-version.md _(sync, auth)_
- [feature] Onboarding asks questions a new person cannot answer → work/onboarding-questions.md _(onboarding, import, household)_
- [cleanup] Three undo toasts are hand-rolled → work/undo-toasts.md _(codebase)_
- [polish]  The dev console is noisy on `/login` → work/dev-console-noise.md _(auth, tooling)_
- [bug]     First-run wizard finish is not atomic → work/wizard-fixes.md _(onboarding)_
- [cleanup] An import rule's `payee` option is never read → work/import-dialogs.md _(import)_
- [cleanup] Hand-rolled JWT where `hono/jwt` exists → work/security-hardening.md _(auth)_
- [cleanup] Every `useTransactions()` call loads the whole table → work/transactions-query.md _(cash-flow)_
- [cleanup] Merge the budget rules table into forecast rules _(budget, bills, sync)_
- [cleanup] Move `dates.ts` to Temporal once Safari ships it _(codebase)_
- [feature] Superannuation
- [feature] Investments
- [feature] Debt
- [feature] Combine two existing budgets → work/combine-budgets.md _(sync, household)_ · after sync-merge, category-duplicates
- [feature] Suggest allowances from past spending _(import, budget)_
- [feature] Suggest bills from payments that recur _(import, bills)_
- [feature] Store which bill a transaction pays → work/bills-set-aside.md _(bills, import)_
- [feature] Fetch transactions from Up → work/up-bank-sync.md _(import)_ · after sync-merge
- [feature] Date format preferences _(settings)_
- [feature] Currency selection _(settings)_
- [feature] Financial year start _(settings)_
- [feature] Leave a household, or remove a member _(household)_
- [feature] Join without the invite link _(household)_
- [feature] Rename the household _(household)_
- [feature] Password strength meter _(auth)_
- [feature] Upgrade Argon2id parameters on unlock _(auth)_
- [feature] Turnstile on the login form _(auth)_
- [feature] Landing page rewrite → work/landing-rewrite.md _(landing)_

## Inbox

Not yet triaged. Add a line here for anything noticed while doing something
else.

- [bug]     A bill in an archived or deleted category is listed but not totalled → work/delete-cascades.md _(budget, categories)_
- [bug]     A bill that loses its due date loses its day _(budget, bills)_
- [cleanup] Month-end dates are built by hand from a `YYYY-MM` key in six places _(codebase)_
- [cleanup] Burn rate chart's day-by-day maths has no test → work/cash-flow-split.md _(cash-flow)_
- [cleanup] Landing fixtures format their own dates _(landing)_
- [cleanup] Work files cite code by line number, about 70 places _(codebase)_
- [cleanup] Move the frontend to Cloudflare if Netlify forces credit pricing _(tooling)_
- [cleanup] `KekKind` in `types.ts` is unused; `api-client.ts` has its own _(auth)_
- [polish]  An expense with no name becomes "general spending" unannounced _(budget, forms)_
- [bug]     Interest ignores savings anchors and is worked out four times → work/interest.md _(savings)_
- [bug]     Cash Flow starting balance may ignore adjustments in the period → work/balances-from-anchors.md _(cash-flow)_
- [cleanup] getEarliestAnchorDate in use-savings-anchors.ts has no caller _(savings)_
- [bug]     Confirming the check-in's cash estimate counts today's transactions twice → work/balances-from-anchors.md _(cash-flow)_
- [bug]     Deleting a goal leaves its future-dated transfers out of cash → work/delete-cascades.md _(savings)_
- [bug]     Savings and cash charts ignore a balance entered part-way through the range → work/balances-from-anchors.md _(savings, cash-flow)_
- [bug]     A goal with no entered balance starts its own savings chart at $0 → work/balances-from-anchors.md _(savings)_
- [cleanup] Breakdown segment list is written twice and its test checks neither _(budget, landing)_
- [cleanup] Index `categoryId` on `budgetRules`; `deleteCategory` scans the table _(categories)_
- [cleanup] Every balance comes from `balances.ts` → work/balances-from-anchors.md _(cash-flow, savings)_
- [feature] What 1.0 needs before leaving beta → work/stable-release.md _(release)_
