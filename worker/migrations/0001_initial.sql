-- SafelySpend v2 schema. Collapses the four v1 migrations into one
-- household-keyed schema. See docs/auth-rewrite/02_backend_schema_endpoints_design.md
-- section 1, and docs/crypto-design.md section 2 for the key hierarchy this stores.
--
-- There is no v1 read path and no migration: production held zero vaults and zero
-- real users when this landed, so the old tables were dropped rather than migrated.

-- Accounts. Key columns stay nullable because /auth/login find-or-creates the row
-- before signup has supplied any key material. A row with pubkey IS NULL is inert:
-- no pubkey means no user_keys, which means no household, which means no vault.
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  password_verifier   BLOB,
  verifier_salt       BLOB,
  verifier_kdf_kind   INTEGER,
  verifier_kdf_params BLOB,
  pubkey              BLOB,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_codes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_codes_user_id    ON auth_codes(user_id);
CREATE INDEX idx_auth_codes_created_at ON auth_codes(created_at);

-- Single-use bearer credential bridging /auth/verify-otp to /auth/login-complete
-- and /auth/signup. Deliberately not a JWT: reusing the session JWT would mean
-- every handler had to remember to check a purpose claim.
CREATE TABLE auth_pending (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_pending_user_id    ON auth_pending(user_id);
CREATE INDEX idx_auth_pending_expires_at ON auth_pending(expires_at);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Ownership is implicit in household_members.role, so there is no owner_id here.
CREATE TABLE households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE household_members (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Q5: one household per user in v1. Multi-household work drops this index.
CREATE UNIQUE INDEX idx_household_members_user      ON household_members(user_id);
CREATE UNIQUE INDEX idx_household_members_user_hh   ON household_members(user_id, household_id);
CREATE        INDEX idx_household_members_household ON household_members(household_id);

-- Wrapped X25519 private key, one row per way the user can unwrap it.
-- Salt and KDF rules (crypto-design section 6.3), enforced in the application layer
-- because the cross-column dependency is beyond a SQLite CHECK:
--   kek_kind='pwd'      -> kek_salt 16 bytes, kek_kdf_kind 0x02, params 9 bytes
--   kek_kind='recovery' -> kek_salt NULL, kek_kdf_kind 0x03, params zero-length
-- A NULL kek_salt on a recovery row is correct, not corruption.
CREATE TABLE user_keys (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kek_kind         TEXT NOT NULL CHECK (kek_kind IN ('pwd', 'recovery')),
  wrapped_priv_key BLOB NOT NULL,
  kek_salt         BLOB,
  kek_kdf_kind     INTEGER,
  kek_kdf_params   BLOB,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kek_kind)
);

-- Wrapped household MasterKey, one row per way this member can unwrap it.
-- The 'ecies' row is transient: written by the inviting member's handoff wrap and
-- deleted once the invitee rewraps under their own KEKs. It is the only kind the
-- server deletes on a normal flow.
CREATE TABLE household_member_keys (
  household_id       TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kek_kind           TEXT NOT NULL CHECK (kek_kind IN ('pwd', 'recovery', 'ecies')),
  wrapped_master_key BLOB NOT NULL,
  kek_salt           BLOB,
  kek_kdf_kind       INTEGER,
  kek_kdf_params     BLOB,
  sender_user_id     TEXT REFERENCES users(id),
  sender_pubkey      BLOB,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (household_id, user_id, kek_kind)
);
CREATE INDEX idx_member_keys_user ON household_member_keys(user_id);

CREATE TABLE invites (
  id                TEXT PRIMARY KEY,
  token             TEXT NOT NULL UNIQUE,
  sender_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id      TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipient_email   TEXT NOT NULL,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- Spelled out because SQLite cannot extend a CHECK in place: adding a value later
  -- means rebuilding the table, so the set is settled while the database is empty.
  status            TEXT NOT NULL CHECK (status IN (
                      'open',
                      'accepted_pending_handoff',
                      'completed',
                      'expired',
                      'revoked',
                      'declined'
                    )),
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_invites_recipient_email ON invites(recipient_email);
CREATE INDEX idx_invites_recipient_user  ON invites(recipient_user_id);
CREATE INDEX idx_invites_sender_user     ON invites(sender_user_id);
CREATE INDEX idx_invites_expires_at      ON invites(expires_at);
CREATE INDEX idx_invites_status          ON invites(status);

-- Vaults are household-keyed. user_id is gone rather than left vestigial.
-- The R2 key is <household_id>/<vault_id>.
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
CREATE        INDEX idx_vaults_household             ON vaults(household_id);
CREATE UNIQUE INDEX idx_vaults_household_version     ON vaults(household_id, version);
CREATE UNIQUE INDEX idx_vaults_household_idempotency ON vaults(household_id, idempotency_key);

CREATE TABLE sync_state (
  household_id     TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  current_version  INTEGER NOT NULL DEFAULT 0,
  current_vault_id TEXT REFERENCES vaults(id),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
