# SafelySpend backend API

This describes the Cloudflare Worker in `worker/` as built: the D1 schema, the
endpoint contracts, the session lifecycle, what is atomic, and the error
model. Envelope formats, KDF choices, the key hierarchy and the invite handoff
sequence are in `crypto-design.md`. Where this file and the code disagree, the
code is right.

In the invite sections, the inviter is the existing household member and the
invitee is the person joining.

---

## 1. Schema

The full DDL is `worker/migrations/0001_initial.sql`, the only migration. It
was written for an empty database, so there is no older format to read and no
per-user version state. This section covers the columns and constraints that
need explaining.

### 1.1 Tables

- `users`: one row per email address, with the password verifier and the
  public key.
- `auth_codes`: emailed login codes, stored hashed, with an attempt counter.
- `auth_pending`: single-use bridge tokens between the code step and the
  password step.
- `sessions`: one row per session, so a session can be revoked.
- `rate_limits`: the counters behind §10.
- `households` and `household_members`.
- `user_keys`: the wrapped private key.
- `household_member_keys`: the wrapped MasterKey.
- `invites`.
- `vaults` and `sync_state`: vault versions, and the current version for each
  household.

### 1.2 `users`, `vaults` and `sync_state`

`users` carries:

- `password_verifier`: 32 bytes, Argon2id of the password under
  `verifier_salt` (`crypto-design.md` §3.3).
- `verifier_salt`: 16 random bytes, independent of any `kek_salt`.
- `verifier_kdf_kind`: `0x02` (Argon2id) is the only value written.
- `verifier_kdf_params`: 9 bytes (`crypto-design.md` §3.2).
- `pubkey`: the 32-byte X25519 public key, in plaintext (`crypto-design.md`
  §1).

These columns are nullable because `/auth/login` creates the row on the first
code request, before signup has supplied any key material (§3.1). Until then
the row is inert: no `pubkey` means no `user_keys`, so no household membership
and no vault access.

Vaults belong to a household. `vaults` and `sync_state` have `household_id`
and no `user_id`. The user column was removed, not kept alongside, because a
leftover column that new code must remember never to read is worse than none.
`sync_state` has one row per household, with `household_id` as its primary
key. `vaults` has unique indexes on `(household_id, version)` and
`(household_id, idempotency_key)`. The R2 key is `<household_id>/<vault_id>`.

The `X-Expected-Version` check on upload was designed for one writer, where a
conflict meant the same person on two devices. With a household vault, both
partners editing on the same evening is routine, and a rejected push now means
the other person's work is on the server and yours is not. The server
mechanism is the same. What the losing client does is the client's concern and
is not specified here, but silently discarding is not acceptable.

### 1.3 Household, key, invite and bridge tables

#### `households`

`id` is a UUID the client generates. `name` is a UI label that defaults to
"Household". There is no `owner_id`: ownership is
`household_members.role = 'owner'`. There is no foreign key to `users`,
because a household outlives any one member (§3.11).

#### `household_members`

The unique index on `user_id` is what enforces one household per user.
Supporting more than one would drop it.

#### `user_keys`

One row per `(user_id, kek_kind)`, with `kek_kind` either `'pwd'` or
`'recovery'`. `wrapped_priv_key` is envelope A with KIND=0x03, opaque to the
server. The public key is on `users`, one per user. The private key has two
rows because there are two ways to unwrap it.

#### `household_member_keys`

One row per `(household_id, user_id, kek_kind)`, with `kek_kind` one of
`'pwd'`, `'recovery'` or `'ecies'`. `wrapped_master_key` is envelope A with
KIND=0x02 for `pwd` and `recovery`, and envelope C with KIND=0x06 for `ecies`.

The `ecies` row is transient. The inviter's handoff writes it and the
invitee's rewrap deletes it (§4.7, §4.8). It is the only kind the server
deletes in a normal flow. `pwd` and `recovery` rows are overwritten in place
and go only when the account or household is deleted.

`sender_user_id` and `sender_pubkey` are set only on an `ecies` row.
`sender_pubkey` repeats the `SENDER_PUB` field inside envelope C so that the
invitee's client can compute the safety-number fingerprint without parsing the
envelope first.

Both key tables carry `kek_salt`, `kek_kdf_kind` and `kek_kdf_params`, so each
wrapped row says how its key was derived (`crypto-design.md` §3.2). The rules
for those columns are in §8.2. They are enforced in application code because a
SQLite `CHECK` cannot express a rule that spans columns.

#### `invites`

`token` is 32 random bytes, base64url, and is sent in the invite email.
`recipient_email` is lowercased and trimmed. `recipient_user_id` is NULL until
the invitee claims the invite. `expires_at` is 1 to 7 days after issue, 3 by
default. `status` is one of:

- `open`: issued, with no action from the recipient yet.
- `accepted_pending_handoff`: the invitee has an account with a public key and
  has claimed the invite. They have no membership yet because they have no
  MasterKey. The inviter wraps it on their next login.
- `completed`: the inviter has added the invitee as a member (§4.7).
- `expired`: `expires_at` passed while the invite was still `open`. Set by the
  background sweep on `/auth/login`.
- `revoked`: the sender cancelled it with `DELETE /v1/invites/:id`.
- `declined`: meant for a recipient who signed up and chose their own
  household. Nothing sets it. It is in the `CHECK` anyway because SQLite
  cannot extend a `CHECK` in place, so adding a value later means rebuilding
  the table.

An invite that reaches `accepted_pending_handoff` and then passes `expires_at`
is not expired by the sweep (`crypto-design.md` §7.3). No membership row
exists yet, so nothing leaks. The inviter re-sends or revokes.

#### `auth_pending`

`id` is the bridge token itself: 32 random bytes, base64url, used as a bearer
credential. `expires_at` is 5 minutes after issue. `used_at` is set when the
token is spent, and a token can be spent once.

The bridge token is a table row and not a JWT with a purpose claim because the
session middleware is built around the full session JWT. Reusing it would mean
either a `purpose` field that every handler has to remember to check, or a
second copy of the verify logic. Rows that expired more than an hour ago are
deleted by the background cleanup on `/auth/login`.

### 1.4 Indexes

- `idx_household_members_user`, unique: one household per user.
- `idx_household_members_user_hh`, unique: lookup by user and household.
- `idx_household_members_household`: a household's members.
- `idx_member_keys_user`: all key rows for a user, for the key bundle.
- `idx_invites_recipient_email`: invites waiting for an address at signup.
- `idx_invites_recipient_user`: invites a user has received.
- `idx_invites_sender_user`: invites a user has sent, and the pending-handoff
  sweep.
- `idx_invites_expires_at` and `idx_invites_status`: the expiry sweep and
  filters by state.
- `idx_vaults_household`, with the unique `idx_vaults_household_version` and
  `idx_vaults_household_idempotency`: vault lookup, version ordering and
  idempotency.
- `auth_pending`, `auth_codes`, `sessions` and `rate_limits` each have the
  indexes their lookups and cleanups need.

`sync_state` needs no index because `household_id` is its primary key.

### 1.5 Foreign keys and cascades

- References to `users(id)` and `households(id)` are `ON DELETE CASCADE`, with
  the two exceptions below.
- `invites.recipient_user_id` is `ON DELETE SET NULL`. If an invitee deletes
  their account before the handoff completes, the sender can still see the
  invite and revoke it.
- `household_member_keys.sender_user_id` has no `ON DELETE` action, which in
  SQLite refuses the delete. It is only set on a transient `ecies` row, so it
  is in the way only if the inviter deletes their account between adding the
  invitee (§4.7) and the invitee's rewrap (§4.8).
- `sync_state.current_vault_id` references `vaults(id)` with no action, so
  `sync_state` is deleted before `vaults` when a household is torn down.
- `households` does not reference `users`, so deleting a user never removes a
  household. §3.11 covers what the handler does about that.

---

## 2. Session lifecycle

### 2.1 Cookie and token

- The session is a JWT (HS256) in the cookie `__budget_session`: httpOnly,
  secure, SameSite=Strict, path `/`.
- A JWT is valid for 7 days. The session row and the cookie live for 7 days,
  or 30 with `rememberMe`.
- When a request arrives with a token that has less than half its life left
  (3.5 days), the middleware rotates the session. It inserts a new session row
  with the same expiry, deletes the old one, and sets a new cookie holding a
  fresh 7-day JWT. This is how a 30-day session outlasts any one token.
- Every request checks the `sessions` row, so deleting the row revokes the
  session (§3.10).
- A token that fails verification under `JWT_SECRET` is tried against
  `JWT_SECRET_PREVIOUS` if that is set, which allows the secret to be rotated.

### 2.2 JWT payload and household scoping

The payload is `{ sub, sid, email, hid?, rec?, iat, exp }`. `email` is always
present. A local-only user has no server account and never gets a JWT, so none
of this API is reachable until they opt into cloud sync.

`hid` is the household the user belonged to when the token was signed. It is
there for the client. The server does not read it. The auth middleware
resolves the household from `household_members` on every request, in the same
query that checks the session, and puts it on the request context.

It works this way because an invitee gains a household mid-session. They sign
up with none and get one when the inviter completes the handoff. Scoping from
the claim would lock them out of their own vault until they logged in again.
It is also the stronger position: the claim is signed by a key that is inside
the server-compromise blast radius (`crypto-design.md` §1, property 6), and a
forged `hid` buys nothing when scope comes from a row.

A user between `signup-with-invite` and the handoff has no household and no
`hid`. Routes that need a household return 409 `NO_HOUSEHOLD`: every vault
route, `POST /v1/invites`, `/auth/rewrap-keys` and `/auth/recovery-reset`.
`/auth/me` and `/auth/key-bundle` return `household: null`.

`rec: true` marks a recovery session (§3.9). Both `hid` and `rec` are carried
across rotation.

### 2.3 The session and the keys have independent lifetimes

The server knows nothing about whether the client holds a MasterKey. Endpoints
that involve a key hand over wrapped material, and unwrapping always happens
on the client. The MasterKey lives in JS memory until the tab closes or the
user locks the app.

- **App opens, cookie valid, no MasterKey in memory**: the client asks for the
  password and unwraps the cached wrapped-key rows locally. No code is emailed
  and the server is not needed.
- **App opens, cookie expired**: the full login runs (§3.1 to §3.3). The
  server returns the key bundle after the verifier check and the client
  unwraps it with the password.
- **Logout**: `POST /auth/logout` deletes the session row and clears the
  cookie. The server does nothing about the MasterKey. Whether the client also
  wipes it is the client's choice.
- **Tab closes**: the cookie persists. The MasterKey is gone.
- **Local lock**: the MasterKey is wiped. The session is untouched and is used
  again after the next unlock.
- **Session revoked on the server**, for example for a lost device: that
  device's cookie stops working. Its MasterKey stays in memory until its next
  request returns 401.

### 2.4 Cross-site requests

The cookie is SameSite=Strict. CORS allows credentials only from `APP_URL`,
plus `http://localhost:5173` when `ENVIRONMENT` is `development`. Every JSON
endpoint rejects a request whose `Content-Type` is not `application/json`. The
vault upload requires `application/octet-stream` and an `X-Expected-Version`
header.

---

## 3. Auth endpoints

All paths are under `/v1`. Request bodies are JSON and must be sent as
`application/json`. A body may be up to 1 KB on the code endpoints and 16 KB
on the endpoints that carry keys, and a larger one is 400 `BAD_REQUEST`.
Errors use the envelope in §9. Rate limits are listed once, in §10, and a
limited request gets 429 `TOO_MANY_REQUESTS`.

### 3.1 `POST /v1/auth/login`: request a code

**Request:** `{ "email": string }`

**Response (200):** `{ "message": "Code sent" }`, whether or not the address
was known.

**Errors:** 400 `BAD_REQUEST` (malformed email), 500 `INTERNAL_ERROR` (the
email could not be sent).

If no `users` row exists for the address, this creates one. It has to: signup
needs a bridge token, a bridge token needs a verified code, and a code needs a
`users` row to belong to, so the account must exist before its owner can prove
anything about it. The row is harmless until signup fills it in (§1.2).

The code is 6 digits and lasts 10 minutes. A user with 15 or more failed
attempts across unused codes in the past day gets the same 200 and no email.
In practice the window is about an hour: every successful `/login` deletes
codes more than an hour old (`cleanupExpiredCodes`), and the count goes with
them.

In the background, this endpoint also deletes old codes, expired sessions and
expired bridge tokens, and marks lapsed `open` invites `expired`.

### 3.2 `POST /v1/auth/verify-otp`: verify the code

The code step and the password step are separate so that the verifier salt is
only returned after the code has been checked. Returning it for an email alone
would confirm which addresses have accounts.

**Request:** `{ "email": string, "code": string }`

**Response (200):**
```json
{
  "authPendingToken":  "<32-byte base64url>",   // single-use, 5 minutes
  "verifierSalt":      "<16-byte base64url>",
  "verifierKdfKind":   2,                       // 0x02 = Argon2id
  "verifierKdfParams": "<9-byte base64url>"
}
```

**Errors:** 400 `BAD_REQUEST`, 401 `UNAUTHORIZED` with the message
`Invalid email or code` for an unknown address or a wrong code.

A user who has requested a code but never signed up gets the bridge token as
normal, with the three verifier fields `null`. That is how the client knows to
go to signup and not to the password step. It is an ordinary first-run state
and has no error code.

The code is consumed here, not at `/login-complete`, so the bridge step cannot
be replayed. A correct code is marked used and the user's other active codes
are invalidated with it. A wrong code counts against every active code, and
after 5 wrong attempts the endpoint returns 429. The message says to request
a new code, but a new code does not clear the count on the old one, so the
429 lasts until the old code expires, up to 10 minutes. This 429 has no
`Retry-After` header.

### 3.3 `POST /v1/auth/login-complete`: check the password, issue the session

**Request:**
```json
{
  "authPendingToken":  "<base64url>",
  "verifierCandidate": "<32-byte base64url>",   // Argon2id(password, verifier_salt), computed by the client
  "rememberMe":        false,
  "via":               "recovery"               // optional, see §3.9
}
```

**Response (200):**
```json
{
  "user":      { "id": "...", "email": "..." },
  "household": { "id": "...", "name": "..." },   // or null
  "keyBundle": { /* same shape as GET /v1/auth/key-bundle, §3.7 */ }
}
```

The response sets the session cookie.

**Errors:**
- 401 `AUTH_PENDING_INVALID`: the bridge token is unknown, expired or already
  used.
- 401 `VERIFIER_MISMATCH`: the candidate does not match, or the account has no
  verifier because it never signed up. The comparison is constant-time.
- 400 `INVALID_BLOB`: the candidate is not valid base64url.

The handler spends the bridge token first, in a standalone guarded
`UPDATE ... RETURNING user_id` (§6.1). The verifier check runs in Worker code
after that, so the two cannot share a batch. A wrong password therefore burns
the token and the user redoes the code step. That is intended
(`crypto-design.md` §3.3). The per-user rate limit is also checked after the
token is spent.

A user can hold 10 live sessions. Logging in with 10 already active deletes
the oldest.

### 3.4 `POST /v1/auth/signup`: create an account and its household

This serves a new cloud-sync user and a local-only user opting into cloud
sync. In both cases the client has already generated the keypair and the
MasterKey, and this call uploads the wrapped material. The client must hold a
bridge token from `/verify-otp`.

**Request:**
```json
{
  "authPendingToken":  "<base64url>",
  "verifierCandidate": "<base64url>",        // stored as the password verifier
  "verifierSalt":      "<base64url>",        // 16 bytes, chosen by the client
  "verifierKdfKind":   2,
  "verifierKdfParams": "<base64url>",        // 9 bytes
  "pubkey":            "<32-byte base64url>",
  "userKeys": [
    { "kekKind": "pwd",      "wrappedPrivKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedPrivKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ],
  "household": { "id": "<client-generated UUID>", "name": "<string>" },
  "memberKeys": [
    { "kekKind": "pwd",      "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedMasterKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ],
  "rememberMe": false
}
```

`household.id` may be up to 64 characters. `household.name` may be up to 100
and becomes "Household" if empty.

**Response (200):** the same shape as `/login-complete`, plus `pendingInvites`
(§3.6). The response sets the session cookie.

**Errors:**
- 400 `INVALID_BLOB`: a key field fails §8, or `userKeys` or `memberKeys` is
  not one `pwd` row and one `recovery` row.
- 400 `BAD_REQUEST`: the `household` block is missing or out of range.
- 401 `AUTH_PENDING_INVALID`.
- 409 `ALREADY_SIGNED_UP`: the account already has a public key.

The handler works in this order:

1. Validate all key material before anything is spent. Malformed blobs then
   cost the user a retry, not a fresh code.
2. Spend the bridge token in a standalone guarded
   `UPDATE ... RETURNING user_id`. One statement is atomic on its own, and it
   gates everything after it. It cannot go inside the batch, for the reason in
   §6.1. The cost is that a failure past this point burns the token, the same
   trade `/login-complete` makes.
3. Read `users.pubkey` and return 409 if it is set.
4. Run the rest as one batch, then sign the JWT in Worker code.

```
UPDATE auth_pending SET used_at=now
       WHERE id=? AND used_at IS NULL AND expires_at > now RETURNING user_id   -- standalone
SELECT pubkey FROM users WHERE id=?                                            -- 409 if set
-- then, in one batch:
UPDATE users SET password_verifier=?, verifier_salt=?, verifier_kdf_kind=?, verifier_kdf_params=?,
                 pubkey=?, updated_at=now
       WHERE id=? AND pubkey IS NULL
INSERT INTO user_keys (...) ON CONFLICT DO UPDATE               x 2 (pwd, recovery)
INSERT INTO households (...)                                    -- PK id
INSERT INTO household_members (..., role='owner')               -- UNIQUE(user_id)
INSERT INTO household_member_keys (...) ON CONFLICT DO UPDATE   x 2 (pwd, recovery)
INSERT INTO sessions (id, user_id, expires_at)
```

Inside the batch, a second signup that got past step 3 is stopped by a
constraint, not by a `WHERE` guard. The key rows are upserts and do not reject
a replay. The `households` primary key and the unique
`household_members.user_id` do: either raises a constraint error, the whole
batch rolls back, and the handler returns 409 `ALREADY_SIGNED_UP`. The
`WHERE pubkey IS NULL` on the `users` update protects that one row and nothing
else.

### 3.5 `POST /v1/auth/signup-with-invite`: create an account that joins a household

The same as `/auth/signup`, except that `inviteToken` is required and there is
no `household` or `memberKeys` block. The household already exists, and the
invitee has no MasterKey yet. It arrives later through the handoff (§4.7).

**Request:**
```json
{
  "authPendingToken":  "...",
  "verifierCandidate": "...",
  "verifierSalt":      "...",
  "verifierKdfKind":   2,
  "verifierKdfParams": "...",
  "pubkey":            "...",
  "userKeys":          [ { "kekKind": "pwd", ... }, { "kekKind": "recovery", ... } ],
  "inviteToken":       "<base64url>",
  "rememberMe":        false
}
```

**Response (200):**
```json
{
  "user":      { "id": "...", "email": "..." },
  "household": null,                           // not joined yet
  "invite": {
    "id": "...",
    "status": "accepted_pending_handoff",
    "senderEmail": "...",                      // for the invitee's waiting screen
    "senderPubkey": "<base64url>"              // for the safety-number fingerprint
  },
  "keyBundle": { /* §3.7, with household null and memberKeys empty */ }
}
```

**Errors:** those of `/auth/signup`, and from the invite checks: 404
`INVALID_INVITE` (unknown token), 403 `EMAIL_MISMATCH` (the invite was sent to
a different address), 410 `INVITE_EXPIRED`, 409 `INVITE_ALREADY_ACCEPTED` (any
status other than `open`).

The handler works in this order:

```
-- validate the key material
UPDATE auth_pending SET used_at=now WHERE ... RETURNING user_id   -- standalone
SELECT pubkey FROM users WHERE id=?                               -- 409 if set
-- read the invite and check it; the checks need the account's email, so they follow the token
-- then, in one batch:
UPDATE users SET password_verifier=?, ..., pubkey=?, updated_at=now WHERE id=? AND pubkey IS NULL
INSERT INTO user_keys (...) ON CONFLICT DO UPDATE   x 2
INSERT INTO sessions (...)
-- then, standalone and guarded:
UPDATE invites SET recipient_user_id=?, status='accepted_pending_handoff', updated_at=now
       WHERE token=? AND status='open' AND expires_at > now AND recipient_email=?
```

The invite claim is a guarded `UPDATE`, so it cannot go inside the account
batch: a guard that matched nothing would leave the rest applied (§6.1).

The account is created before the invite is claimed. In the other order, a
failure in the account batch would strand a claimed invite against an account
with no keys, and nothing could repair that, because the invite is no longer
`open` and the recipient cannot sign up twice. In this order a failed claim
leaves a usable account that can accept the same invite through
`POST /v1/invites/:token/accept` (§4.3).

If the claim matches no rows, the server reads the invite again and returns
the error for whichever condition failed. That read is safe because the caller
has already proved control of the address.

Expiry is reported before status, both in the first check and in that re-read.
The sweep on `/auth/login` rewrites a lapsed `open` invite to `expired`, so a
status check that ran first would report a timed-out invite as already used,
which is the wrong thing to tell the recipient and the wrong code for the
client to branch on. The order is: unknown token, email mismatch,
`status = 'expired'` or `expires_at <= now`, then `status != 'open'`.

Nothing in this batch raises a constraint error on a replay, because the key
rows are upserts and the session id is new. The `pubkey` read before it is the
only guard against a second signup. Two requests holding two valid bridge
tokens for the same account could both pass it, and the second would overwrite
the first's `user_keys` rows while the first's `pubkey` stayed.

### 3.6 Invites found at signup

After `/auth/signup` has created the account, it looks for open, unexpired
invites addressed to the new user's email and returns them:

```json
"pendingInvites": [ { "id": "...", "status": "open", "expiresAt": "..." } ]
```

This is the second acceptance path in `crypto-design.md` §7.4: someone who
signs up from the landing page and not from their invite link.

That path is a dead end today. The same call has just given the user a
household of their own. One household per user then means
`POST /v1/invites/:token/accept` returns 409 `HOUSEHOLD_FULL`, and because
leaving a household is not supported, they can never accept the invite. The
client does not read `pendingInvites`. The fix that was designed is not built
(§12).

### 3.7 `GET /v1/auth/key-bundle`: the wrapped keys for a local unlock

Authenticated. A recovery session can call it (§3.9).

**Response (200):**
```json
{
  "user": {
    "id": "...",
    "pubkey": "<base64url>",
    "verifierSalt": "<base64url>",
    "verifierKdfKind": 2,
    "verifierKdfParams": "<base64url>"
  },
  "userKeys": [
    { "kekKind": "pwd",      "wrappedPrivKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedPrivKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ],
  "household": { "id": "...", "name": "..." },     // null before the handoff
  "memberKeys": [                                  // 0 to 3 rows
    { "kekKind": "pwd", "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "...",
      "senderUserId": null, "senderPubkey": null }
  ]
}
```

`memberKeys` holds the `pwd` and `recovery` pair once the user has them, or a
single `ecies` row while a handoff is waiting to be rewrapped. `senderUserId`
and `senderPubkey` are null except on the `ecies` row. The `user` fields are
null for an account that has not signed up.

**Errors:** 401 `UNAUTHORIZED`.

The client should cache this.

### 3.8 `POST /v1/auth/rewrap-keys`: Argon2id rolling upgrade

The server's half of the upgrade in `crypto-design.md` §3.4. No client code
calls it yet. The intended caller unlocks with the stored parameters, derives
KEK_pwd again at the current target parameters, and posts the new
password-wrapped rows. It also posts a new verifier, so the verifier's
parameters move with the key's.

**Request:**
```json
{
  "verifierCandidate": "<base64url>",        // derived at the new params; stored as the verifier
  "verifierSalt":      "<base64url>",
  "verifierKdfKind":   2,
  "verifierKdfParams": "<base64url>",
  "newKekSalt":        "<base64url>",
  "newKekKdfKind":     2,
  "newKekKdfParams":   "<base64url>",
  "newUserKeysPwd":    { "wrappedPrivKey": "..." },
  "newMemberKeysPwd":  { "wrappedMasterKey": "..." }
}
```

Only the `pwd` rows are rewrapped. The recovery rows derive from the BIP-39
phrase, whose parameters do not change. Both `pwd` rows are required, because
half an upgrade would leave two rows that one password derivation cannot both
open.

**Response (200):** `{ "ok": true }`

**Errors:** 400 `INVALID_BLOB`, 400 `BAD_REQUEST` (a nested block is missing),
401 `UNAUTHORIZED`, 403 `RECOVERY_SESSION`, 409 `NO_HOUSEHOLD`.

The writes are one batch:
```
INSERT INTO user_keys (..., kek_kind='pwd') ON CONFLICT DO UPDATE
INSERT INTO household_member_keys (..., kek_kind='pwd') ON CONFLICT DO UPDATE
UPDATE users SET password_verifier=?, verifier_salt=?, verifier_kdf_kind=?, verifier_kdf_params=?, updated_at=now
       WHERE id=?
```

`crypto-design.md` §3.4 forbids delete-before-insert. These are in-place
upserts in one batch, so the old wrap is valid until the new one is durable.
The client must keep the old derivation in memory until the server returns
200, and only then switch to the new salt and parameters.

### 3.9 `POST /v1/auth/recovery-reset`: set a new password after recovery

Implements `crypto-design.md` §6.4 steps 4 and 5. After the client unwraps
with the recovery phrase and the user picks a new password, the client posts
new password-kind rows. The recovery-kind rows are not touched.

**Request:**
```json
{
  "newVerifier":     { "verifierCandidate": "...", "verifierSalt": "...", "verifierKdfKind": 2, "verifierKdfParams": "..." },
  "newUserKeyPwd":   { "wrappedPrivKey": "...",   "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
  "newMemberKeyPwd": { "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." }
}
```

The server treats both key rows as `pwd` whatever `kekKind` the client sends,
so a mislabelled row cannot overwrite a recovery row.

**Response (200):** `{ "ok": true }`

**Errors:** 401 `UNAUTHORIZED`, 403 `RECOVERY_SESSION_REQUIRED` (the session
is an ordinary one), 401 `RECOVERY_SESSION_EXPIRED`, 409 `NO_HOUSEHOLD`, 400
`INVALID_BLOB`, 400 `BAD_REQUEST`.

Someone in this flow has forgotten their password, so they cannot produce a
verifier candidate, and the check in §3.3 cannot be what lets them in. A
recovery session is obtained and limited like this:

- `POST /v1/auth/login-complete` accepts `"via": "recovery"`. It skips the
  verifier check and issues a session whose JWT carries `rec: true`.
- A `rec` session can call `GET /v1/auth/key-bundle` and
  `POST /v1/auth/recovery-reset`. It can also call `GET /v1/auth/me` and
  `POST /v1/auth/logout`, which expose nothing beyond the caller's own email
  and household name. Every other authenticated route returns 403
  `RECOVERY_SESSION`: the vault, invite, handoff and household routes,
  `/auth/rewrap-keys`, account deletion and session management.
- `recovery-reset` also requires the JWT to be no more than 5 minutes old
  (`now - iat <= 300`). Session rotation signs a JWT with a new `iat`, so a
  recovery session old enough to be rotated gets another 5 minutes after any
  authenticated call. Read in the code, not exercised.
- The claim survives rotation. Dropping it on renewal would promote a recovery
  session to a full one.
- The session is still a recovery session after the reset. The user logs in
  again with the new password to get a full one.

The session is confined because skipping the verifier means control of the
mailbox alone issues a session, which is what the verifier exists to prevent.
Confined, it gives an attacker nothing to read. The key bundle is ciphertext
wrapped under keys derived from a password and a recovery phrase they do not
have, and a `recovery-reset` overwrites only the `pwd` rows, leaving the
`recovery` rows that still open the vault (`crypto-design.md` §6.4 step 5).
`crypto-design.md` §1, property 3, describes the same limit from the other
side: someone holding only the recovery phrase "cannot establish a fresh
server session on their own".

A risk remains. An attacker with mailbox control but no recovery phrase can
still call `recovery-reset`. That overwrites the `pwd` wraps, which locks the
legitimate user out of password unlock. Because the same call stores a
verifier of the attacker's choosing, they can then log in through the ordinary
path and hold a full session, and with that they can overwrite or delete the
cloud copy and delete the account. It is not a disclosure: every wrap they can
fetch needs the password or the phrase, and they have neither. Unless the
account has been deleted, the user still recovers with their phrase. The
server cannot verify that the phrase was used. It only sees the flag.

Accepted by the maintainer, 2026-10-13, with no stronger recovery proof
planned. This is the email password reset most apps offer, and better in that
nothing can be read.

The writes are one batch:
```
UPDATE users SET password_verifier=?, verifier_salt=?, verifier_kdf_kind=?, verifier_kdf_params=?, updated_at=now
       WHERE id=?
INSERT INTO user_keys (..., kek_kind='pwd') ON CONFLICT DO UPDATE
INSERT INTO household_member_keys (..., kek_kind='pwd') ON CONFLICT DO UPDATE
```

The old rows are overwritten in place, never deleted and re-inserted, so a
dropped connection leaves the previous password rows intact.

The session checks run before the per-user rate limit. At one attempt an hour,
a mistaken call on an ordinary session would otherwise use up the reset the
user needs.

### 3.10 Session endpoints

All are authenticated. All except `/me` and `/logout` refuse a recovery
session.

- `POST /v1/auth/logout`: deletes the session row and clears the cookie.
  Returns `{ "message": "Logged out" }`.
- `GET /v1/auth/me`: returns
  `{ "user": { "id", "email" }, "household": { "id", "name" } }`, with
  `household` null if there is none.
- `GET /v1/auth/sessions`: returns
  `{ "sessions": [ { "id", "createdAt", "isCurrent" } ] }` for the user's live
  sessions.
- `DELETE /v1/auth/sessions/:id`: revokes another session. 400 `BAD_REQUEST`
  for the current one, 404 `NOT_FOUND` if it is not the caller's.
- `POST /v1/auth/revoke-all-sessions`: deletes every session except the
  current one. Returns `{ "revoked": <count> }`.
- `DELETE /v1/auth/account`: see §3.11.

### 3.11 `DELETE /v1/auth/account`

**Response (200):** `{ "message": "Account deleted" }`, and the cookie is
cleared.

Deleting a `users` row cascades `auth_codes`, `auth_pending`, `sessions`,
`user_keys`, `household_members`, the user's `household_member_keys` rows and
the invites they sent. It does not remove the household. `households` has no
foreign key to `users` and cannot have one, because a household outlives any
one member. Left to the cascade, the `households` row, its `vaults`, its
`sync_state` and its R2 objects would be orphaned.

The handler therefore tears the household down explicitly, and only when the
user is its last member:

- **Sole member**: delete `sync_state` and `vaults` in one batch, delete the
  R2 objects, delete the `households` row, then delete the user.
- **A partner remains**: delete only the user. Their membership and wrapped
  keys cascade. The household, the vault and the partner's key rows are
  untouched. This is the one way out of a household, since leaving is
  otherwise not supported. It works because the remaining member's `pwd` and
  `recovery` wraps of the MasterKey do not depend on the departing member's.

---

## 4. Invite and handoff endpoints

All require a full session, so a recovery session gets 403 `RECOVERY_SESSION`.
The role names from `crypto-design.md` §7.2 are in parentheses.

### 4.1 `POST /v1/invites` (invite-issue)

**Request:** `{ "recipientEmail": "...", "expiresInDays": 3 }`

**Response (201):**
```json
{ "invite": { "id": "...", "recipientEmail": "...", "status": "open", "expiresAt": "...", "createdAt": "..." } }
```

The token is not returned. It goes to the recipient by email, as the link
`<APP_URL>/accept-invite?token=<token>`.

The checks, in order:

- The caller must be in a household (409 `NO_HOUSEHOLD`). This runs before the
  per-user rate limit, so someone with no household to invite from does not
  spend their hourly budget finding that out.
- `recipientEmail` must not be the caller's own (400 `BAD_REQUEST`).
- `expiresInDays` must be an integer from 1 to 7, 3 if omitted (400
  `BAD_REQUEST`).
- The household must have fewer than 2 members (409 `HOUSEHOLD_FULL`).
- The caller must not already have an open, unexpired invite to the same
  address (409 `INVITE_ALREADY_PENDING`, with `data.inviteId` naming it).

**Errors:** those above, and 500 `INTERNAL_ERROR` if the email cannot be sent.

If sending fails, the invite row is deleted. An invite nobody received would
otherwise hold the one-open-invite-per-pair slot while being unusable.

### 4.2 `GET /v1/invites`

Returns the invites the caller sent and the ones they have claimed. Tokens are
never included.

**Response (200):**
```json
{
  "sent":     [ { "id", "recipientEmail", "status", "expiresAt", "createdAt" } ],
  "received": [ { "id", "senderEmail",    "status", "expiresAt", "createdAt" } ]
}
```

### 4.3 `POST /v1/invites/:token/accept` (invite-accept, existing account)

For an invitee who already has an account. The server attaches the invite to
the account. It does not create a membership, because the invitee has no
MasterKey for that household yet.

**Request:** none. The token is in the path.

**Response (200):**
```json
{ "household": null, "invite": { "id": "...", "status": "accepted_pending_handoff", "senderEmail": "...", "senderPubkey": "..." } }
```

**Errors:** checked in this order.
- 409 `HOUSEHOLD_FULL`: the caller is already in a household, and a user can
  be in only one.
- 404 `INVALID_INVITE`: unknown token.
- 403 `EMAIL_MISMATCH`: the invite's `recipient_email` is not the caller's
  email, compared case-insensitively. This stops someone accepting an invite
  addressed to another person.
- 410 `INVITE_EXPIRED`, then 409 `INVITE_ALREADY_ACCEPTED`. Expiry comes first
  for the reason in §3.5.

The claim is the same standalone guarded `UPDATE invites` as in §3.5. If it
matches no rows, the server reads the invite again and returns whichever of
the errors above applies.

### 4.4 `DELETE /v1/invites/:id`: revoke (sender only)

**Response (200):** `{ "ok": true }`

Sets `status = 'revoked'` and clears `recipient_user_id`. The invite then
drops out of the invitee's `GET /invites`, which filters on that column, so
no endpoint reports `revoked` to them: the invite is simply gone.

**Errors:** 404 `NOT_FOUND`, 403 `FORBIDDEN` (not the caller's invite), 409
`INVITE_COMPLETED`. Revoking a completed invite cannot remove a household
member, and no endpoint does.

### 4.5 `GET /v1/handoffs/pending` (sweep-pending-handoffs)

The inviter's client calls this on every login. It returns the caller's sent
invites that are in `accepted_pending_handoff`.

**Response (200):**
```json
{
  "handoffs": [
    {
      "inviteId": "...",
      "inviteeUserId": "...",
      "inviteePubkey": "<base64url>",
      "inviteePubkeyFingerprint": "...",     // 16 hex characters
      "recipientEmail": "...",
      "householdId": "..."                   // the inviter's household
    }
  ]
}
```

The fingerprint is the first 8 bytes of SHA-256 of the 32-byte public key, in
hex. The client sets the display format. The server sends the fingerprint so
the client can show it straight away, but the client should compute it again
from the key before showing the safety number, in case a server sends a real
key with a mismatched fingerprint.

The length is fixed by the client: `PUBLIC_KEY_FINGERPRINT_LENGTH` in
`src/lib/key-management.ts` is 8, and `PUBKEY_FINGERPRINT_BYTES` in
`worker/src/lib/crypto.ts` matches it. The two must change together or not at
all. If they differ, the client's recomputation fails on every handoff, which
looks the same as a server substituting a public key (`crypto-design.md` §7.2).

**Errors:** 401 `UNAUTHORIZED`.

### 4.6 `GET /v1/handoffs/incoming` (sweep-poll)

The invitee's client polls this while it waits for the inviter. It is a short
poll: it returns the current state at once, and the client picks the cadence.

**Response (200):**
```json
{
  "handoffs": [
    {
      "householdId": "...",
      "senderUserId": "...",
      "senderEmail": "...",
      "senderPubkey": "<base64url>",
      "senderPubkeyFingerprint": "...",
      "wrappedMasterKey": "<base64url>",          // envelope C, KIND=0x06
      "kekKind": "ecies",
      "createdAt": "..."
    }
  ]
}
```

There are 0 or 1 entries, because a user has at most one household. It is an
array so that more than one household would not change the shape.

**Errors:** 401 `UNAUTHORIZED`.

### 4.7 `POST /v1/households/:householdId/members` (household-add-member)

The inviter's client calls this after the two people have compared the safety
number out of band. It needs the MasterKey in memory.

**Request:**
```json
{
  "inviteId":         "...",
  "inviteeUserId":    "...",
  "wrappedMasterKey": "<base64url>",        // envelope C
  "senderPubkey":     "<base64url>"         // the inviter's public key, as embedded in envelope C
}
```

**Response (200):**
`{ "ok": true, "member": { "userId": "...", "role": "member", "joinedAt": "..." } }`

The checks, in order:

- `:householdId` must be the caller's household (403 `FORBIDDEN`).
- `wrappedMasterKey` must be a valid envelope C (§8.1), or 400 `INVALID_BLOB`.
- `senderPubkey` must equal the caller's stored `users.pubkey` (400
  `INVALID_BLOB`). The inviter's own UI is the main check that they wrapped
  with the right key. This is a second one on the server.
- The invite must exist (404 `INVITE_NOT_FOUND`). The caller must be its
  sender, and it must be for this household (403 `FORBIDDEN`).
- `inviteeUserId` must equal the invite's `recipient_user_id` (409
  `INVITE_INVALID_STATE`).
- If the invitee is already a member of this household, the request is a
  replay. While the `ecies` row still exists it returns 200 with the existing
  membership. If the `ecies` row is gone, the invitee has already rewrapped,
  and it returns 409 `HOUSEHOLD_ROW_RACE`. The handoff row is never written a
  second time.
- The invite must be `accepted_pending_handoff` (409 `INVITE_INVALID_STATE`).
  `open` would also pass this check but cannot reach it, because an open
  invite has no `recipient_user_id`.
- The household must have fewer than 2 members (409 `HOUSEHOLD_FULL`).

The replay check runs before the state check because a retried request finds
the invite already `completed` by its own first attempt. Checking state first
would report a successful retry as an error.

The writes are one batch (`crypto-design.md` §7.2, household-add-member):
```
INSERT INTO household_members (id, household_id, user_id, role='member', joined_at=now)
INSERT INTO household_member_keys (household_id, user_id, kek_kind='ecies', wrapped_master_key,
                                   kek_salt=NULL, kek_kdf_kind=NULL, kek_kdf_params=NULL,
                                   sender_user_id, sender_pubkey)
UPDATE invites SET status='completed', updated_at=now WHERE id=? AND sender_user_id=?
```

The membership and the key land together. A membership without a key would
give the invitee vault bytes they cannot read, and a key without a membership
would leave them unable to fetch the vault. If the invitee joined another
household between the checks and the batch, the unique
`household_members.user_id` fails the batch and the handler returns 409
`HOUSEHOLD_FULL`.

### 4.8 `POST /v1/households/:householdId/members/:userId/rewrap` (rewrap-member-keys)

The invitee's client calls this after it has fetched the handoff from
`/handoffs/incoming`, unwrapped it, and wrapped the MasterKey again under its
own KEK_pwd and KEK_rec.

**Request:**
```json
{
  "memberKeys": [
    { "kekKind": "pwd",      "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedMasterKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ]
}
```

**Response (200):** `{ "ok": true }`

**Errors:** checked in this order.
- 403 `NOT_OWN_KEYS`: `:userId` is not the caller.
- 404 `NOT_FOUND`: no such household.
- 400 `INVALID_BLOB`: a row fails §8, or the pair is not one `pwd` and one
  `recovery`.
- 409 `NO_PENDING_HANDOFF`: there is no `ecies` row for this household and
  user.
- 409 `NO_PASSWORD_KEY`: the caller has no `pwd` row in `user_keys`.
- 400 `INVALID_BLOB`: the new `pwd` row's salt, KDF kind or params differ from
  the caller's `user_keys` `pwd` row. The client opens both rows with one
  Argon2id derivation, so a row that disagreed would be stored and then no
  password could sign that account in.

The writes are one batch (`crypto-design.md` §7.2, rewrap-member-keys):
```
INSERT INTO household_member_keys (..., kek_kind='pwd') ON CONFLICT DO UPDATE
INSERT INTO household_member_keys (..., kek_kind='recovery') ON CONFLICT DO UPDATE
DELETE FROM household_member_keys WHERE household_id=? AND user_id=? AND kek_kind='ecies'
```

Upserts are safe here because only the invitee's client can produce these
wraps. If two of the invitee's devices race, the last write wins, and both
wrote the same MasterKey under the same KEK. The delete is a no-op for the
loser.

### 4.9 Re-issuing an invite

There is no endpoint to extend or re-send an invite. The sender revokes it
(§4.4) and issues a new one (§4.1).

---

## 5. Vault endpoints

Every route requires a full session and a household, and is scoped to the
caller's household as resolved in §2.2.

- `GET /v1/vault`: metadata. Returns `{ "version": 0 }` when nothing has been
  uploaded, otherwise `{ "version", "sizeBytes", "checksum", "updatedAt" }`.
- `GET /v1/vault/data`: the current blob as `application/octet-stream`, with
  `X-Vault-Version` and `X-Vault-Checksum` headers. 404 `NOT_FOUND` if there
  is none.
- `PUT /v1/vault/data`: upload. Returns `{ "version", "vaultId" }`.
- `GET /v1/vault/history`: returns
  `{ "versions": [ { "id", "version", "sizeBytes", "checksum", "createdAt" } ] }`,
  newest first, up to 100.
- `GET /v1/vault/data/:vaultId`: one stored version, if it belongs to the
  caller's household.

The upload rules:

- `Content-Type` must be `application/octet-stream`, and `X-Expected-Version`
  is required. Either missing is 400 `BAD_REQUEST`.
- The body may be up to 10 MB (400 `BAD_REQUEST` above that).
- The body must be a vault envelope (§8.1), or 400 `INVALID_BLOB`.
- The household's stored versions plus this upload must fit in 50 MB, or 413
  `QUOTA_EXCEEDED` with `data.currentBytes` and `data.maxBytes`.
- If `X-Expected-Version` is not the current version, the response is 409 with
  the body `{ "error": "Version conflict", "currentVersion": <n> }`. This one
  response has no `code` field.
- `X-Idempotency-Key` is optional. A repeat with the same key returns the
  first upload's result, unless the household is at its quota: that check
  runs first and returns 413. The client does not send the header.

After a successful upload, a background task prunes the household to its 10
newest versions.

The storage quota is per household, so a couple shares what one person used to
have alone. User-facing copy about the limit needs to say "household".

---

## 6. Atomicity

### 6.1 D1 batches

D1 has no interactive `BEGIN` and `COMMIT`. The only way to make several
statements atomic is `db.batch([...])`, which runs them in one implicit
transaction and returns a result for each statement.

A batch rolls back when a statement raises an error, such as a constraint
violation, and for no other reason. A guarded `UPDATE` that matches zero rows
is a success with `meta.changes === 0`, and the statements after it still
apply. Two rules follow, and the signup paths depend on both:

- A guard that must stop everything after it runs as a standalone statement
  before the batch. This is why the bridge token is spent in its own
  `UPDATE ... RETURNING` (§3.3 to §3.5) and why the invite claim is its own
  statement (§3.5). Inside the batch, the rest of a signup would have applied
  against a token that was already spent.
- Inside a batch, protection against a replay comes from primary keys and
  unique indexes, which raise errors. `WHERE` clauses do not give it.

The vault upload shows the other way to handle a zero-row update. Its
`UPDATE sync_state ... WHERE current_version = ?` is inside a batch with the
`INSERT INTO vaults`. The handler reads `meta.changes` afterwards and, if it
is 0, deletes the vault row and the R2 object it just wrote and returns the
conflict.

### 6.2 The batches

Each batch is specified with its endpoint: signup (§3.4), signup with invite
(§3.5), rewrap keys (§3.8), recovery reset (§3.9), add member (§4.7) and
rewrap member keys (§4.8). In both signups the bridge token is spent before
the batch, and in signup with invite the invite is claimed after it. Neither
statement is inside the batch.

Two more are not shown elsewhere:

- **Vault upload**: `INSERT vaults`, then `UPDATE sync_state`, or
  `INSERT sync_state` for a household's first upload.
- **Household teardown**: `DELETE sync_state`, then `DELETE vaults`.

### 6.3 R2 and D1

The vault upload and the household teardown are the only operations that touch
both stores.

An upload writes the object to R2 first and then runs the D1 batch. If the
batch fails or loses the version race, the handler deletes the R2 object. A
scheduled job, `cleanupOrphanedR2Objects`, runs daily and removes any object
that has no `vaults` row.

A teardown deletes the D1 rows first and then the R2 objects, and the same job
covers a failure in between.

### 6.4 Retries

A batch cannot be half applied. The remaining failure is a request that
succeeded on the server and whose response the client never saw. What a retry
gets:

- **`PUT /v1/vault/data`**: with the same `X-Idempotency-Key`, the first
  upload's `version` and `vaultId`.
- **`/auth/verify-otp`, `/auth/login-complete` and the signups**: the code and
  the bridge token are single-use, so the retry gets 401 and the user starts
  the login again. A signup that had in fact succeeded then lands on the
  password step, because the account now has a verifier.
- **`POST /v1/invites`**: 409 `INVITE_ALREADY_PENDING` with the existing
  invite's id.
- **Add member**: 200 with the existing membership, while the `ecies` row
  exists (§4.7).
- **Rewrap member keys**: 409 `NO_PENDING_HANDOFF`, because the first attempt
  removed the `ecies` row. The key bundle then shows the `pwd` and `recovery`
  rows.
- **`/auth/rewrap-keys` and `/auth/recovery-reset`**: the writes are upserts
  and would be harmless to repeat, but the limit of one an hour per user means
  a retry inside the hour gets 429.

---

## 7. Version enforcement

Every blob the server accepts must begin with `VERSION=0x02`. Any other first
byte is 400 `INVALID_BLOB`. There is no state to consult and no branch for an
older format. `crypto-design.md` §4.4 covers the client side and what would
have to change if a second version were ever needed.

---

## 8. Validation of wrapped blobs

The server never decrypts a wrapped blob. It checks the shape before storing
it, so that obviously wrong bytes are rejected at the door and do not end up
in the database. It cannot detect input that is well-formed and malicious. The
AAD binding catches that on the client at decrypt time (`crypto-design.md`
§4). The code is `worker/src/lib/key-material.ts`.

### 8.1 Envelope checks

- **Vault** (envelope A, KIND=0x01): byte 0 is `0x02`, byte 1 is `0x01`, at
  least 30 bytes (1 + 1 + 12 + 16). The upper bound is the 10 MB upload limit.
- **Wrapped MasterKey** (envelope A, KIND=0x02): byte 0 is `0x02`, byte 1 is
  `0x02`, 30 to 1024 bytes.
- **Wrapped private key** (envelope A, KIND=0x03): byte 0 is `0x02`, byte 1 is
  `0x03`, 30 to 1024 bytes.
- **Handoff** (envelope C, KIND=0x06): byte 0 is `0x02`, byte 1 is `0x06`, 110
  to 1024 bytes. The minimum is 1 + 1 + 32 + 32 + 12 + 32.

Envelope B (KIND=0x05, the export file) is a local file and never reaches the
server.

### 8.2 Column rules

For a row in `user_keys` or `household_member_keys`:

- **`pwd`**: `kek_salt` is 16 bytes, `kek_kdf_kind` is `0x02` (Argon2id),
  `kek_kdf_params` is 9 bytes.
- **`recovery`**: `kek_salt` is NULL because the key derives from the phrase
  alone, `kek_kdf_kind` is `0x03` (BIP-39 and HKDF), `kek_kdf_params` is
  zero-length. A zero-length value is not the same as NULL.
- **`ecies`**: `kek_salt`, `kek_kdf_kind` and `kek_kdf_params` are NULL,
  because the key was not derived by a KDF. The per-handoff entropy is the
  `EPHEMERAL_PUB` inside envelope C. `sender_user_id` and `sender_pubkey` are
  set, and `sender_pubkey` equals the sender's `users.pubkey`. A client cannot
  upload this kind through the key endpoints. The server writes it in §4.7.

Password rows accept Argon2id only. `kek_kdf_kind = 0x01` is rejected.
`crypto-design.md` §3.2 reserves it as "was PBKDF2-SHA256. Never written;
never read. Not reused." The client chooses what it sends, so accepting `0x01`
on a write would let a client downgrade its own key derivation to PBKDF2.

`userKeys` and `memberKeys` must each be one `pwd` row and one `recovery` row.
A client that wrote only one would leave an account that can be unlocked only
one way, with nothing to show it.

For `users`:

- `verifier_kdf_kind` is `0x02`, and `verifier_kdf_params` is 9 bytes.
- `verifier_salt` is 16 bytes.
- `password_verifier` is 32 bytes, the Argon2id output.
- `pubkey` is 32 bytes.

### 8.3 Failure response

A structural failure returns 400 `INVALID_BLOB` with the message
`Invalid key material`. It does not say which check failed. Two cases use the
same code with a message that names the cause, because each byte in them is
well-formed on its own: a `senderPubkey` that is not the caller's (§4.7), and
a `pwd` member row whose KDF columns differ from the account's (§4.8).

No retry fixes an `INVALID_BLOB`. The client is sending bytes the server will
never accept, so in production it means a client bug or tampering.

---

## 9. Error model

```json
{ "error": "human-readable message", "code": "MACHINE_CODE", "data": { ... } }
```

`data` is present only when the error carries some. A 429 from a rate limit
also sets a `Retry-After` header.

### 9.1 Error codes

General:

- `BAD_REQUEST` (400): malformed input, wrong content type, body too large.
- `UNAUTHORIZED` (401): no session, an invalid or expired session, or a wrong
  email or code.
- `FORBIDDEN` (403): the invite or household is not the caller's.
- `NOT_FOUND` (404): unknown route, invite, session, household or vault
  version.
- `QUOTA_EXCEEDED` (413): the household's vault storage is full.
- `TOO_MANY_REQUESTS` (429): a rate limit, or too many wrong codes.
- `INTERNAL_ERROR` (500): an email could not be sent, or an unhandled error.

Login and signup:

- `AUTH_PENDING_INVALID` (401): `/login-complete` and both signups. The bridge
  token is unknown, expired or used.
- `VERIFIER_MISMATCH` (401): `/login-complete`. The password proof is wrong.
- `ALREADY_SIGNED_UP` (409): both signups. The account already has keys.
- `INVALID_BLOB` (400): any endpoint that takes key material, and the vault
  upload. See §8.
- `NO_HOUSEHOLD` (409): vault routes, `POST /invites`, `/rewrap-keys`,
  `/recovery-reset`. The caller is not in a household yet.

Recovery:

- `RECOVERY_SESSION` (403): any route a recovery session may not use.
- `RECOVERY_SESSION_REQUIRED` (403): `/recovery-reset` called on an ordinary
  session.
- `RECOVERY_SESSION_EXPIRED` (401): `/recovery-reset` called with a JWT more
  than 5 minutes old (§3.9).

Invites and handoff:

- `INVALID_INVITE` (404): accept and `/signup-with-invite`. Unknown token.
- `EMAIL_MISMATCH` (403): accept and `/signup-with-invite`. The invite was
  sent to a different address.
- `INVITE_EXPIRED` (410): accept and `/signup-with-invite`.
- `INVITE_ALREADY_ACCEPTED` (409): accept and `/signup-with-invite`. The
  invite is not `open`.
- `INVITE_ALREADY_PENDING` (409): `POST /invites`. The sender already has an
  open invite to this address.
- `INVITE_COMPLETED` (409): `DELETE /invites/:id`. A completed invite cannot
  be revoked.
- `INVITE_NOT_FOUND` (404): add member. Unknown invite id.
- `INVITE_INVALID_STATE` (409): add member. The invite is not awaiting a
  handoff, or is not for that user.
- `HOUSEHOLD_FULL` (409): `POST /invites` and add member when the household
  has 2 members. Accept when the caller already has a household. Add member
  when the invitee joined another household first.
- `HOUSEHOLD_ROW_RACE` (409): add member. The membership exists and the
  handoff row is gone, so the invitee has already rewrapped.
- `NO_PENDING_HANDOFF` (409): rewrap member keys. There is no `ecies` row to
  consume.
- `NO_PASSWORD_KEY` (409): rewrap member keys. The account has no `pwd` row in
  `user_keys`.
- `NOT_OWN_KEYS` (403): rewrap member keys. The path names another user.

The vault's version conflict is a 409 with its own body (§5).

### 9.2 Enumeration

`/login` always returns 200, and `/verify-otp` returns the same
`Invalid email or code` for an unknown address and a wrong code. The specific
codes above are only returned to a caller who is authenticated or has just
proved control of the address with a code, so they do not reveal whether an
email has an account.

---

## 10. Rate limits

Limits are counted in D1, per IP address and per subject. The subject is the
authenticated user, except on `/login`, where it is the email, and on the
bridge-token endpoints, where it is the user the token resolves to. If D1
fails, the limiter lets the request through, so a broken limiter does not take
the API down.

Endpoints on one line share a counter unless the line says otherwise.

- `POST /auth/login`: 5 a minute per IP, 3 per 15 minutes per email.
- `POST /auth/verify-otp` and `POST /auth/login-complete`: 30 a minute per IP
  between them. 10 per 15 minutes per user, counted separately for each.
- `POST /auth/signup` and `POST /auth/signup-with-invite`: 5 an hour per IP
  and 5 an hour per user.
- `GET /auth/key-bundle`: 60 a minute per IP, 30 a minute per user.
- `POST /auth/rewrap-keys` and `POST /auth/recovery-reset`: 5 an hour per IP
  between them. 1 an hour per user, counted separately for each.
- `POST /auth/logout`, `GET /auth/me`, `DELETE /auth/account`,
  `POST /auth/revoke-all-sessions`, `GET /auth/sessions` and
  `DELETE /auth/sessions/:id`: 30 a minute per IP.
- `POST /invites`: 20 an hour per IP, 5 an hour per user.
- `GET /invites`: 60 a minute per IP, 30 a minute per user.
- `POST /invites/:token/accept`: 10 an hour per IP, 3 an hour per user.
- `DELETE /invites/:id`: 30 a minute per IP, 10 an hour per user.
- `GET /handoffs/pending`: 60 a minute per IP and per user.
- `GET /handoffs/incoming`: 120 a minute per IP and per user, which leaves
  room for a poll every few seconds while the waiting screen is open.
- `POST /households/:householdId/members`: 10 an hour per IP, 5 an hour per
  user. It is called once per invite.
- `POST /households/:householdId/members/:userId/rewrap`: 10 an hour per IP, 3
  an hour per user.
- `GET /vault`, `GET /vault/data`, `GET /vault/history` and
  `GET /vault/data/:vaultId`: 60 a minute per IP, 120 a minute per user.
- `PUT /vault/data`: 30 a minute per IP, 60 a minute per user.

---

## 11. Wire encoding

Every binary field in a JSON body is base64url: salts, verifiers, public keys
and wrapped blobs. The server writes it without padding. It reads padded or
unpadded input, in either the `-_` or the `+/` alphabet. The server's codec is
`worker/src/lib/bytes.ts` and the client's is `src/lib/base64url.ts`, and the
two must agree.

Fingerprints are hex. The vault blob is sent and returned as raw bytes, not
JSON.

---

## 12. Not built

- **Leaving a household**: it needs a new MasterKey, wrapped again under the
  remaining member's keys, and a new vault version encrypted under it. Not
  designed. Deleting the account is the only exit (§3.11).
- **More than one household per user**: it would drop the unique index on
  `household_members.user_id` and need a way to pick the household for a
  request.
- **Changing the password while signed in**: it would touch the verifier and
  the `pwd` rows, much as `/auth/rewrap-keys` does, with a new password behind
  the derivation. `/auth/recovery-reset` is the only way to set a new password
  today.
- **Rotating the recovery phrase** (`crypto-design.md` §6.5).
- **Rotating keys after a suspected device compromise**: out of scope in
  `crypto-design.md` §1.
- **The client half of the Argon2id upgrade** (§3.8).
- **Extending or re-sending an invite in one call** (§4.9).
- **A choice at signup for someone who has an invite waiting** (§3.6): the
  design was for `/auth/signup` to look for an open invite before creating
  anything, return it without creating a household, and let the client offer
  joining (through `/auth/signup-with-invite`) or starting a household of
  their own. Starting their own would be permanent and would set the invite to
  `declined`. When something does set `declined`, `assertAcceptable` in
  `worker/src/services/invites.ts` needs a case for it, or a declined invite
  reports as `INVITE_ALREADY_ACCEPTED`.

---

## Not checked

Every endpoint, table, error code, batch and limit above was read against
`worker/src` and `worker/migrations/0001_initial.sql` on 2026-10-13. Nothing
was run. These statements rest on reading or on the earlier text of this file:

- The client behaviour in §2.3, and the client's obligations in §3.7, §3.8 and
  §4.5.
- That SQLite refuses the delete in §1.5 for `sender_user_id`. The schema has
  no `ON DELETE` action there. No test deletes an inviter mid-handoff.
- The race described at the end of §3.5. It follows from the statements in the
  batch and has not been reproduced.
