# Up Bank sync (parked)

- **Status:** parked. Wishlist. Explored 2026-10-13 and found viable. The
  maintainer wants to live with the app as it is first, and the backlog is
  already long. Nothing here has been built, and this file records what it
  would take; it has no steps. Needs `sync-merge.md` first.
- **Goal:** the app fetches new transactions from Up when it opens, in place
  of importing a CSV by hand.
- **Touches:** `src/lib/up-csv-parser.ts`,
  `src/components/up-import-dialog.tsx`, `src/components/check-in-wizard.tsx`.
  No worker change.

The question was whether Up's API could automate check-ins, syncing constantly
or daily, and whether that would be better than importing a CSV by hand.

## Verdict

- **Fetch on open** (tier 1): a modest feature and better than the CSV
  import. No export and upload, dedupe on real ids instead of fingerprints,
  and no double import across a household. No backend change is needed.
- **Optional check-in** (tier 2): most of the work and most of the risk, and
  not obviously an improvement. See "Issues it would cause". Do not start
  there.
- **Background sync**, with webhooks or a cron: the wrong shape for this app,
  and it gains almost nothing.

## Why "constantly" and "on open" are the same thing here

The budget only exists decrypted in the browser. New transactions can only
land while the app is open, so a background sync has nowhere to write.

- **Pull on open.** The browser calls Up directly. Up's API answers a
  cross-origin preflight with `access-control-allow-origin: *` and allows the
  `authorization` header, so no proxy or worker route is needed. To the person
  using the app this cannot be told apart from constant sync.
- **Webhooks or a daily cron.** The worker would have to hold the Up token and
  see transactions in plaintext, then queue them for the client. That breaks
  "the server never sees your data". The only thing it adds is the ability to
  send a push notification.

## Tier 1: fetch on open, keep the check-in

The check-in stays, and loses its import step.

- **Token.** Up offers personal access tokens only, with no OAuth, so each
  person pastes their own. Keep it on the device, not in the vault: the vault
  is shared with the household, and a token in it would let a partner's device
  read the owner's personal accounts.
- **CSP.** Add `https://api.up.com.au` to `connect-src` in `public/_headers`
  and `index.html`.
- **A small client.** A paginated fetch of transactions since the last sync.
  Fetch with an overlap of a couple of weeks every time, because the import is
  safe to repeat (see identity below) and recent transactions change.
- **Extract the import pipeline first.** Category rules, category creation and
  the mapping to a `Transaction` live inside `handleImport` in
  `src/components/up-import-dialog.tsx`. Move them to `src/lib` so the CSV
  dialog and the fetch share one path. The skip rules in
  `src/lib/up-csv-parser.ts` carry over. Up's API gives category ids where the
  CSV gives names, so that needs a mapping.
- **Record identity.** Give each imported row the id `up-<Up transaction id>`,
  the trick `sync-merge.md` uses for `closed-<goalId>`.
  - Two household devices that fetch the same 2Up transaction then hold one
    record, and the merge needs no extra dedupe. This would close the
    duplicate import in `sync-merge-duplicates.md` for anything fetched this
    way.
  - A re-fetch may only write bank-owned fields (amount, status). Otherwise it
    overwrites a recategorisation.
  - A row the user deleted must stay deleted, which means checking the
    tombstones `sync-merge.md` adds.
- **Cut-over from CSV.** Rows already imported by CSV have random ids and an
  `importFingerprint`, so fetching the same history would duplicate them. Start
  the fetch the day after the last CSV row.
- **Cheap extra: prefill the check-in from Up's balances.** Map each Up
  account to cash, a savings goal, or ignored, and use the balances to fill in
  the "does this match your bank?" steps. This needs the account mapping but no
  transfer classification.
- **Housekeeping.** Privacy page copy (the browser now talks to the bank),
  states for a revoked token and for being offline, and no fetch in demo mode.

## Tier 2: always current, check-in optional

Tier 1 plus the three things the check-in does by hand today.

### Account mapping

The app has one cash balance and savings goals with no link to a bank account;
`Transaction` and `BalanceAnchor` carry no account. Each Up account needs a
role: cash, a specific `SavingsGoal`, or ignored. This is the rule
`onboarding-questions.md` states for transfers: whether the other account is
counted in the balance anchor.

### Transfers stop being skipped

The CSV parser drops transfers, and savings movements are entered in the
wizard. With the mapping, the sync classifies them:

- **Cash to a saver:** one `savings` transaction against the mapped goal,
  taken from one side of the transfer only.
- **Cash to cash**, such as spending to 2Up: ignored.
- **Interest and round-ups into a saver:** undecided. A `savings` transaction
  reduces cash, and interest never came from cash.

### Reconciliation replaces the balance step

The balance step is a checksum: it catches whatever the import missed. Keep it
as an automatic check instead of writing an anchor on every sync, because
silent anchors would hide import bugs.

- Compare the derived balance with Up's on each sync, for cash and for each
  mapped saver. Show "matches bank" or "out by $X", with one click to accept
  the bank's figure.
- An accepted figure writes an anchor with an id derived from its date, so two
  devices accepting on the same day do not leave two anchors.
- Held transactions must be imported, and updated or removed as they settle.
  Up's balance includes them, so importing settled ones only would never
  reconcile.
- The balance sum is written out three times in
  `src/components/check-in-wizard.tsx`. It has to become one function first.

### What happens to the check-in

- It stays as it is for anyone not on Up, so both paths are kept.
- For a linked account, drive the sidebar's "Due" badge from exceptions (the
  balance is out, or there are transactions to review) instead of days elapsed.
- Uncategorised expenses need somewhere to land, since no wizard forces a look.

## Issues it would cause

Mostly from tier 2.

- **Silent errors replace visible ones.** Today a wrong number is one somebody
  typed. A misclassified transfer or round-up would make "safe to spend" wrong
  with nothing to show it. The balance checks catch most of it, but not
  miscategorised spending.
- **A standing credential in the browser.** Today the app holds only what was
  imported. A token is live read access to the whole banking history, so an
  XSS bug becomes far more serious. The CSP limits where a script could send
  it.
- **Held transactions churn.** Amounts change and pre-authorisations vanish, so
  records keep being rewritten. Under the merge's whole-record last-write-wins,
  a bank update on one device could beat a partner's recategorisation on
  another.
- **Two paths to maintain.** Every change to balances or savings has to work
  for the manual check-in and for the automatic one.
- **Other banks break the checksum.** A credit card or an account elsewhere
  means derived cash never equals Up's balance.
- **The habit goes.** An always-current dashboard is what Up's own app already
  is. This app's value is the plan, and the check-in is what makes people look
  at it.
- **It only helps Up customers** who are willing to paste a token.

## Order, if it is picked up

1. Land `sync-merge.md`.
2. A throwaway read-only script against the maintainer's own token, to see how
   transfers, round-ups, interest, held transactions and a payment to a
   partner's account actually arrive. Everything under "Transfers stop being
   skipped" depends on it.
3. Extract the import pipeline and the balance function.
4. The fetch, with ids derived from Up's.
5. Account mapping, and balances prefilled into the check-in.
6. Transfers, the reconciliation check, and loosening the check-in.

Steps 1 to 4 are tier 1. Stop there and use it for a while. If the wizard
still feels like a chore, that will show which step to automate next.

## What would bring this back

- The CSV export and upload becoming the reason check-ins get skipped.
- Both partners importing regularly and tripping over duplicates.
- `sync-merge.md` landing, which removes the main prerequisite.

## Not verified

- **Checked on 2026-10-13:** Up's CORS preflight, by sending an `OPTIONS`
  request to `https://api.up.com.au/api/v1/util/ping` with an `Origin` and a
  requested `authorization` header. No token was sent and no data was fetched.
- **From memory, not checked against Up's current documentation:**
  - that the API is read-only;
  - that tokens are personal access tokens with no OAuth;
  - that transactions have a held and a settled status, and stable ids;
  - that a transfer names the other account;
  - that an account's balance includes held transactions;
  - how round-ups and interest are represented.
- **Not checked in this app:**
  - how actual interest paid into a saver is recorded today;
  - whether the Transactions page can already filter to uncategorised
    expenses;
  - whether Up's `createdAt` matches the CSV's `Time` closely enough to match
    old CSV rows to fetched ones, which would allow a backfill instead of a
    cut-over date.
