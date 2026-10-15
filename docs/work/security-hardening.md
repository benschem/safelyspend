# Lower-severity security findings in auth, sync and the worker

- **Status:** not started. Each item below needs confirming before it is
  planned; the ones marked "Read 2026-10-13" were read in the code, none
  was exercised.
- **Goal:** every finding below is either fixed, or accepted with its reason
  in `docs/reference/DECISIONS.md`.
- **Touches:** `src/lib/account.ts`, `src/lib/envelope.ts`,
  `src/hooks/use-sync.ts`, `worker/src/`.

From the 2026-10-13 code review, which ran against 0.44.7. An entry marked
"Read 2026-10-13" was read in the code at 0.47.1 and its line numbers are
from then. Every other entry is as the review reported it, with 0.44.7 line
numbers.

The review called these weaknesses, not vulnerabilities. The two it called
vulnerabilities are handled: the safety number in `household-join.md`, and
email-only takeover, which the maintainer accepted.

## With a queue line each

Read 2026-10-13, none of them exercised:

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
  refuse anything below `ARGON2ID_PARAMS`. `account.test.ts` swaps
  `ARGON2ID_PARAMS` for cheap ones with `vi.mock`, so the floor must follow
  that constant, or the account tests will fail.
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

## Without a queue line

As reported:

- Account deletion is three unbatched steps.
- The orphan cleanup can race a vault upload (`services/vault.ts:180`,
  `:315-359`).
- `household_member_keys.sender_user_id` has no `ON DELETE`, so deleting a
  sender with a pending handoff may fail. Goes away with `household-join.md`.
