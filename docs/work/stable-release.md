# What 1.0 needs before SafelySpend leaves beta

- **Status:** not started. The bar was decided on 2026-10-15. The criteria
  below are proposed and each needs a yes.
- **Goal:** SafelySpend leaves beta at 1.0.0 when someone outside the
  maintainer's household can sign up, set up a budget unaided, share it with
  a partner, and trust the figures.
- **Touches:** `package.json`, `src/lib/changelog.ts`,
  `docs/reference/DECISIONS.md`.

## Why

In 0.x anything can change. Several decisions lean on that: there are no
users yet, so old clients and old formats are not handled. A stranger
trusting the app with their money needs that to stop being true, and needs
the figures to be right.

## Decided

- The bar is "a stranger can use it". Narrower ("safe for the maintainer's
  household") and broader ("public launch", with every security finding
  fixed and the landing page rewritten) were both considered.

## Proposed criteria

Each names the work files that meet it.

- **No silent data loss:** `sync-merge.md`, `sync-newer-data.md`,
  `delete-cascades.md`, the atomic finish in `wizard-fixes.md`, and
  `fake-indexeddb.md`, so schema upgrades and transactions are tested
  rather than assumed.
- **The figures are right:** `fortnightly-anchor.md`,
  `cash-card-no-plan.md`, `cash-flow-averages.md`, `future-month-end.md`,
  `balances-from-anchors.md`, `interest.md`.
- **Two people can share a budget:** `sync-merge.md`, `sync-prompt.md`,
  `sync-indicator.md`, `sync-merge-duplicates.md`.
- **A newcomer can finish setup:** `onboarding-questions.md`,
  `account-page.md`.
- **Checks are enforced:** `ci.md`.
- **Security findings are fixed, or accepted with a reason in
  `DECISIONS.md`:** `security-hardening.md`.
- **The "no users yet" shortcuts end.** From 1.0, every released data
  version and vault format keeps opening, and an old client is handled
  rather than ignored. This retires "Old clients are ignored" in
  `sync-merge.md`, and makes the anti-downgrade protection that
  `DECISIONS.md` names under "Why there is no v0.37 → v2 migration" a
  requirement for any new format. It is a commitment that starts at 1.0, not
  a task.

## Open questions

- Is leaving a household needed? A stranger's household can break up, and
  deleting the account is the only way out today.
- Is `household-join.md` needed?

## Not in this plan

Currency, financial year, the landing page rewrite, and form and link
polish.

## Not checked

Where the app shows the word "beta" today.
