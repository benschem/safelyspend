# Onboarding asks questions a new person cannot answer

- **Status:** not started. Raised 2026-10-11. Direction not yet decided; the options are below.
- **Goal:** a new person gets through setup and a first import without needing a
  past balance or a rule for transfers and cash, and someone joining a
  household is asked for their own balance.
- **Touches:** `src/components/first-run-wizard.tsx`,
  `src/components/csv-import-dialog.tsx`,
  `src/components/up-import-dialog.tsx`, `src/lib/up-csv-parser.ts`,
  `src/routes/household-waiting.tsx`, `src/components/check-in-wizard.tsx`.

Raised 2026-10-11, by the maintainer backfilling a real Up account to 1 January
and getting stuck three times. If the person who wrote the app has to ask, a new
user has no chance. **Traced through the code, not exercised**, except where
noted.

The three questions, each with the answer the app already implies but never
says:

- **"What was in each saver on my starting date?"** The wizard uses one
  `startingDate` for the cash balance and every saver
  (`first-run-wizard.tsx:888`), and Up, like most banks, only shows today's
  balance. The number is not needed: leaving it blank creates no savings anchor
  (`first-run-wizard.tsx:968`), a balance set later for today gives the right
  current figure (`use-reports-data.ts:389`), and the per-goal history already
  works backwards from it (`use-reports-data.ts:505`).
- **"What do I do with transfers, including ones to my partner?"** The rule is
  whether the other account is counted in the balance anchor. Counted: skip
  both sides at import, because the total did not move. Not counted: it is a
  real expense or income. `household-personal-money.md` states this as a hard
  requirement and then leaves it as "a habit at import time". Nothing in the
  import dialog says it.
- **"What do I do with cash out?"** Same rule. Cash in a wallet is not in the
  anchor, so the withdrawal is the moment the money leaves: import it as an
  expense. Skipping it and entering each cash purchase by hand leaves the app
  ahead of the bank until the next re-anchor wipes the difference.

**The second person in a household never sees the wizard.** Joining pulls the
household vault and goes straight to `/cash-flow`
(`household-waiting.tsx:323`), and the pull's `importAllData` is what marks the
device initialised (`db.ts:227`). Two things follow:

- Anything explained only in the wizard reaches one member of the household.
  The transfer and cash rule has to live where both people import.
- Nobody asks the joiner for their own account balance. Phase 8 makes the
  anchor the sum of every account, but the first person's wizard set it from
  what they knew, and the join path has no step that adds the joiner's. Until
  someone re-anchors, the joiner's imported spending comes off a balance that
  never included their money.

Directions, not yet decided:

- **Joining: prompt for a re-anchor once the shared budget has downloaded**,
  saying the figure is now every account between the two of them. The check-in
  wizard already sets a balance anchor, so this may be a matter of opening it
  with different copy.
- **Savers: ask for today's balance in the wizard**, keeping the cash anchor on
  the starting date. Removes the question instead of helping people answer it.
  The saver step then needs a line on why its date differs from the cash step.
  The alternatives are a "work it out for me" helper that subtracts the imported
  transfers from today's balance, or copy telling people to skip the step.
- **Transfers and cash: say the rule once, in the import preview**, where the
  skip tickboxes already are. Something like: money moved between accounts you
  are tracking is not spending, so untick both sides. Cash out gets its own
  line, or a default "Cash" category.
- **Flag likely transfers in the preview.** The Up parser drops rows typed
  `Transfer`, `Round Up` and `Cover`, and the payee `2Up`
  (`up-csv-parser.ts:36`). A payment to a partner's own account probably
  arrives as an ordinary payment and is imported. Matching an outgoing row
  against an incoming one of the same amount and date across files would catch
  most of them. Bigger; decide separately.

Not checked:

- What transaction type Up gives a payment to another person's account. Look at
  one in the preview before writing any matching.
- That saver transfers import as `savings` transactions linked to the right
  goal. The backwards calculation is wrong if they arrive as plain expenses.
- How `savings-over-time-chart.tsx` draws the months before a saver's only
  anchor.

For anyone who does want a true starting figure: Up's public API lists each
account's transactions, so the balance on a past date is today's balance minus
everything since. Worth a line in the help copy only if the wizard keeps asking.
