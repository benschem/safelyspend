# The first-run wizard's finish is not atomic, and other wizard loose ends

- **Status:** not started. The first item was read in the code on
  2026-10-13 at 0.47.1. The other two are as the 2026-10-13 code review
  reported them, with 0.44.7 line numbers.
- **Goal:** a failed setup can be retried without leaving duplicates, the
  wizard's privacy wording is true, and the check-in reports its errors.
- **Touches:** `src/components/first-run-wizard.tsx`,
  `src/components/check-in-wizard.tsx`.

- **The finish is not atomic.** `handleFinish`
  (`first-run-wizard.tsx:938-1004`) awaits each write on its own: the
  scenario, the cash anchor, each goal and its anchor, each allowance, then
  the initialised flag. A failure part way shows "Setup failed. Please try
  again", and the retry adds a second scenario and anchor. Remedy: one
  `db.transaction` around all of it.
- **Possibly stale wording.** `first-run-wizard.tsx:120` says "Nothing is
  sent to a server". Sync now exists, though it is opt-in.
- **A swallowed error** at `check-in-wizard.tsx:780`.

Related: `onboarding-questions.md` also changes the first-run wizard.
