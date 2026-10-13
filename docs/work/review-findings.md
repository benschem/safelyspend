# Findings from the 2026-10-13 code review without a work file of their own

- **Status:** not started. A holding file: several queue lines point here.
  When one is picked up it gets its own work file and its section here is
  deleted.
- **Goal:** every finding below is either confirmed and fixed, or checked and
  dismissed.
- **Touches:** given per section.

The review ran against 0.44.7 with three sub-reviews: the UI, the domain logic
and the crypto, auth and worker code. An entry marked "Read 2026-10-13" was
read in the code at 0.47.1 and its line numbers are from then. Every other
entry is as the sub-review reported it, with 0.44.7 line numbers, and needs
confirming before it is planned. Other findings have their own files:
`balances.md`, `dead-code.md`, `ci.md`, `delete-cascades.md`.

## Split `SettingsPage`, and one panel for cash and savings anchors

Touches `src/routes/settings.tsx`. Overlaps `account-page.md`.

- `SettingsPage` (`settings.tsx:83-1635`) is one component with 35
  `useState` calls.
- Cash anchor and savings anchor CRUD are written twice: state at `:98-124`,
  handlers `:426-504` against `:507-599`, list markup `:662-703` against
  `:745-800`, dialogs at `:1290` and `:1359`.
- The two have already drifted: only the savings one rejects a negative
  amount (`:453` against `:541-549`).
- It uses both an inline `showMessage` alert (`:317`) and sonner toasts
  (`:209`), and parses amounts with raw `parseFloat` (`:451`, `:539`).

## Split the Cash Flow page, and one table in place of four near-copies

Touches `src/routes/cash-flow/index.tsx`.

- `CashFlowContent` (`:150-1160`) is a 1,000-line component.
- `BreakdownTable` (`:1198-1713`) renders four near-identical layouts. The
  pill-toggle class string appears seven times in the file.
- `TwoColRow` and `ThreeColRow` (`:1793-1959`) duplicate each other.
- Logic with no test: remaining flows, pace status and projections at
  `:253-289` and `:407-582`. Projection maths also sits inside
  `burn-rate-chart.tsx:211`.

## The import dialogs repeat one pipeline, and a failed write leaves them stuck

Touches `src/components/csv-import-dialog.tsx`,
`src/components/up-import-dialog.tsx`.

- File validation, duplicate detection and `handleImport` are near-identical:
  `csv-import-dialog.tsx:161-217`, `284-306`, `414-524` against
  `up-import-dialog.tsx:70-178`, `146-168`, `180-290`.
- Neither `handleImport` has a try/catch, so a failed `bulkImport` leaves the
  dialog on "importing".
- `CsvImportDialog` (`:68-976`) is 900 lines with 20 `useState` calls.

## One way to build a form, one amount parser, one way to report a result

Touches `src/components/dialogs/`, `src/routes/transactions/new.tsx`,
`package.json`. Overlaps `form-errors.md` and `form-labels.md`.

- Five dialogs use a `useState` per field plus an effect that resets them on
  open: forecast rule (`:117-166`), savings goal (`:66-108`), category
  budget, transaction and scenario.
- `@tanstack/react-form` is installed and used only in
  `routes/transactions/new.tsx`, a route nothing links to.
- Amounts are parsed by `parseCentsFromInput` in some places and raw
  `parseFloat` in others.
- New forms should use React 19 form actions. The rule is in
  `docs/reference/CONVENTIONS.md` under "Form actions".

## Smaller findings

With a queue line each. Read 2026-10-13:

- **The first-run wizard's finish is not atomic.** `handleFinish`
  (`first-run-wizard.tsx:938-1004`) awaits each write on its own: the
  scenario, the cash anchor, each goal and its anchor, each allowance, then
  the initialised flag. A failure part way shows "Setup failed. Please try
  again", and the retry adds a second scenario and anchor. Remedy: one
  `db.transaction` around all of it.
- **An import rule's `payee` option is never read.** `matchField` is
  `'description' | 'payee'` in `types.ts:139` and `import-schema.ts:125`.
  Both places that create a rule write `'description'`, and no matching code
  reads the field, so only an imported file can carry `'payee'` and it is
  then matched as a description. Remove the option or honour it. Removing it
  changes the import schema: see `.claude/rules/schema-versioning.md`.
- **Every `useTransactions()` call loads the whole table.** The hook runs a
  second live query, `db.transactions.toArray()`, beside the ranged one
  (`use-transactions.ts:35`). Not re-read: that `useReportsData` calls it
  twice and `useForecasts` loads the table again.

Without a queue line, as reported:

- Errors swallowed at `check-in-wizard.tsx:780` and `settings.tsx:164`.
- `first-run-wizard.tsx:120` says "Nothing is sent to a server". Possibly
  stale now that sync exists; sync is opt-in.
- Dates in the import schema are `z.string()` with no format check.

## Security: lower severity

Touches `src/lib/account.ts`, `src/lib/envelope.ts`, `src/hooks/use-sync.ts`,
`worker/src/`. The sub-review called these weaknesses, not vulnerabilities.
The two it called vulnerabilities are handled: the safety number in
`household-join.md`, and email-only takeover, which the maintainer accepted.

With a queue line each. Read 2026-10-13, none of them exercised:

- **Signup with an invite can overwrite a user's keys.** In
  `POST /auth/signup-with-invite` (`worker/src/routes/auth.ts:416`) the
  "already signed up" check runs before the batch. Two requests for the same
  user, each with its own bridge token, can both pass it. In the second
  batch `signupUserStatement` matches no row (`WHERE pubkey IS NULL`), which
  is a success with zero changes, so the batch goes on: the two
  `upsertUserKeyStatement` calls replace the first request's wrapped private
  keys, and a session is issued. The account then holds one request's public
  key and the other's wrapped private key. The comments at
  `services/users.ts:302` and `services/invites.ts:155` say a zero-row
  UPDATE rolls the batch back; `consumeAuthPending` in `services/auth.ts`
  says correctly that it does not. `POST /auth/signup` runs the same
  statements but also inserts a household and a member, and is assumed to
  fail there on a unique index (the schema was not read). Remedy: check
  `meta.changes` on the first statement's result, or make the key writes
  plain inserts so a second one fails. Correct both comments.
- **No floor on the Argon2id parameters the server sends.**
  `deriveLoginVerifier` (`src/lib/account.ts:725-745`) passes whatever the
  challenge holds to `deriveVerifier`, and `decodeArgon2idParams`
  (`envelope.ts:223`) checks only the length. A malicious server could ask
  for cheap parameters and brute-force the verifier it gets back. Remedy:
  refuse anything below `ARGON2ID_PARAMS`.
- **A rolled-back vault cannot be told from a current one.** The associated
  data is version and kind only (`envelope.ts:244`), and a pull stores
  whatever version it is given (`use-sync.ts:145-157`). Remedy: bind the
  household id and version, and refuse a version below the local one.
  `sync-merge.md` rewrites the pull.
- **CSRF protection relies on `SameSite=Strict` alone**
  (`worker/src/lib/session.ts:20`). There is a CORS allow-list in
  `worker/src/index.ts` and no CSRF middleware or Origin check. Reported and
  not re-read: bodyless POSTs skip the content-type gate, and it is only
  exploitable from a sibling subdomain. Remedy: `hono/csrf`.
- **The "daily" OTP lockout only looks back an hour.** `isUserLockedOut`
  (`worker/src/services/auth.ts:89-99`) sums failed attempts over a day, and
  `cleanupExpiredCodes` deletes those rows after an hour. Reported and not
  re-read: anyone who knows an email address can use up its verify attempts.
- **Five wrong codes block sign-in for up to ten minutes, new code or not.**
  A wrong code adds one to `attempt_count` on every active code, and
  `verifyAuthCode` (`worker/src/services/auth.ts:41-50`) returns 429 while
  any unexpired, unused code has five or more. The message says to request a
  new code. `createAuthCode` inserts the new one and leaves the old ones
  active, so the 429 stays until they expire. Remedy: mark the user's other
  codes used when a new one is issued.
- **A rotated recovery session gets a fresh reset window.**
  `/auth/recovery-reset` allows a JWT up to 5 minutes old by its `iat`
  (`worker/src/routes/auth.ts:580`). A recovery session gets the ordinary
  session lifetime of 7 or 30 days (`auth.ts:272`). Once its JWT is within
  3.5 days of expiry, any authenticated call rotates it, and `jwtSign` stamps
  a new `iat` (`middleware/auth.ts:53-73`, `lib/crypto.ts:104`). So a
  recovery cookie more than 3.5 days old can reset the password again. The
  recovery path already lets mailbox control reset the password, which is an
  accepted risk; this widens it to a stolen cookie. Remedy: give a recovery
  session a lifetime of minutes, or carry the original issue time in a claim
  that survives rotation.
- **Hand-rolled HS256 JWT** (`worker/src/lib/crypto.ts:82-168`) where
  `hono/jwt` exists. Reported and not re-read: base64url is implemented
  three times.

Without a queue line, as reported:

- Account deletion is three unbatched steps.
- The orphan cleanup can race a vault upload (`services/vault.ts:180`,
  `:315-359`).
- `household_member_keys.sender_user_id` has no `ON DELETE`, so deleting a
  sender with a pending handoff may fail. Goes away with `household-join.md`.
