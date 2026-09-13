# SafelySpend — Backend Schema + Endpoints Design

**Status:** Phase 2 of the auth + couples + privacy rewrite. Locks the server-side surface — D1 schema, Worker endpoint contracts, JWT lifecycle, transaction boundaries, anti-downgrade enforcement, server-side validation, error model. **Built.** Nine places where this doc did not survive contact with D1, with Phase 1, or with the shipped Phase 3 client are corrected inline below and listed together in §13.

**Scope:** Everything that lives in `worker/` or `worker/migrations/`. References Phase 1 (`../crypto-design.md`) for envelope formats, KDF choices, key hierarchy, and the invite handoff sequence. **Does not** cover client crypto implementation (Phase 3), login/unlock UX (Phase 5), invite UI (Phase 7), or household scope UI (Phase 8).

The schema is written for a clean database (`00_overview.md`). There is no legacy user, no format-v1 read path, and no per-user version state anywhere below.

**Gating answers used (locked this session):**
- **Q5** (households per user) — **one per user in v1**. Schema enforces `UNIQUE(household_members.user_id)`. JWT carries a single `householdId`; no switcher.
- **Q6** (JWT vs MasterKey lifetimes) — **independent**. JWT lives 7d in cookie, auto-rotates at halfway (current behaviour). MasterKey lives in JS memory until tab close or explicit lock. Local re-unlock uses cached wrapped-key rows; no OTP, no server contact required. Logout clears the server session and cookie but does not touch MasterKey (and vice versa).
- **Sweep-poll shape** — short polling. `GET /v1/handoffs/incoming` returns immediately with the current state. Client picks cadence (Phase 5 default 10–30s).

**Phase 1 invariants this doc plumbs through to the schema and endpoints:**
- §2 — `user_keys` is one row per `(user_id, kek_kind)`; `household_member_keys` is one row per `(household_id, user_id, kek_kind)` with `kek_kind ∈ {'pwd', 'recovery', 'ecies'}` and the `'ecies'` row is transient.
- §3.2 — every wrapped-key row carries `kek_kdf_kind` and `kek_kdf_params` so the wrapping algorithm is self-describing.
- §3.4 — Argon2id rolling upgrade. The rewrap endpoint must replace old rows atomically only after new rows are durable; never delete-before-insert.
- §4.4 — `VERSION=0x02` is the only accepted first byte. Structural validation (§8) rejects anything else outright; there is no legacy branch and no tombstone gating it.
- §6.4 step 5 — recovery flow swap is upsert-then-retire, never delete-then-insert. Recovery-kind rows are never deleted by a password-reset.
- §7.2 — endpoint roles `invite-issue`, `signup-with-invite`, `auth-with-otp`, `sweep-pending-handoffs`, `sweep-poll`, `household-add-member`, `rewrap-member-keys`, `invite-accept` each map to a real `method+path` here.
- §7.3 — D1 transaction boundaries. Confirmed: D1 has no `BEGIN/COMMIT` outside `db.batch()`. `db.batch()` is the only atomic primitive and it is what the existing vault code already uses (`worker/src/services/vault.ts:179-196`, `worker/src/services/vault.ts:366-369`). Half-applied state is impossible inside a single `batch()`; the network-failure-after-success case is covered by idempotency keys.

**Out of scope for this doc:**
- Worker code or test code (Phase-internal implementation detail).
- SQL migration files in `.sql` form (schema is sketched in fenced blocks; the actual migrations are Phase 2's *implementation* output).
- Client-side wire encoding (base64 vs raw bytes) of wrapped blobs — Phase 3.
- KEK_pwd / KEK_rec rotation (password change, recovery-phrase rotation) — out of v1.
- Leave-a-household (Q7, deferred to post-v1).

---

## 1. D1 schema diff

### 1.1 Current schema (v0.37, after migration 0004)

```sql
-- worker/migrations/0001..0004 (summary)
users         (id, email UNIQUE, created_at, updated_at)
auth_codes    (id, user_id → users, code_hash, expires_at, used_at,
               attempt_count, created_at)
sessions      (id, user_id → users, expires_at, created_at)
vaults        (id, user_id → users, version, r2_key, size_bytes, checksum,
               created_at, idempotency_key)
sync_state    (user_id PRIMARY KEY → users, current_version,
               current_vault_id → vaults, updated_at)
rate_limits   (key PRIMARY KEY, count, reset_at)
```

### 1.2 Changed tables

#### `users` — gains auth + key fields, schema-version tombstone

```sql
ALTER TABLE users ADD COLUMN password_verifier  BLOB;            -- Argon2id(password, verifier_salt) — see §3.3
ALTER TABLE users ADD COLUMN verifier_salt      BLOB;            -- 16 random bytes; independent of kek_salt
ALTER TABLE users ADD COLUMN verifier_kdf_kind  INTEGER;         -- 0x02 = Argon2id (only valid value in v2)
ALTER TABLE users ADD COLUMN verifier_kdf_params BLOB;           -- 9 bytes for Argon2id per Phase 1 §3.2
ALTER TABLE users ADD COLUMN pubkey             BLOB;            -- 32-byte X25519 public key (plaintext per §1 threat model)
```

Since the tables are being rebuilt, express these in a rewritten `0001_initial.sql` rather than as `ALTER`s bolted onto a schema history nobody will replay. The `ALTER` form above just shows the diff against what exists today.

Columns stay nullable, because a user row is created by `/auth/login` (find-or-create on first OTP request) before signup has supplied any key material. The row is inert until `/auth/signup` fills it in: no `pubkey` means no `user_keys`, which means no household membership, which means no vault access. `signup` is guarded by `WHERE pubkey IS NULL` for first-write-wins idempotency.

#### `vaults` and `sync_state` — re-keyed to `household_id`

Vaults are household-keyed. `user_id` is gone from both tables rather than kept alongside `household_id` — a vestigial column that new code must remember never to read is worse than no column.

```sql
CREATE TABLE vaults (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  r2_key          TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  checksum        TEXT NOT NULL,
  idempotency_key TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_vaults_household_version     ON vaults(household_id, version);
CREATE UNIQUE INDEX idx_vaults_household_idempotency ON vaults(household_id, idempotency_key);

CREATE TABLE sync_state (
  household_id     TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  current_version  INTEGER NOT NULL,
  current_vault_id TEXT REFERENCES vaults(id),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`sync_state` is one row per household. The R2 key becomes `<household_id>/<vault_id>`; the old `<user_id>/…` layout has no live objects under it.

**Optimistic concurrency now spans two people.** The existing `X-Expected-Version` check (`worker/src/services/vault.ts`) assumes a single writer, where a conflict means the same person on two devices. A household vault makes genuine two-writer conflicts routine — both partners editing on the same evening — and a rejected push then costs someone else's work rather than your own stale tab. The mechanism is unchanged here; what the losing client *does* is [Phase 8](08_household_ui_scope.md)'s call, and silently discarding is not it.

### 1.3 New tables

#### `households`

```sql
CREATE TABLE households (
  id          TEXT PRIMARY KEY,                 -- client-generated UUID
  name        TEXT NOT NULL,                    -- UI label; default "Household" if unset
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

No `owner_id` — ownership is implicit in `household_members.role='owner'`. No size limit column in v1.

#### `household_members`

```sql
CREATE TABLE household_members (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_household_members_user      ON household_members(user_id);           -- Q5: one household per user
CREATE UNIQUE INDEX idx_household_members_user_hh   ON household_members(user_id, household_id);
CREATE        INDEX idx_household_members_household ON household_members(household_id);
```

`UNIQUE(user_id)` is the schema-level enforcement of Q5. Phase 8 / future multi-household work drops it.

#### `user_keys` — wrapped PrivKey, one row per `(user_id, kek_kind)`

```sql
CREATE TABLE user_keys (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kek_kind         TEXT NOT NULL CHECK (kek_kind IN ('pwd', 'recovery')),
  wrapped_priv_key BLOB NOT NULL,                            -- envelope A, KIND=0x03; opaque to server
  kek_salt         BLOB,                                     -- 16 bytes for kek_kind='pwd'; NULL for 'recovery' (deterministic from phrase)
  kek_kdf_kind     INTEGER,                                  -- 0x01=PBKDF2 (legacy), 0x02=Argon2id, 0x03=BIP-39+HKDF
  kek_kdf_params   BLOB,                                     -- 4 bytes for PBKDF2; 9 bytes for Argon2id; empty for BIP-39+HKDF
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kek_kind)
);
```

Salt / KDF rules (per Phase 1 §6.3):
- `kek_kind='pwd'`: `kek_salt` 16 bytes NOT NULL; `kek_kdf_kind ∈ {0x01, 0x02}`; `kek_kdf_params` length matches the kind (4 or 9 bytes).
- `kek_kind='recovery'`: `kek_salt` NULL; `kek_kdf_kind=0x03`; `kek_kdf_params` zero-length.

Enforced at the application layer (server-side validation, §6). SQLite `CHECK` constraints are inadequate for the cross-column dependency.

The `pubkey` *itself* lives on `users` (one per user). The wrapped *private* key is per `(user, kek_kind)` because a user has two ways to unwrap it.

#### `household_member_keys` — wrapped MasterKey, one row per `(household, user, kek_kind)`

```sql
CREATE TABLE household_member_keys (
  household_id        TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  kek_kind            TEXT NOT NULL CHECK (kek_kind IN ('pwd', 'recovery', 'ecies')),
  wrapped_master_key  BLOB NOT NULL,                          -- envelope A (KIND=0x02) for pwd/recovery, envelope C (KIND=0x06) for ecies
  kek_salt            BLOB,                                   -- 16 bytes for 'pwd'; NULL otherwise
  kek_kdf_kind        INTEGER,                                -- 0x01/0x02 for 'pwd'; 0x03 for 'recovery'; NULL for 'ecies'
  kek_kdf_params      BLOB,                                   -- 4/9/0 bytes for pwd/argon/recovery; NULL for 'ecies'
  sender_user_id      TEXT REFERENCES users(id),              -- only for kek_kind='ecies'; NULL otherwise. Identifies A.
  sender_pubkey       BLOB,                                   -- only for kek_kind='ecies'; mirror of SENDER_PUB inside envelope C for fast lookup
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (household_id, user_id, kek_kind)
);
CREATE INDEX idx_member_keys_user ON household_member_keys(user_id);
```

Per Phase 1 §6.3 salt/KDF rules:
- `kek_kind='pwd'`: `kek_salt` NOT NULL, `kek_kdf_kind ∈ {0x01, 0x02}`, params length matches, `sender_*` NULL.
- `kek_kind='recovery'`: `kek_salt` NULL, `kek_kdf_kind=0x03`, params zero-length, `sender_*` NULL.
- `kek_kind='ecies'`: `kek_salt` NULL, `kek_kdf_kind` NULL, `kek_kdf_params` NULL, `sender_user_id` and `sender_pubkey` NOT NULL. The per-handoff entropy lives inside envelope C as `EPHEMERAL_PUB`; the row stores the redundant `sender_pubkey` so B's client can compute the safety-number fingerprint without parsing the envelope first.

The `'ecies'` row is the only kind the server is allowed to delete on a normal flow (§4.8 of this doc, mirroring Phase 1 §6.4 step 5 / §7.2 step "rewrap-member-keys"). `'pwd'` and `'recovery'` rows are upserted in place; they are deleted only when the user deletes their account.

#### `invites`

```sql
CREATE TABLE invites (
  id                  TEXT PRIMARY KEY,
  token               TEXT NOT NULL UNIQUE,                       -- 32 random bytes base64url; sent in email
  sender_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id        TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipient_email     TEXT NOT NULL,                              -- lowercased, trimmed
  recipient_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL, -- NULL until B signs up / accepts
  status              TEXT NOT NULL CHECK (status IN ('open', 'accepted_pending_handoff', 'completed', 'expired', 'revoked')),
  expires_at          TEXT NOT NULL,                              -- ISO; sender_user_id can set up to 3 days from now
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE        INDEX idx_invites_recipient_email ON invites(recipient_email);
CREATE        INDEX idx_invites_recipient_user  ON invites(recipient_user_id);
CREATE        INDEX idx_invites_sender_user     ON invites(sender_user_id);
CREATE        INDEX idx_invites_expires_at      ON invites(expires_at);
CREATE        INDEX idx_invites_status          ON invites(status);
```

State machine:
- `open` — invite issued, no recipient action yet.
- `accepted_pending_handoff` — B has signed up (or attached an existing account), has `pubkey` + `wrapped_priv_*` rows. No household membership yet because B has no MasterKey. A's next login will wrap.
- `completed` — A has wrapped, B has rewrapped. Membership is durable.
- `expired` — `expires_at < now` and recipient never signed up. Set by the cleanup sweep on `/auth/login` (mirroring existing `cleanupExpiredCodes`).
- `revoked` — sender explicitly cancelled via `DELETE /v1/invites/:id`.

In v1, an invite that reaches `accepted_pending_handoff` and then ages past `expires_at` is **not** auto-expired (per Phase 1 §7.3 "Invite expires before A logs in"). A's UI shows a banner; A re-sends or revokes.

#### `auth_pending` — bridge for the two-step OTP flow

```sql
CREATE TABLE auth_pending (
  id          TEXT PRIMARY KEY,                                   -- opaque random 32 bytes base64url; bearer token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,                                      -- now + 5 minutes
  used_at     TEXT,                                               -- single-use; set when /login-complete consumes it
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_pending_user_id    ON auth_pending(user_id);
CREATE INDEX idx_auth_pending_expires_at ON auth_pending(expires_at);
```

Why a new table and not a JWT-with-purpose claim: the existing JWT middleware (`worker/src/middleware/auth.ts`) is shaped around the full session JWT. Re-using it for an OTP-bridge token would either add a `purpose` field that every handler has to remember to check (footgun), or duplicate the verify logic. A dedicated bearer credential with its own 5-minute single-use semantics is cleaner. Cleanup runs alongside `cleanupExpiredCodes` in the same `executionCtx.waitUntil(...)` background.

### 1.4 Indexes summary (new)

| Index | Purpose |
|-------|---------|
| `idx_household_members_user` UNIQUE | Q5 enforcement (one household per user) |
| `idx_household_members_user_hh` UNIQUE | Composite for lookup-by-user-and-household |
| `idx_household_members_household` | List members of a household |
| `idx_member_keys_user` | List all key rows for a user (used by `/auth/key-bundle`) |
| `idx_invites_recipient_email` | Sweep on signup (`check_for_invites` pattern) |
| `idx_invites_recipient_user` | List invites *for* a user |
| `idx_invites_sender_user` | List invites *from* a user (sweep pending handoffs) |
| `idx_invites_expires_at` | Background cleanup |
| `idx_invites_status` | State-filtered queries |
| `idx_vaults_household_*` | Vault lookup and idempotency, household-scoped |
| `idx_sync_state_household_id` UNIQUE | One sync_state per household |
| `idx_auth_pending_*` | Standard for the new bridge table |

### 1.5 Foreign key + cascade summary

- `ON DELETE CASCADE` on all `*_user_id → users` and `*_household_id → households` references — account deletion (`DELETE /v1/auth/account`) and household teardown propagate cleanly.
- `invites.recipient_user_id` uses `ON DELETE SET NULL` so that if an invitee deletes their account before the handoff completes, the invite remains visible to A (so A can revoke it).
- `sync_state.current_vault_id → vaults(id)` is unchanged from v0.37 behaviour.

---

## 2. JWT lifecycle (Q6: independent)

### 2.1 What's unchanged from v0.37

- Cookie name `__budget_session`, httpOnly, secure, SameSite=Strict.
- 7-day default lifetime; 30-day with `rememberMe`.
- Auto-rotation at the halfway point (`JWT_RENEWAL_THRESHOLD = JWT_EXPIRY_SECONDS / 2`). `worker/src/middleware/auth.ts:51-76`.
- Session table for revocation (`POST /auth/revoke-all-sessions`, etc.).
- JWT secret rotation supported via `JWT_SECRET_PREVIOUS`.

### 2.2 What's new

- **JWT payload gains `hid` (household_id).** Currently `{sub, sid, email, iat, exp}`; v2 adds `hid?: string`.

  **`hid` is informational, and server-side scoping does not read it.** An earlier draft said the household is set at signup and never changes in v1, so vault routes could derive scope from the claim. That is true for the member who *created* the household and false for the one who joined it: an invitee signs up with no household at all, and gains one mid-session when the inviter completes the handoff. Scoping from the claim would leave them locked out of their own vault until they logged in again, for no reason a user could understand.

  The auth middleware resolves the household from `household_members` on every request — a `LEFT JOIN` onto the session lookup it already performs, so no extra round trip — and puts it on the request context. `hid` stays in the payload for the client's benefit and is carried across JWT rotation, along with `rec`.

  This is also the stronger position: the claim is signed by a key that is itself inside the server-compromise blast radius (Phase 1 §1, property 6), so a forged `hid` buys nothing when scope comes from a row instead.

- **The claim is optional.** A user between `signup-with-invite` and the handoff has no household. Routes that need one (all vault routes, issuing an invite) reject with **409 `NO_HOUSEHOLD`**; `/auth/me` and `/auth/key-bundle` return `household: null`.
- **`email` claim becomes optional.** Local-only users do not have a server account and never get a JWT at all. The first time a user opts into cloud sync, they get an email + JWT. Until then, the entire server surface is unreachable.

### 2.3 Relationship to MasterKey (independent — Q6 locked)

| Event | JWT state | MasterKey state |
|-------|-----------|-----------------|
| App open, cookie valid, last unlock < session timeout | JWT used as-is, rotated if past halfway | Re-unlock locally with password against cached wrapped-key rows. No server roundtrip. |
| App open, cookie valid, no MasterKey in memory | JWT used | Local re-unlock prompt (password only). No OTP. |
| App open, cookie expired | OTP + verifier flow (§3.1–§3.3 below) | After verifier check passes, server returns key bundle; client unwraps locally with password. |
| Explicit logout (`POST /auth/logout`) | Session deleted server-side; cookie cleared | **Untouched.** MasterKey stays in memory if user only logged out of cloud sync. (The client may decide to also zeroise — Phase 5's call.) |
| Tab close | Cookie persists (7d) | MasterKey zeroised (memory wiped). |
| Explicit local lock (Phase 5) | **Untouched.** JWT remains valid for refresh on next unlock. | MasterKey zeroised. |
| Server-side session revoke (e.g. lost device) | All JWT cookies invalidated | Untouched on remaining devices until they next try a vault op and 401. |

The server has zero knowledge of local MasterKey state. Endpoints that need a key (vault routes, key-bundle reads) hand the client the wrapped material; the unwrapping always happens client-side.

### 2.4 Cookie scope and CSRF stance

Unchanged from v0.37. SameSite=Strict + dedicated `X-Idempotency-Key`-style required headers on mutating routes prevent CSRF. New mutating routes (`POST /invites`, `POST /households/:id/members`, `POST /rewrap`) follow the same pattern.

---

## 3. Auth endpoints

All `Content-Type: application/json` unless otherwise stated. All responses follow the existing `AppError` envelope (`{ error, code, data? }`). Rate limits listed per endpoint; degrades open on D1 failure (same as `worker/src/middleware/rate-limit.ts:62-71`).

### 3.1 `POST /v1/auth/login` — request OTP

Unchanged from v0.37, including the find-or-create.

An earlier draft of this section said the server no longer creates a user automatically and that users only exist after `/auth/signup`. **That is not implementable and was not built.** Signup requires a bridge token, a bridge token requires a verified OTP, and an OTP requires a `users` row to hang the code off: the account has to exist before its owner can prove anything about it. §3.2 and §3.4 both assume the row already exists, so this section was the outlier. What makes find-or-create harmless is §1.2's inert row — no `pubkey` means no `user_keys`, no household, and no vault.

**Request:** `{ email: string }`

**Response (always 200):** `{ message: 'Code sent' }`. Returns 200 even for unknown emails (no enumeration).

**Side effect:** a background sweep on this endpoint expires stale invites, alongside the existing code and session cleanups.

**Rate limits:** existing — 5/min per IP, 3/15min per email. Unchanged.

**Errors:** 400 BAD_REQUEST (malformed email), 429 TOO_MANY_REQUESTS.

### 3.2 `POST /v1/auth/verify-otp` — verify code, get bridge token + salt

**New.** Splits the existing `POST /auth/verify` into two steps so `verifier_salt` is only returned after OTP success (no enumeration).

**Request:** `{ email: string, code: string }`

**Response (200):**
```json
{
  "authPendingToken": "<32-byte base64url>",   // single-use, 5 min
  "verifierSalt":     "<16-byte base64url>",
  "verifierKdfKind":  2,                       // 0x02 = Argon2id
  "verifierKdfParams": "<9-byte base64url>"
}
```

**Errors:** 401 UNAUTHORIZED (`Invalid email or code`, generic — same wording as current). 429 TOO_MANY_REQUESTS.

**Server-side:** a user row with `pubkey IS NULL` has requested an OTP but never completed signup. Respond with the bridge token as normal — the client routes itself to signup rather than login-completion based on the absence of a key bundle. No dedicated error code; this is an ordinary first-run state, not a mismatch.

**Side effect:** marks the matching `auth_codes` row used (`used_at = now`) and creates an `auth_pending` row with the returned token + 5-minute `expires_at`. OTP code is consumed at this step (not at `/login-complete`) so a malicious client can't replay the bridge step.

**Rate limits:** 10/15min per user (existing `auth:verify:user`), 30/min per IP.

### 3.3 `POST /v1/auth/login-complete` — verifier check, issue session JWT

**New.** Consumes the bridge token, checks the verifier, returns full session JWT + key bundle.

**Request:**
```json
{
  "authPendingToken":   "<base64url>",
  "verifierCandidate":  "<32-byte base64url>",   // Argon2id(password, verifier_salt, ...) computed client-side
  "rememberMe":         false
}
```

**Response (200):**
```json
{
  "user":           { "id": "...", "email": "..." },
  "household":      { "id": "...", "name": "..." },
  "keyBundle":      { /* same shape as GET /v1/auth/key-bundle, §3.7 */ }
}
```

`Set-Cookie` header sets `__budget_session` per existing pattern.

**Errors:**
- 401 UNAUTHORIZED with `code='AUTH_PENDING_INVALID'` — token unknown / already used / expired.
- 401 UNAUTHORIZED with `code='VERIFIER_MISMATCH'` — verifier check failed. Server uses constant-time comparison.
- 409 SCHEMA_VERSION_MISMATCH — user is on v1.
- 429 TOO_MANY_REQUESTS.

**Server-side:** consume `auth_pending` row (set `used_at`); look up `users.password_verifier`; constant-time compare against `verifierCandidate`; on match, create session row, sign JWT (now with `hid` claim), return key bundle.

**Single batch:** `UPDATE auth_pending SET used_at=now WHERE id=? AND used_at IS NULL RETURNING user_id` then verifier check then `INSERT sessions`. If `UPDATE` affected 0 rows, return AUTH_PENDING_INVALID. Verifier check and session insert can't be in one batch because the verifier check is in Worker code; the consumption of `auth_pending` is the atomic gate.

**Rate limits:** 10/15min per user (mirrors verify), 30/min per IP. A failed verifier candidate consumes the bridge token — the user must re-do the OTP flow. This is intentional and matches Phase 1 §3.3.

### 3.4 `POST /v1/auth/signup` — create new cloud-sync account (no invite)

**New.** Either:
- A net-new cloud-sync user (after OTP flow to prove email control).
- A local-only user opting into cloud sync (also after OTP flow). The client has already generated keys + MasterKey locally; this call uploads the wrapped material.

**Precondition:** client has completed `/login` and `/verify-otp` and holds an `authPendingToken`. (`/verify-otp` for a never-seen email creates the `users` row first via the existing find-or-create, returning the bridge token.)

**Request:**
```json
{
  "authPendingToken":   "<base64url>",
  "verifierCandidate":  "<base64url>",       // password proof (same Argon2id construction as /login-complete)
  "verifierSalt":       "<base64url>",       // 16 bytes — client picks (independent of any later kek_salt)
  "verifierKdfKind":    2,
  "verifierKdfParams":  "<base64url>",       // 9 bytes Argon2id
  "pubkey":             "<32-byte base64url>",
  "userKeys": [
    { "kekKind": "pwd",      "wrappedPrivKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedPrivKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ],
  "household": {
    "id":   "<client-generated UUID>",
    "name": "<string>"
  },
  "memberKeys": [
    { "kekKind": "pwd",      "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedMasterKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ],
  "rememberMe":    false
}
```

**Response (200):** same shape as `/login-complete`.

**Errors:**
- 401 AUTH_PENDING_INVALID.
- 400 INVALID_BLOB (server validation failed; see §6).
- 409 ALREADY_SIGNED_UP — `users.pubkey` is already set, or any of `user_keys` / `household_members` rows already exist for this user.
- 400 BAD_REQUEST — missing required key kinds (both `pwd` and `recovery` are mandatory).
- 429 TOO_MANY_REQUESTS.

**Ordering — the correction that matters most in this doc.**

> **A guarded `UPDATE` that matches zero rows does not roll a D1 batch back.** It is a *success* with `meta.changes === 0`. D1 rolls a batch back on a statement **error** — a constraint violation — and on nothing else.

An earlier draft of this section, of §3.5, and of §6.1 assumed the opposite, and every "if the UPDATE affected 0 rows the batch rolls back" claim built on it was wrong. Taken literally it would have let the rest of a signup apply against a bridge token that was already spent.

What is built instead:

1. **Validate all key material first**, before anything is spent. Malformed blobs then cost the user a retry rather than a fresh OTP.
2. **Spend the bridge token as a standalone guarded `UPDATE ... RETURNING user_id`.** One statement is atomic on its own, and it is the gate for everything after it. The cost is that a failure past this point burns the token; that is the same trade §3.3 already accepts for `/login-complete`.
3. **Run the rest as one batch**, relying on primary keys and unique indexes — not on `WHERE` guards — for idempotency. Every insert below is covered by one, so a replay raises a constraint violation and the batch really does roll back.

```
UPDATE auth_pending SET used_at=now WHERE id=? AND used_at IS NULL RETURNING user_id   -- standalone
-- then, in one batch:
UPDATE users SET password_verifier=?, verifier_salt=?, verifier_kdf_kind=?, verifier_kdf_params=?,
                 pubkey=?, updated_at=now
       WHERE id=? AND pubkey IS NULL            -- belt-and-braces; the guard below is what enforces it
INSERT INTO user_keys (...)                     × 2 rows (pwd + recovery)   -- PK (user_id, kek_kind)
INSERT INTO households (...)                                                -- PK id
INSERT INTO household_members (household_id, user_id, role='owner', joined_at=now)  -- UNIQUE(user_id)
INSERT INTO household_member_keys (...)         × 2 rows (pwd + recovery)   -- PK (household_id, user_id, kek_kind)
INSERT INTO sessions (id, user_id, expires_at)                              -- PK id
```

A second signup for the same account is caught by an explicit `pubkey IS NULL` read before the batch, and by the `user_keys` and `household_members` constraints inside it. Both paths return 409 ALREADY_SIGNED_UP. The JWT is signed in Worker code after the batch.

**Rate limits:** 5/h per user (paired with the `auth_pending` 5-minute lifetime, this limits abuse).

### 3.5 `POST /v1/auth/signup-with-invite` — accept invite as new account

**New.** Same shape as `/auth/signup` but:
- `invite_token: string` is required.
- `household` block is **omitted** — the household already exists (created by A); B is joining it.
- `memberKeys` block is **omitted** — B has no MasterKey yet. The wrap arrives later via the ECIES handoff (§4.7).
- `invite` is verified server-side: `status='open'`, `expires_at > now`, `recipient_email` matches the user's email.

**Request:**
```json
{
  "authPendingToken":  "...",
  "verifierCandidate": "...",
  "verifierSalt":      "...",
  "verifierKdfKind":   2,
  "verifierKdfParams": "...",
  "pubkey":            "...",
  "userKeys":          [ { "kekKind":"pwd", ... }, { "kekKind":"recovery", ... } ],
  "inviteToken":       "<base64url>",
  "rememberMe":        false
}
```

**Response (200):**
```json
{
  "user":     { "id": "...", "email": "..." },
  "household": null,                           // not joined yet
  "invite": {
    "id": "...",
    "status": "accepted_pending_handoff",
    "senderEmail": "...",                      // shown to B's "waiting for partner" screen
    "senderPubkey": "<base64url>"              // for the safety-number fingerprint (B verifies A's pubkey out-of-band)
  },
  "keyBundle": { /* user_keys only; no household_member_keys yet */ }
}
```

**Ordering.** Per the correction in §3.4, the invite claim cannot live inside the account batch — a guard that matches nothing would leave the rest applied. It also must not run *before* it. The sequence is:

```
-- read: validate the invite (status, expiry, recipient_email) and fail early
UPDATE auth_pending SET used_at=now WHERE id=? AND used_at IS NULL RETURNING user_id   -- standalone
-- then, in one batch:
UPDATE users SET password_verifier=?, ..., pubkey=?, updated_at=now WHERE id=? AND pubkey IS NULL
INSERT INTO user_keys (...) × 2
INSERT INTO sessions (...)
-- then, standalone and guarded:
UPDATE invites SET recipient_user_id=?, status='accepted_pending_handoff', updated_at=now
       WHERE token=? AND status='open' AND expires_at > now AND recipient_email=?
```

**The account is created before the invite is claimed, deliberately.** Reverse the two and a failure in the account batch strands a claimed invite against an account with no keys — a state nothing in v1 can repair, because the invite is no longer `open` and the recipient cannot sign up twice. In this order a failed claim leaves a perfectly usable account that can accept the same invite again through `POST /v1/invites/:token/accept` (§4.3).

If the `UPDATE invites` affects 0 rows the server re-reads the invite and returns 410 INVITE_EXPIRED, 409 INVITE_ALREADY_ACCEPTED, or 404 INVALID_INVITE depending on which condition failed. The disambiguating read is safe because the caller is already authenticated by the bridge token.

**Expiry is reported before status.** The background sweep on `/auth/login` rewrites a lapsed `open` invite to `expired`, so a status check that runs first reports a timed-out invite as "already used" — the wrong thing to tell the recipient and the wrong code for the client to branch on. Check `status='expired' OR expires_at <= now` → 410 first, then `status != 'open'` → 409.

**Errors:** 410 INVITE_EXPIRED, 409 INVITE_ALREADY_ACCEPTED, 404 INVALID_INVITE, 400 INVALID_BLOB, plus the standard auth errors above.

### 3.7 `GET /v1/auth/key-bundle` — fetch wrapped keys for local unlock

**New.** Called on app open (or whenever the client needs the latest server-side wrapping). Authenticated.

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
  "household": { "id": "...", "name": "..." },     // may be null if user has no household yet (post-signup-with-invite, pre-handoff)
  "memberKeys": [                                  // 0..3 rows
    { "kekKind": "pwd", ... },
    { "kekKind": "recovery", ... }
    // OR a single 'ecies' row pre-rewrap
  ]
}
```

**Errors:** 401 UNAUTHORIZED.

**Rate limits:** 30/min per user. Conservative; the client should cache this.

### 3.8 `POST /v1/auth/rewrap-keys` — Argon2id rolling upgrade

**New.** Implements Phase 1 §3.4 upgrade pattern. Client unlocks with stored params, re-derives KEK_pwd at current target params, and POSTs the new wrapped rows.

**Request:**
```json
{
  "newKekSalt":      "<base64url>",
  "newKekKdfKind":   2,
  "newKekKdfParams": "<base64url>",        // new Argon2id params
  "newUserKeysPwd":  { "wrappedPrivKey": "..." },
  "newMemberKeysPwd": { "wrappedMasterKey": "..." }
}
```

Only the `kek_kind='pwd'` rows are rewrapped (recovery is BIP-39, params don't change). Both rows are required; partial rewrap is a footgun.

**Response (200):** `{ ok: true }`

**Single `db.batch()`:**
```
UPDATE user_keys           SET wrapped_priv_key=?,  kek_salt=?, kek_kdf_kind=?, kek_kdf_params=?, updated_at=now
       WHERE user_id=? AND kek_kind='pwd'
UPDATE household_member_keys SET wrapped_master_key=?, kek_salt=?, kek_kdf_kind=?, kek_kdf_params=?, updated_at=now
       WHERE household_id=? AND user_id=? AND kek_kind='pwd'
UPDATE users               SET verifier_salt=?, verifier_kdf_params=?, password_verifier=?, updated_at=now
       WHERE id=?
```

The verifier params are also bumped at the same time (in Phase 1 §3.4 the upgrade pattern is "client re-derives KEK_pwd at new params" — the verifier should track the same params for consistency, so they upgrade together). The client must include a fresh `verifierCandidate` derived at the new params; Phase 3 fills in the request shape.

**Errors:** 400 INVALID_BLOB, 401 UNAUTHORIZED, 409 SCHEMA_VERSION_MISMATCH (user not on v2 — can't happen if `/login-complete` worked, but defensive).

**Rate limits:** 1/h per user. This is a rare event.

**Per Phase 1 §3.4 "never delete-before-insert":** the `UPDATE` here is in-place upsert (PRIMARY KEY exists), so the old wrap is overwritten by the new wrap in the same atomic batch. If the batch fails partway (impossible by D1 semantics) the client retries on next unlock. The client must keep the old derivation alive in memory until the server returns 200; only then does it commit to the new salt/params for its in-memory state.

### 3.9 Recovery-flow swap — `POST /v1/auth/recovery-reset`

**New.** Implements Phase 1 §6.4 step 4–5. After the client unwraps with the recovery phrase and the user picks a new password, the client POSTs the new password-kind rows. The recovery-kind rows are **not** touched.

**Request:**
```json
{
  "newVerifier": { "verifierCandidate": "...", "verifierSalt": "...", "verifierKdfKind": 2, "verifierKdfParams": "..." },
  "newUserKeyPwd":   { "wrappedPrivKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
  "newMemberKeyPwd": { "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." }
}
```

**Authentication: how a recovery session is obtained.** The original draft required a JWT carrying a `recovery=true` claim without ever saying how one could be issued — and the omission hides a real problem. A user in the recovery flow has forgotten their password, so they *cannot* produce a verifier candidate, so §3.3's check cannot be the thing that lets them in.

What is built:

- `POST /v1/auth/login-complete` accepts `via: 'recovery'`. It **skips the verifier check** and issues a session whose JWT carries `rec: true`.
- **A `rec` session reaches exactly two endpoints:** `GET /v1/auth/key-bundle` and `POST /v1/auth/recovery-reset`. Everything else — every vault route, every invite and handoff route, account deletion, session management — returns **403 `RECOVERY_SESSION`**.
- `recovery-reset` additionally requires the JWT to be **less than 5 minutes old** (`now - iat < 300`), and returns 401 `RECOVERY_SESSION_EXPIRED` otherwise.
- The claim survives JWT rotation. Dropping it on renewal would silently promote a recovery session to a full one.

**Why the confinement is not optional.** Skipping the verifier means OTP control alone now issues *some* session, which is precisely what §3.3's verifier exists to prevent. Confining it keeps the damage at nothing an attacker can use: the key bundle is ciphertext wrapped under a KEK derived from a recovery phrase they do not have, and a `recovery-reset` they attempt overwrites only the `pwd` rows while the `recovery` rows — the ones that still open the vault — are untouched by that endpoint (Phase 1 §6.4 step 5). Threat-model property 3 already anticipated this shape: the recovery-phrase holder "cannot establish a fresh server session on their own... without separately compromising the user's email/OTP path."

**Residual risk, stated plainly.** An attacker with mailbox control but no recovery phrase can still call `recovery-reset` and overwrite the `pwd` wraps, locking the legitimate user out of password unlock. It is a denial of service, not a disclosure: the user recovers with their phrase. Whether that warrants a stronger recovery proof is **Phase 5's call**, and it is the reason this is written down rather than left implicit. The server cannot verify that the phrase was actually used — it only ever sees the flag.

**Single `db.batch()`:**
```
UPDATE users SET password_verifier=?, verifier_salt=?, verifier_kdf_kind=?, verifier_kdf_params=?, updated_at=now
       WHERE id=?
UPDATE user_keys SET wrapped_priv_key=?, kek_salt=?, kek_kdf_kind=?, kek_kdf_params=?, updated_at=now
       WHERE user_id=? AND kek_kind='pwd'
UPDATE household_member_keys SET wrapped_master_key=?, kek_salt=?, kek_kdf_kind=?, kek_kdf_params=?, updated_at=now
       WHERE household_id=? AND user_id=? AND kek_kind='pwd'
```

Per Phase 1 §6.4 step 5: this is upsert-then-retire, not delete-then-insert. The `UPDATE`s overwrite the old rows in place — atomic at the SQLite level. **Recovery-kind rows are never touched** by this endpoint.

**Errors:** 401 UNAUTHORIZED, 400 INVALID_BLOB.

**Rate limits:** 1/h per user.

### 3.10 Existing endpoints

| Endpoint | v1 (legacy) | v2 (new) |
|----------|-------------|----------|
| `POST /auth/login` | Same shape — OTP request | Same shape — OTP request |
| `POST /auth/verify` | Returns session JWT (current behaviour) | **Deleted.** It issued a session on OTP alone, which is exactly what the verifier step exists to prevent. Nothing depends on it, so it goes rather than returning 410. |
| `POST /auth/logout` | Unchanged | Unchanged |
| `GET /auth/me` | Returns `{user}` | Returns `{user, household}` |
| `DELETE /auth/account` | Unchanged | See below — the household does **not** cascade. |
| `POST /auth/revoke-all-sessions` | Unchanged | Unchanged |
| `GET /auth/sessions` | Unchanged | Unchanged |
| `DELETE /auth/sessions/:id` | Unchanged | Unchanged |

### 3.11 `DELETE /auth/account` — what actually cascades

An earlier draft of the table above claimed the household is wiped by `ON DELETE CASCADE`. **It is not.** `households` has no foreign key to `users` — it cannot have one, because a household outlives any individual member. Deleting a user cascades `auth_codes`, `auth_pending`, `sessions`, `user_keys`, `household_members`, `household_member_keys` and sent `invites`, and leaves the `households` row, its `vaults`, its `sync_state` and its R2 objects orphaned.

The handler therefore tears the household down explicitly, and only when the departing user is its **last** member:

- **Sole member** — delete `sync_state` and `vaults` in one batch, delete the R2 objects, delete the `households` row, then delete the user.
- **A partner remains** — delete only the user. Their membership and wrapped keys cascade; the household, the vault and the partner's own key rows are untouched. This is the one case where Q7's "leaving is not supported" has a real exit, and it works because the remaining member's `pwd` and `recovery` wraps of the MasterKey are independent of the departing member's.

---

## 4. Invite + handoff endpoints

All require auth (session JWT). Endpoint role names from Phase 1 §7.2 are in parentheses.

### 4.1 `POST /v1/invites` (invite-issue)

A issues an invite for B.

**Request:**
```json
{ "recipientEmail": "...", "expiresInDays": 3 }
```

**Response (201):**
```json
{
  "invite": {
    "id": "...",
    "token": "<base64url>",        // server-generated; A's UI doesn't need it (server emails it directly)
    "recipientEmail": "...",
    "status": "open",
    "expiresAt": "...",
    "createdAt": "..."
  }
}
```

Side effect: Resend email sent to `recipientEmail` with the accept link `<APP_URL>/accept-invite?token=<token>`.

**Validation:**
- `recipientEmail` must not equal A's own email (400 BAD_REQUEST).
- A must not already have an open invite to the same email (409 INVITE_ALREADY_PENDING — A is shown the existing invite instead).
- A is the only member of their household (Q5 — v1 only allows one invite per household; the household becomes 2-member after acceptance and no further invites are accepted).
- The household must not already have 2 members (409 HOUSEHOLD_FULL).
- `expiresInDays` must be 1..7 (default 3 if omitted).

**Errors:** 400 BAD_REQUEST, 409 INVITE_ALREADY_PENDING, 409 HOUSEHOLD_FULL, 429 TOO_MANY_REQUESTS.

**Rate limits:** 5/h per sender, 20/h per IP. Resend has its own quotas; an outbound-email failure surfaces as 500 INTERNAL_ERROR (the invite row is rolled back).

### 4.2 `GET /v1/invites` — list invites

Returns invites where the authenticated user is either sender or recipient.

**Response (200):**
```json
{
  "sent":     [ { id, recipientEmail, status, expiresAt, createdAt } ],
  "received": [ { id, senderEmail, status, expiresAt, createdAt } ]
}
```

**Rate limits:** 30/min per user.

### 4.3 `POST /v1/invites/:token/accept` (invite-accept, path 3 — existing account)

B is already a v2 user. Clicked the link or pasted the token. Server attaches the invite to B's account (without yet creating a household membership, exactly as `signup-with-invite` does — B has no MasterKey for A's household yet).

**Request:** none (token comes from the URL path).

**Response (200):** same as `/signup-with-invite` — returns the `invite` block with `senderPubkey` for the safety-number fingerprint.

**Single `db.batch()`:**
```
UPDATE invites SET recipient_user_id=?, status='accepted_pending_handoff', updated_at=now
       WHERE token=? AND status='open' AND expires_at > now AND recipient_email=?
```

If the UPDATE affected 0 rows: server reads the invite to disambiguate and returns 410 INVITE_EXPIRED / 409 INVITE_ALREADY_ACCEPTED / 404 INVALID_INVITE. The disambiguation read is outside the batch but inside the same request — safe because the user is already authenticated.

**Validation:** `recipient_email` must match `users.email` (case-folded). 403 EMAIL_MISMATCH otherwise. This prevents B from accepting an invite addressed to a different email.

**Errors:** 404 INVALID_INVITE, 410 INVITE_EXPIRED, 409 INVITE_ALREADY_ACCEPTED, 403 EMAIL_MISMATCH, 409 HOUSEHOLD_FULL (B is already in a household — Q5).

### 4.4 `DELETE /v1/invites/:id` — revoke invite (sender only)

**Response (200):** `{ ok: true }`

Marks `invites.status='revoked'`. If the invite is already `accepted_pending_handoff`, the revoke also clears `recipient_user_id` — B's app shows "invite was withdrawn." If `completed`, the endpoint returns 409 INVITE_COMPLETED (you can't un-add a household member by revoking the invite; that's a different flow that doesn't exist in v1).

**Errors:** 404, 403 (not your invite), 409 INVITE_COMPLETED.

### 4.5 `GET /v1/handoffs/pending` (sweep-pending-handoffs)

A's client calls this on every login. Server returns invites in `accepted_pending_handoff` state where A is the sender.

**Response (200):**
```json
{
  "handoffs": [
    {
      "inviteId": "...",
      "inviteeUserId": "...",
      "inviteePubkey": "<base64url>",
      "inviteePubkeyFingerprint": "...",     // server-computed: SHA-256(pubkey)[0..7] hex, 16 chars; display format is Phase 4's call
      "recipientEmail": "...",
      "householdId": "..."                   // A's household
    }
  ]
}
```

The pubkey fingerprint is *also* shown so the client can render it without re-hashing — but A's client SHOULD recompute it before showing the safety number to the user (defence in depth against a Worker that serves a real pubkey with a mismatched fingerprint).

**Truncation is 8 bytes, not 16.** An earlier draft said `[0..15]`. The Phase 3 client shipped first and truncates to 8 (`PUBLIC_KEY_FINGERPRINT_LENGTH` in `src/lib/key-management.ts`), so a 16-byte server fingerprint would never match the client's recomputation and the defence-in-depth check above would fail on every handoff. The server matches the client. Phase 1 §8 fixes "SHA-256 of the 32-byte pubkey, truncated to a documented length" without ever documenting the length; it is 8 bytes, and the two implementations must change together or not at all.

**Errors:** 401 UNAUTHORIZED.

**Rate limits:** 60/min per user.

### 4.6 `GET /v1/handoffs/incoming` (sweep-poll)

B's client polls this while on the "waiting for partner" screen.

**Response (200):**
```json
{
  "handoffs": [
    {
      "householdId": "...",
      "senderUserId": "...",
      "senderEmail": "...",                       // for B's UI ("invite from <email>")
      "senderPubkey": "<base64url>",
      "senderPubkeyFingerprint": "...",
      "wrappedMasterKey": "<base64url>",          // envelope C, KIND=0x06
      "kekKind": "ecies",
      "createdAt": "..."
    }
  ]
}
```

Returns 0 or 1 entries in v1 (one household per user → one incoming handoff at most). The plural shape future-proofs for multi-household.

**Errors:** 401 UNAUTHORIZED.

**Rate limits:** 120/min per user. Phase 5 default cadence is 10–30s; this leaves headroom for tighter polling under user interaction (e.g. while the "waiting" screen is foregrounded).

### 4.7 `POST /v1/households/:householdId/members` (household-add-member)

A's client calls this after the safety-number out-of-band verification, holding `MasterKey_A` in memory.

**Request:**
```json
{
  "inviteId":          "...",
  "inviteeUserId":     "...",
  "wrappedMasterKey":  "<base64url>",        // envelope C
  "senderPubkey":      "<base64url>"         // A's pubkey, embedded in envelope C as SENDER_PUB. Server stores this denormalised.
}
```

**Response (200):** `{ ok: true, member: { userId, role: 'member', joinedAt: '...' } }`

**Validation:**
- A must be the sender of `inviteId`.
- `inviteId` must reference an `open` (paranoid) or `accepted_pending_handoff` invite for the same household; reject otherwise with 409 INVITE_INVALID_STATE.
- `inviteeUserId` must match `invites.recipient_user_id`.
- `senderPubkey` must equal `users.pubkey` for the authenticated user (defence against the server letting A wrap with a substituted key — although A's own UI is the primary check; this is server-side belt-and-braces).
- `wrappedMasterKey` is validated per §6 (envelope C, KIND=0x06, length ≥ 1+1+32+32+12+32 = 110 bytes).
- The household must not already have 2 members (409 HOUSEHOLD_FULL).
- The `household_members` row for `inviteeUserId` must not already exist (idempotent: if it does and the ecies row also exists, return 200 with the existing membership; otherwise 409 HOUSEHOLD_ROW_RACE).

**Single `db.batch()` (mirrors Phase 1 §7.2 step "household-add-member"):**
```
INSERT INTO household_members (id, household_id, user_id, role='member', joined_at=now)
INSERT INTO household_member_keys (household_id, user_id, kek_kind='ecies', wrapped_master_key,
                                   kek_salt=NULL, kek_kdf_kind=NULL, kek_kdf_params=NULL,
                                   sender_user_id, sender_pubkey, created_at=now)
UPDATE invites SET status='completed', updated_at=now WHERE id=? AND sender_user_id=?
```

Atomic: all three rows land or none do. The existing vault batch pattern (`worker/src/services/vault.ts:179-210`) demonstrates D1 batch semantics; it's exactly what this needs.

**Errors:** 404 INVITE_NOT_FOUND, 409 INVITE_INVALID_STATE, 409 HOUSEHOLD_FULL, 409 HOUSEHOLD_ROW_RACE, 400 INVALID_BLOB, 401, 403.

**Rate limits:** 5/h per sender. The endpoint is invoked at most once per invite.

### 4.8 `POST /v1/households/:householdId/members/:userId/rewrap` (rewrap-member-keys)

B's client, after receiving the ECIES wrap via `/handoffs/incoming`, unwrapping locally, and re-wrapping under its own KEK_pwd and KEK_rec.

**Request:**
```json
{
  "memberKeys": [
    { "kekKind": "pwd",      "wrappedMasterKey": "...", "kekSalt": "...", "kekKdfKind": 2, "kekKdfParams": "..." },
    { "kekKind": "recovery", "wrappedMasterKey": "...", "kekSalt": null,  "kekKdfKind": 3, "kekKdfParams": "" }
  ]
}
```

**Validation:**
- Authenticated user must be `userId` (B can only rewrap their own keys).
- Both `pwd` and `recovery` rows must be present. Partial rewrap is rejected with 400 BAD_REQUEST.
- An `ecies` row must currently exist for `(householdId, userId)`. If it doesn't, return 409 NO_PENDING_HANDOFF.
- Blob validation per §6.

**Single `db.batch()` (mirrors Phase 1 §7.2 step "rewrap-member-keys"):**
```
INSERT OR REPLACE INTO household_member_keys (..., kek_kind='pwd', ...)
INSERT OR REPLACE INTO household_member_keys (..., kek_kind='recovery', ...)
DELETE FROM household_member_keys WHERE household_id=? AND user_id=? AND kek_kind='ecies'
```

`INSERT OR REPLACE` (upsert) is fine here because no other process should be writing pwd/recovery rows for B during the handoff — B has the only client capable of producing those wraps. If two of B's devices race the rewrap (B logged in on phone and laptop simultaneously), `INSERT OR REPLACE` makes the last-write-wins behaviour explicit and atomic; both devices end up with valid rows since each is wrapping the same MasterKey under (presumably) the same KEK_pwd. The DELETE of the ecies row is idempotent — if both devices try, one wins, the other's DELETE is a no-op.

**Response (200):** `{ ok: true }`

**Errors:** 409 NO_PENDING_HANDOFF, 400 INVALID_BLOB, 403 NOT_OWN_KEYS, 401.

**Rate limits:** 3/h per user.

### 4.9 Re-issuing invites

Not a new endpoint — A re-issues by `DELETE /v1/invites/:id` then `POST /v1/invites`. Or the UI offers an explicit "extend expiry" affordance which is a `PATCH /v1/invites/:id`-style operation. **Deferred to Phase 7** (UI question). Phase 2 leaves the surface unprovided.

---

## 5. Vault endpoints (re-keyed user → household)

All existing routes in `worker/src/routes/vault.ts`. The change is purely the scoping key.

| Route | Before | After |
|-------|--------|-------|
| `GET /v1/vault` | metadata for `user_id` | metadata for `hid` (from JWT) |
| `GET /v1/vault/data` | current blob for `user_id` | current blob for `hid` |
| `PUT /v1/vault/data` | upload for `user_id` (X-Expected-Version, X-Idempotency-Key) | upload for `hid`; blob must lead with `VERSION=0x02` (§8) |
| `GET /v1/vault/history` | history for `user_id` | history for `hid` |
| `GET /v1/vault/data/:vaultId` | unchanged | unchanged (vaultId is already a primary key) |

**No new HTTP shapes**, just a key change: every route reads `hid` from the JWT where it previously read `sub`.

**Storage quota:** today's 50MB per-user limit becomes 50MB per-household. Note this is a real reduction for a couple — two people now share what one person used to have to themselves. Fine at current volumes, but it is a per-*household* limit now and the copy should say so. Easy refactor in `vaultService.getTotalStorage`.

**Existing concurrency / idempotency machinery is unchanged** — version conflict detection in `worker/src/services/vault.ts:163-210` continues to apply, just keyed differently.

---

## 6. Transaction boundaries

### 6.1 D1's atomic primitive

Confirmed by reading the existing code: D1 does not expose interactive `BEGIN/COMMIT`. The only way to make multiple statements atomic is `db.batch([...])`, which the v0.37 codebase already uses for `vaults` upload (`worker/src/services/vault.ts:179-196`) and account deletion (`worker/src/services/vault.ts:366-369`). D1's documented semantics: statements inside one `batch()` are executed inside a single implicit transaction; on any statement error the entire batch is rolled back; the response includes per-statement results so the Worker can inspect `.meta.changes` for optimistic-lock checks (as `putData` does).

Half-applied transactions inside a `batch()` are not possible. The remaining failure mode is "Worker request itself failed (timeout, network) after the batch succeeded server-side." This is handled with idempotency keys at the HTTP layer:

| Endpoint | Idempotency mechanism |
|----------|----------------------|
| `PUT /v1/vault/data` | `X-Idempotency-Key` header → `vaults.idempotency_key UNIQUE(user_id/household_id, idempotency_key)`. Existing pattern, kept. |
| `POST /v1/auth/signup`, `/signup-with-invite` | `users.pubkey` upsert with a `WHERE pubkey IS NULL` guard. Retry is safe: the second attempt sees the row already filled and 409s with the right state. |
| `POST /v1/households/.../members` | `household_member_keys` PRIMARY KEY `(household_id, user_id, kek_kind='ecies')` UNIQUE. Retry returns 200 if the same row exists. |
| `POST /v1/households/.../members/.../rewrap` | `INSERT OR REPLACE` on `household_member_keys` is naturally idempotent. |
| `POST /v1/invites` | Server enforces "one open invite per (sender, recipient) pair." Retry returns 409 INVITE_ALREADY_PENDING with the existing invite ID. |
| `POST /v1/auth/rewrap-keys` | `UPDATE` is naturally idempotent. |
| `POST /v1/auth/login-complete`, `/verify-otp` | `auth_pending.used_at IS NULL` guard makes retry safe (second attempt returns AUTH_PENDING_INVALID). |

### 6.2 Specific atomic batches (recap)

| Operation | Batch contents |
|-----------|---------------|
| Signup | `UPDATE auth_pending`, `UPDATE users`, `INSERT user_keys × 2`, `INSERT households`, `INSERT household_members`, `INSERT household_member_keys × 2`, `INSERT sessions` |
| Signup-with-invite | `UPDATE auth_pending`, `UPDATE users`, `INSERT user_keys × 2`, `UPDATE invites`, `INSERT sessions` |
| Household-add-member | `INSERT household_members`, `INSERT household_member_keys` (ecies), `UPDATE invites` |
| Rewrap-member-keys | `INSERT OR REPLACE household_member_keys` (pwd), `INSERT OR REPLACE household_member_keys` (recovery), `DELETE household_member_keys` (ecies) |
| Rewrap-keys (Argon2id upgrade) | `UPDATE user_keys`, `UPDATE household_member_keys`, `UPDATE users` (verifier) |
| Recovery-reset | `UPDATE users` (verifier), `UPDATE user_keys` (pwd), `UPDATE household_member_keys` (pwd) |

### 6.3 R2 + D1 coordination

The vault `PUT` and the migration `finalise` both write to R2 *and* D1. The existing pattern (`worker/src/services/vault.ts:174-230`) is:

1. Upload to R2 first.
2. Run the D1 `batch()`.
3. On D1 failure or optimistic-lock loss, delete the R2 object (best-effort) and rely on `cleanupOrphanedR2Objects` for the residual.

This stays unchanged. The vault `PUT` is now the only operation in the system that touches both R2 and D1.

### 6.4 Half-applied state detection

D1 `batch()` is all-or-nothing: a partially-applied state cannot exist server-side. The detection question reduces to: *did the client successfully observe the response?* If the network drops between the server's commit and the client's receipt of the 200, the client retries with the same idempotency mechanism (per §6.1 table) and gets the right answer.

The only operation that writes to both R2 and D1 is the vault `PUT`, which the existing idempotency key already covers.

---

## 7. Version enforcement

One rule, enforced in §8 alongside the rest of the structural validation:

> Every blob the server accepts must begin with `VERSION=0x02`. Any other leading byte is `400 INVALID_BLOB`. There is no state to consult and no legacy branch to take.

Phase 1 §4.4 covers the client side and the circumstances under which this would need to become more than one line.

---

## 8. Server-side validation rules for wrapped blobs

The server never decrypts wrapped blobs but **must** validate their structural shape before persisting. The validation is best-effort byte parsing — it cannot detect malicious-but-well-formed input (the AAD binding in §4 of Phase 1 catches those at decrypt time on the client) but it does catch obviously wrong shapes early, which prevents corrupt rows from latching in the DB.

### 8.1 Per-envelope structural checks

| Envelope | Server validation |
|----------|------------------|
| A (vault, KIND=0x01) | byte[0]=0x02, byte[1]=0x01, length ≥ 30 (1+1+12+16) |
| A (wrapped MasterKey, KIND=0x02) | byte[0]=0x02, byte[1]=0x02, length ≥ 30, length ≤ a sensible cap (e.g. 1024 bytes — MasterKey is 32 bytes plaintext, ciphertext ≤ 64-ish) |
| A (wrapped PrivKey, KIND=0x03) | byte[0]=0x02, byte[1]=0x03, length ≥ 30, length ≤ 1024 |
| C (handoff, KIND=0x06) | byte[0]=0x02, byte[1]=0x06, length ≥ 110 (1+1+32+32+12+32), length ≤ 1024 |

Envelope B (KIND=0x05, export file) doesn't transit through the server — it's a local-only artefact. The server never sees it.

### 8.2 Per-column consistency checks

Cross-column rules that SQLite `CHECK` can't express cleanly:

For `user_keys`:
- `kek_kind='pwd'` → `kek_salt` length = 16; **`kek_kdf_kind = 0x02` (Argon2id only)**; `kek_kdf_params` length = 9.
- `kek_kind='recovery'` → `kek_salt` NULL; `kek_kdf_kind=0x03`; `kek_kdf_params` length 0.

An earlier draft admitted `kek_kdf_kind ∈ {0x01, 0x02}` here. **0x01 is rejected.** Phase 1 §3.2 reserves it as *"was PBKDF2-SHA256. Never written; never read. Not reused."* Accepting it on a write would let a client downgrade its own key derivation to the algorithm this entire rewrite exists to leave behind — and since the client chooses what it sends, that is a downgrade the server would be volunteering for. Same rule for the `pwd` rows of `household_member_keys`.

For `household_member_keys`:
- Same rules as above for `'pwd'` and `'recovery'`.
- `kek_kind='ecies'` → `kek_salt` NULL; `kek_kdf_kind` NULL; `kek_kdf_params` NULL; `sender_user_id` NOT NULL; `sender_pubkey` length = 32 and equal to `users.pubkey WHERE id = sender_user_id`.

For `users`:
- `verifier_kdf_kind=0x02` (Argon2id only — PBKDF2 verifier is v1-legacy and not written by v2 endpoints).
- `verifier_kdf_params` length = 9.
- `pubkey` length = 32.
- `password_verifier` length = 32 (Argon2id output).

### 8.3 Failure response

All structural failures return **400 INVALID_BLOB** with a generic message. Do not leak which check failed (it's not security-critical, but the principle is "the server is a parser, not a debugger"). Phase 3 ensures the client never sends malformed blobs; INVALID_BLOB in production is either a client bug or a tampering attempt.

A malformed or wrong-version blob returns 400 INVALID_BLOB (§8). There is no retry that fixes it: the client is shipping bytes the server will never accept, so the code is deliberately not one that invites a retry loop.

---

## 9. Error model

Existing `AppError` envelope is unchanged:
```json
{ "error": "human-readable message", "code": "MACHINE_CODE", "data": { ... } }
```

### 9.1 New error codes

| Code | HTTP | Endpoint(s) | When |
|------|------|-------------|------|
| `AUTH_PENDING_INVALID` | 401 | `/login-complete`, `/signup*` | Bridge token unknown, expired, or used |
| `VERIFIER_MISMATCH` | 401 | `/login-complete`, `/rewrap-keys` | Argon2id verifier check failed |
| `SCHEMA_VERSION_MISMATCH` | 409 | `/verify-otp`, `/signup`, `/rewrap-keys` | User is on a different schema version than the request assumes |
| `INVALID_BLOB` | 400 | any wrapped-key write, `PUT /vault/data` | Structural validation failed |
| `ALREADY_SIGNED_UP` | 409 | `/signup`, `/signup-with-invite` | `users.pubkey` already set |
| `INVALID_INVITE` | 404 | `/invites/:token/accept`, `/signup-with-invite` | Token unknown |
| `INVITE_EXPIRED` | 410 | invite endpoints | `expires_at < now` |
| `INVITE_ALREADY_ACCEPTED` | 409 | invite endpoints | `status ≠ 'open'` |
| `INVITE_ALREADY_PENDING` | 409 | `POST /invites` | Sender already has an open invite to this email |
| `INVITE_INVALID_STATE` | 409 | `/households/.../members` | Invite is not in the right state for adding a member |
| `INVITE_COMPLETED` | 409 | `DELETE /invites/:id` | Cannot revoke a completed invite |
| `HOUSEHOLD_FULL` | 409 | `/invites`, `/households/.../members` | v1 caps at 2 members per household |
| `HOUSEHOLD_ROW_RACE` | 409 | `/households/.../members` | Membership exists but ecies row is stale; operator intervention |
| `EMAIL_MISMATCH` | 403 | `/invites/:token/accept` | Invite's `recipient_email` doesn't match authed user's email |
| `NO_PENDING_HANDOFF` | 409 | `/rewrap` | No ecies row to consume |
| `NOT_OWN_KEYS` | 403 | `/rewrap` | Trying to rewrap someone else's keys |
| `USE_V2_LOGIN` | 410 | `POST /auth/verify` | Legacy endpoint called by v2 user |

### 9.2 Auth-style endpoints stay enumeration-resistant

`/login`, `/verify-otp`, `/login-complete` continue to return generic messages on the email-or-code-wrong cases (existing `'Invalid email or code'`). The new codes above are only emitted when the user is already authenticated (or has just proven OTP control), so they don't leak whether an email exists.

---

## 10. Rate limits

Adopts the existing IP + per-user pattern (`worker/src/middleware/rate-limit.ts`).

| Endpoint | IP limit | Per-user limit |
|----------|---------|----------------|
| `POST /auth/login` | 5 / min | 3 / 15 min per email (existing) |
| `POST /auth/verify-otp` | 30 / min | 10 / 15 min per user |
| `POST /auth/login-complete` | 30 / min | 10 / 15 min per user |
| `POST /auth/signup` | 5 / h | 5 / h per user |
| `POST /auth/signup-with-invite` | 5 / h | 5 / h per user |
| `GET  /auth/key-bundle` | 60 / min | 30 / min per user |
| `POST /auth/rewrap-keys` | 5 / h | 1 / h per user |
| `POST /auth/recovery-reset` | 5 / h | 1 / h per user |
| `POST /invites` | 20 / h | 5 / h per user |
| `GET  /invites` | 60 / min | 30 / min per user |
| `POST /invites/:token/accept` | 10 / h | 3 / h per user |
| `DELETE /invites/:id` | 30 / min | 10 / h per user |
| `GET  /handoffs/pending` | 60 / min | 60 / min per user |
| `GET  /handoffs/incoming` | 120 / min | 120 / min per user |
| `POST /households/:hid/members` | 10 / h | 5 / h per user |
| `POST /households/:hid/members/:uid/rewrap` | 10 / h | 3 / h per user |
| `PUT  /vault/data` | unchanged | unchanged |
| `GET  /vault/*` | unchanged | unchanged |

All limits degrade open on D1 failure (existing pattern).

---

## 11. Open issues carried to later phases

### Carried to Phase 3 (client crypto)
- Wire encoding for binary fields in JSON: base64url is assumed throughout this doc but Phase 3 may prefer raw base64 or hex for cosmetic reasons. The server should accept whichever Phase 3 picks consistently.
- Argon2id WASM library choice (still open from Phase 1 §8).

### Carried to Phase 5 (login / unlock / logout UX)
- Sweep-poll cadence (Phase 1 §8 deferred; Phase 2 confirms the endpoint is short-poll, so cadence is a pure UX call).
- Local-unlock prompt copy and timing — when to surface "password expired" vs "JWT expired."
- The recovery-flow `via=recovery` claim wiring on `/login-complete`.
- Auto-rotation of JWT when the user is mid-unlock (sequencing).

### Carried to Phase 8 (household UI)
- **Two-writer vault conflicts.** `X-Expected-Version` already rejects a stale push, but with two people on one household vault a rejection means the other person's work is on the server and yours is not. What the losing client does — auto-merge, prompt, or refuse — is a Phase 8 decision and the first genuinely new failure mode couples introduce.

### Carried to Phase 7 (invite UI)
- Email template copy (Resend).
- Three-path landing routing on `/accept-invite?token=...` — distinguishes logged-in vs logged-out vs no-account.
- Safety-number display format (Phase 1 §8 — decimal groups vs base32 vs emoji-grid). Server returns raw SHA-256 truncation; client formats.
- Invite re-issue affordance (Phase 2 leaves the endpoint unprovided; revisit when the UI surfaces the need).
- "I trust this fingerprint" UI on both A and B sides; defaults and persistence.

### Deferred to post-v1 (out of Phase 2 scope)
- Leave-a-household: `DELETE /v1/households/:hid/members/:uid`. Requires MasterKey rotation + re-wrapping under the remaining member's KEKs + a new vault version encrypted under the new MasterKey. Q7. Not designed.
- Multi-household (Q5 relaxation): drops `UNIQUE(household_members.user_id)`, adds household-switcher JWT claim.
- Password change: not signup-time; an in-product password-rotation flow. Touches verifier + KEK_pwd-wrapped rows; similar shape to `/rewrap-keys` but with a new password derivation.
- Recovery-phrase rotation (Phase 1 §6.5).
- KEK rotation on suspected device compromise (Phase 1 §1.7).

---

## 12. What this doc deliberately doesn't say

- No SQL files. The schema sketches in §1 are illustrative; the `.sql` migration files are Phase 2's *implementation* output, not part of this design.
- No TypeScript signatures, no Hono route bodies, no test plans.
- No client-side wire encoding decisions beyond "base64url is the default."
- No specific Argon2id parameters — Phase 1 §3.4 owns those.
- No HTTP-level retry policy beyond noting which endpoints support idempotency keys.
- No UI copy, no error message localisation, no email template content.

If any later phase finds it needs a different endpoint shape, table column, error code, or transaction boundary, the change starts back here.

---

## 13. Where this doc was wrong

Nine corrections, found while building it. Each is fixed inline above; this is the index. They are recorded rather than quietly patched because the doc is the source of truth for Phases 4–8, and three of them would have produced a working-looking system with a real hole in it.

**Wrong about D1**

1. **§3.4, §3.5, §6.1 — "if the guarded UPDATE affected 0 rows, the batch rolls back."** It does not. Zero changes is a *success*; only a statement error rolls a batch back. Fixed by spending the bridge token in a standalone guarded `UPDATE ... RETURNING`, and by leaning on primary keys and unique indexes for in-batch idempotency instead of `WHERE` clauses. **This is the one that mattered** — taken literally it would have let a signup apply against an already-spent token.

2. **§3.5 — invite claim inside the signup batch.** Same root cause, and reordering it needed a decision the doc had not made: account first, claim second, so that a failure leaves a usable account rather than an unrepairable stranded invite.

**Wrong about Phase 1**

3. **§8.2 — `kek_kdf_kind ∈ {0x01, 0x02}` for password rows.** Phase 1 §3.2 reserves 0x01 as never-written. Accepting it would have let a client volunteer its own downgrade to PBKDF2. Argon2id only.

**Wrong about the shipped client**

4. **§4.5 — fingerprint truncated to 16 bytes.** The Phase 3 client shipped 8. A mismatch here fails the client's recomputation on every handoff, which is indistinguishable from a server substituting a pubkey — the exact attack the check exists to catch. Server now matches client; `crypto-design.md` §8 records the length it never stated.

**Wrong about SQLite**

5. **§3.10 — "account deletion cascades through `households`."** `households` has no foreign key to `users` and cannot have one. Without the explicit teardown now in §3.11, every deleted account would have orphaned a household row, its vault versions and its R2 objects.

**Wrong about the invitee**

6. **§2.2 — "`hid` is set at signup and never changes."** True for the member who creates the household, false for the one who joins it. Scoping from the claim would have locked a new partner out of the vault they had just been given access to. Scope now resolves from `household_members` per request; the claim is informational.

**Silent gaps**

7. **§3.9 — no way to obtain the `recovery=true` session it requires.** A user in recovery cannot produce a verifier by definition. Resolved by `via=recovery` on `/login-complete`, with the resulting session confined to two endpoints. Carries a documented residual DoS risk for **Phase 5**.

8. **§3.6 does not exist** — the numbering jumps 3.5 → 3.7, and the missing section is the signup-time invite sweep (crypto-design §7.4 path 2). The sweep is implemented: `/auth/signup` returns any open invites matching the new user's email as `pendingInvites` so the client can show a banner.

   **But path 2 dead-ends under Q5, and the design never noticed.** A user who signs up from the landing page gets their own household in the same call. `UNIQUE(household_members.user_id)` then means they can never accept the invite — `POST /invites/:token/accept` returns 409 HOUSEHOLD_FULL. The banner is real; the button behind it cannot work. Three ways out, all **Phase 7's call**: detect the pending invite *before* creating a household and route the user to `signup-with-invite`; support discarding a brand-new empty household on acceptance; or drop path 2 and rely on paths 1 and 3. None is a Phase 2 change, and nothing else depends on it.

**Cosmetic**

9. **§1.4 — `idx_sync_state_household_id UNIQUE`.** Redundant: `household_id` is already `sync_state`'s primary key. Not created.

### Also worth knowing

- **The `ecies` handoff row is never resurrected.** `POST /households/:id/members` checks for an existing membership *before* validating invite state, so a replayed request is a 200 no-op rather than a 409. If the membership exists but the `ecies` row is gone, the invitee has already rewrapped and the request returns 409 HOUSEHOLD_ROW_RACE rather than re-creating a transient row they have finished with.
- **Invite emails are rolled back on send failure.** An invite nobody received would otherwise occupy the one-open-invite-per-pair slot while being unusable.
- **Storage quota is per household**, so a couple shares what one person used to have alone. Phase 8's copy needs to say "household".
