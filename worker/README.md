# Budget API Worker

Cloudflare Worker backend for SafelySpend. Handles authentication (email code plus a
password verifier), household membership and invites, storage of wrapped key material,
and encrypted vault storage (D1 metadata + R2 blobs).

The server never sees a password, a key, or a byte of plaintext budget data. It stores
locked boxes and hands them back; the unlocking always happens in the browser. What that
means in detail is in `docs/crypto-design.md`; the schema and endpoint contracts are in
`docs/auth-rewrite/02_backend_schema_endpoints_design.md`.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers, D1, and R2 enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler` or use `npx wrangler`)
- A [Resend](https://resend.com/) account for sending auth code emails

## Local Development

```bash
npm install
npm run db:migrate:local   # apply D1 migrations to local SQLite
npm run dev                # start wrangler dev server
```

The dev server uses local D1 (SQLite) and R2 (filesystem) emulation — no Cloudflare account needed for local work.

## Running Tests

```bash
npm run test        # watch mode
npm run test:run    # single run
npm run typecheck   # tsc --noEmit
```

Tests use `@cloudflare/vitest-pool-workers` to run inside workerd with real D1/R2 bindings. No external services or secrets are required — test secrets are configured in `vitest.config.ts`.

Run `npm run typecheck` as well as the tests. The worker has its own `tsconfig.json` and
is not covered by the repo root's `npm run build`, so nothing else type-checks it.

## Deployment

### 1. Authenticate Wrangler

```bash
wrangler login
```

### 2. Create the D1 Database

```bash
wrangler d1 create budget-db
```

This outputs a `database_id`. Update `wrangler.toml` with the real ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "budget-db"
database_id = "<your-database-id>"   # replace "placeholder"
```

### 3. Create the R2 Bucket

```bash
wrangler r2 bucket create budget-vaults
```

No config change needed — the bucket name `budget-vaults` in `wrangler.toml` already matches.

### 4. Run Database Migrations

```bash
npm run db:migrate:remote
```

This applies all migrations in `migrations/` to the remote D1 database. Run this again after adding new migration files.

### 5. Set Secrets

Two secrets must be set before the worker will function. These are **not** stored in `wrangler.toml` — they are encrypted at rest by Cloudflare.

```bash
wrangler secret put JWT_SECRET
# Paste a random string (32+ characters recommended). Used to sign session JWTs.
# Generate one with: openssl rand -base64 32

wrangler secret put RESEND_API_KEY
# Paste your Resend API key (starts with "re_"). Used to send login code emails.
```

To verify secrets are set:

```bash
wrangler secret list
```

### 6. Deploy

```bash
npm run deploy
```

The worker URL will be printed (e.g. `https://budget-api.<your-subdomain>.workers.dev`). Set `APP_URL` in `wrangler.toml` if you use a custom domain.

### 7. Custom Domain (Optional)

To serve the API from a custom domain, add a route in `wrangler.toml`:

```toml
routes = [
  { pattern = "api.safelyspend.app", custom_domain = true }
]
```

Then redeploy with `npm run deploy`.

## Environment Variables

| Variable | Source | Description |
|---|---|---|
| `DB` | D1 binding | SQLite database for users, sessions, auth codes, vault metadata |
| `VAULT_BUCKET` | R2 binding | Blob storage for encrypted vault data |
| `JWT_SECRET` | `wrangler secret` | Signs/verifies session JWTs |
| `JWT_SECRET_PREVIOUS` | `wrangler secret` | (Optional) Previous JWT secret, used during key rotation |
| `RESEND_API_KEY` | `wrangler secret` | Resend API key for sending auth code emails |
| `ENVIRONMENT` | `wrangler.toml` [vars] | `"production"` or `"development"` |
| `FROM_EMAIL` | `wrangler.toml` [vars] | Sender address for auth code emails |
| `APP_URL` | `wrangler.toml` [vars] | Frontend URL (used in CORS and email links) |

## Database Migrations

D1 migrations live in `migrations/` as numbered SQL files. Wrangler applies them in filename order and tracks which have run in an internal `d1_migrations` table — each migration only runs once.

### Current migrations

| File | Description |
|------|-------------|
| `0001_initial.sql` | The whole schema: accounts and key material, households and membership, wrapped-key storage, invites, household-keyed vaults and sync state, sessions, rate limits |

There is one migration by design. The four v1 migrations were collapsed into it during the
auth rewrite — see "Resetting the database" below for why, and for what that means if you
are holding a database that was created before the rewrite.

### Applying migrations

```bash
# Local development (SQLite emulation)
npm run db:migrate:local

# Remote production database
npm run db:migrate:remote
```

Wrangler automatically detects which migrations are new and applies only those. Safe to run repeatedly.

### Writing new migrations

1. Create a new file in `migrations/` with the next sequence number:

   ```
   migrations/0005_description.sql
   ```

2. Write forward-only SQL. D1 migrations have no "down" — use only additive changes:
   - `CREATE TABLE` / `CREATE INDEX` — always safe
   - `ALTER TABLE ... ADD COLUMN` — safe, column is nullable or has a default
   - `DROP TABLE` / `DROP INDEX` — safe if nothing references it
   - Renaming or removing columns — **not safe**, SQLite doesn't support `ALTER TABLE ... DROP COLUMN` reliably

3. Test locally first:

   ```bash
   npm run db:migrate:local
   npm run test:run
   ```

4. Apply to production:

   ```bash
   npm run db:migrate:remote
   ```

### Resetting the database

`0001_initial.sql` was rewritten in place during the auth rewrite, and `0002`–`0004`
were deleted. That is not an ordinary migration: it changes a file Wrangler has already
recorded as applied.

Wrangler tracks applied migrations by **filename** in a `d1_migrations` table. A database
that already ran the old `0001` will not re-run the new one, and will not notice the
contents changed — so a pre-rewrite database ends up with v1 tables, a ledger claiming
four migrations ran, and a worker that queries columns which do not exist.

The fix is not a migration. It is a reset, and it destroys everything in D1 and R2.

**This was safe to do exactly once**, when production held zero vaults and zero real
users (verified 2026-09-13: R2 `budget-vaults` empty, D1 `vaults` and `sync_state` both
empty). There is no format-v1 read path anywhere in the client, so there was nothing to
migrate and nothing to preserve. **If the database now holds real data, none of the
below applies** — write a forward migration instead.

Check before doing anything:

```bash
wrangler d1 execute budget-db --remote --command="SELECT COUNT(*) AS vaults FROM vaults"
wrangler r2 object list budget-vaults
```

If either returns anything, stop.

Local first — the local database is disposable, so this is just a delete:

```bash
rm -rf .wrangler/state/v3/d1 .wrangler/state/v3/r2
npm run db:migrate:local
npm run test:run
```

Remote, once local is green. Drop the v1 tables, clear the ledger, then re-apply:

```bash
# 1. Drop every v1 table. Order matters: children before parents.
wrangler d1 execute budget-db --remote --command="
  DROP TABLE IF EXISTS sync_state;
  DROP TABLE IF EXISTS vaults;
  DROP TABLE IF EXISTS auth_codes;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS rate_limits;
  DROP TABLE IF EXISTS users;
"

# 2. Clear the applied-migrations ledger so the rewritten 0001 runs again.
wrangler d1 execute budget-db --remote --command="DELETE FROM d1_migrations"

# 3. Apply the new schema.
npm run db:migrate:remote

# 4. Confirm it landed.
wrangler d1 execute budget-db --remote --command="
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
"
```

R2 objects are keyed `{userId}/{vaultId}` under the old layout and
`{householdId}/{vaultId}` under the new one. Nothing reads the old prefix, so any
leftovers are orphans — the nightly cron (`cleanupOrphanedR2Objects`) removes objects
with no matching `vaults` row, which after the reset is all of them. To clear them
immediately instead:

```bash
wrangler r2 object list budget-vaults          # confirm what is there
wrangler r2 object delete budget-vaults/<key>  # one key at a time
```

Finally, redeploy so the worker and the schema match:

```bash
npm run deploy
```

### Rollback

D1 migrations are forward-only — there are no down migrations. If a migration causes issues:

1. **Additive migrations** (new tables, columns, indexes) — write a follow-up migration to reverse the change (e.g. `DROP INDEX`, `DROP TABLE`)

2. **Destructive migrations** (data loss, broken schema) — restore from D1 Time Travel:

   ```bash
   # Find a bookmark before the migration
   wrangler d1 time-travel info budget-db

   # Restore to that point
   wrangler d1 time-travel restore budget-db --timestamp=2026-02-15T00:00:00Z
   ```

   Then re-apply only the migrations you want: `npm run db:migrate:remote`

3. **Always test locally** before applying to production. `npm run db:migrate:local && npm run test:run` catches most issues.

## Rotating the JWT Secret

The worker supports zero-downtime JWT secret rotation. Without this, changing `JWT_SECRET` would immediately invalidate all active sessions and force every user to re-login.

### Steps

1. **Set the old secret as the fallback:**

   ```bash
   wrangler secret put JWT_SECRET_PREVIOUS
   # Paste the CURRENT value of JWT_SECRET
   ```

2. **Set the new secret:**

   ```bash
   wrangler secret put JWT_SECRET
   # Paste a new random string: openssl rand -base64 32
   ```

3. **Deploy** (if not already deployed with the dual-key code):

   ```bash
   npm run deploy
   ```

4. **Wait 7 days** for all old JWTs to expire naturally. During this window:
   - New JWTs (login, verify, renewal) are signed with the new secret
   - Existing JWTs signed with the old secret still verify via the fallback
   - Users are passively migrated to the new secret when their JWT renews (after ~3.5 days)

5. **Remove the fallback:**

   ```bash
   wrangler secret delete JWT_SECRET_PREVIOUS
   ```

### How it works

The auth middleware tries to verify each JWT with `JWT_SECRET` first. If verification fails and `JWT_SECRET_PREVIOUS` is set, it retries with the previous secret. All new JWTs are always signed with the current `JWT_SECRET`, so users gradually migrate as their tokens renew.

## API Endpoints

All endpoints return JSON. Authenticated routes require a `__budget_session` cookie (set automatically by the login flow).

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Returns `{ ok: true }` |

Logging in takes three calls, not one. `/auth/login` sends the code, `/auth/verify-otp`
exchanges the code for a short-lived bridge token plus the parameters needed to derive a
password verifier, and `/auth/login-complete` checks that verifier and issues the
session. The split exists so that proving control of a mailbox is never on its own
enough to obtain a session, and so the verifier salt is only handed out after the code
has been passed.

### Auth (`/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Send a 6-digit login code to an email address |
| POST | `/auth/verify-otp` | No | Exchange a code for a bridge token and the verifier parameters |
| POST | `/auth/login-complete` | No | Check the password verifier, issue a session and the key bundle |
| POST | `/auth/signup` | No | Create a cloud-sync account and its household (needs a bridge token) |
| POST | `/auth/signup-with-invite` | No | Create an account that joins someone else's household |
| GET | `/auth/key-bundle` | Yes | Fetch the wrapped keys needed for a local unlock |
| POST | `/auth/rewrap-keys` | Yes | Replace the password-wrapped rows at stronger Argon2id parameters |
| POST | `/auth/recovery-reset` | Yes | Set a new password after unlocking with the recovery phrase |
| POST | `/auth/logout` | Yes | Delete the current session |
| GET | `/auth/me` | Yes | Return the current user and their household |
| DELETE | `/auth/account` | Yes | Delete the account, and the household if nobody else is left in it |
| GET | `/auth/sessions` | Yes | List active sessions |
| DELETE | `/auth/sessions/:id` | Yes | Revoke a specific session |
| POST | `/auth/revoke-all-sessions` | Yes | Revoke all sessions except the current one |

### Invites and handoffs (`/v1/invites`, `/v1/handoffs`, `/v1/households`)

Adding a partner is a two-sided exchange, and the two people are never required to be
online at the same time. The existing member issues an invite; the recipient signs up and
waits; the existing member wraps the household key for the recipient's public key on
their next login; the recipient unwraps it and re-wraps it under their own password and
recovery phrase. Both sides compare a fingerprint out of band before trusting the other's
public key.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/invites` | Yes | Issue an invite and email it |
| GET | `/invites` | Yes | List invites sent and received |
| POST | `/invites/:token/accept` | Yes | Accept an invite as an existing account |
| DELETE | `/invites/:id` | Yes | Revoke an invite you sent |
| GET | `/handoffs/pending` | Yes | Invitees waiting for you to wrap the household key for them |
| GET | `/handoffs/incoming` | Yes | A household key wrapped for you, waiting to be re-wrapped |
| POST | `/households/:id/members` | Yes | Complete the handoff from the sender's side |
| POST | `/households/:id/members/:userId/rewrap` | Yes | Complete it from the recipient's side |

### Vault (`/v1/vault`)

All vault routes require authentication **and** membership of a household — the vault is
shared by the household, not owned by a user. A signed-in user with no household yet
gets `409 NO_HOUSEHOLD`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vault` | Yes | Get vault metadata (version, size, checksum) |
| GET | `/vault/data` | Yes | Download the current encrypted blob |
| PUT | `/vault/data` | Yes | Upload an encrypted blob (requires `X-Expected-Version` header) |
| GET | `/vault/history` | Yes | List all vault versions |
| GET | `/vault/data/:vaultId` | Yes | Download a specific historical version |

`X-Expected-Version` now guards against two people rather than two tabs. A rejected push
means your partner's work is on the server and yours is not, so the client cannot simply
discard and retry.

## Disaster Recovery

### Data layout

D1 and R2 are complementary — neither is sufficient on its own.

| Store | Contains | Recoverable without it? |
|-------|----------|------------------------|
| **D1** | Users, households and membership, wrapped key material, sessions, auth codes, invites, vault metadata (versions, checksums, R2 key paths), sync state | No — R2 objects are opaque blobs; without D1 you can't identify which version is current, who it belongs to, or which wrapped key opens it |
| **R2** | Encrypted vault data (the actual user data blobs) | No — D1 only stores metadata; the encrypted payload lives solely in R2 |

R2 keys follow the pattern `{householdId}/{vaultId}`. D1's `vaults.r2_key` column is the sole mapping between metadata and blobs.

D1 also holds the wrapped key material — `users.pubkey` and the verifier columns, `user_keys`, `household_member_keys`. Losing it is worse than losing vault metadata: the R2 blobs stay encrypted under a MasterKey whose every wrapped copy lived in D1, so without those rows the ciphertext is unrecoverable even with the right password. The exception is a user who still holds their recovery phrase *and* a local copy of the data — the phrase only unwraps rows that still exist.

### D1 backups (Time Travel)

D1 supports [point-in-time recovery](https://developers.cloudflare.com/d1/reference/time-travel/) (30 days on Workers Paid plan). Verify it's active:

```bash
# Check database status — Time Travel is enabled by default on paid plans
wrangler d1 info budget-db
```

To restore D1 to a point in time:

```bash
# List available bookmarks
wrangler d1 time-travel info budget-db

# Restore to a specific timestamp
wrangler d1 time-travel restore budget-db --timestamp=2026-02-15T00:00:00Z
```

### R2 backups

R2 has no built-in point-in-time recovery. The encrypted vault blobs are the only copy of user data on the server. However, the primary copy of user data lives in each user's browser (IndexedDB) — the cloud vault is a backup, not the source of truth.

Mitigations:
- The app keeps up to 10 historical versions per user in R2, so accidental overwrites can be recovered from the version history
- If R2 data is lost, users can re-upload from their local browser data via the sync UI
- For additional protection, you can periodically copy R2 objects to a separate bucket or external storage using `wrangler r2 object get`

### Recovery procedures

**D1 lost, R2 intact:**

1. Restore D1 from Time Travel to the most recent bookmark before the incident
2. Verify with: `wrangler d1 execute budget-db --remote --command="SELECT COUNT(*) FROM users"`
3. Redeploy the worker: `npm run deploy`
4. Users can log in and access their vaults immediately — R2 data is intact

If Time Travel is unavailable, D1 data is unrecoverable. R2 objects can be listed by user prefix (`wrangler r2 object list budget-vaults --prefix={userId}/`) but there's no way to reconstruct version ordering, user accounts, or sessions.

**R2 lost, D1 intact:**

1. D1 metadata remains valid but all vault downloads will return 404
2. Users will see sync errors when they try to download
3. Each user's local device still has their data in IndexedDB — they can re-upload via the sync UI
4. No server-side recovery is possible; R2 is the sole copy of encrypted vault data

**Both lost:**

1. All server-side data is gone
2. Users still have local data in their browser's IndexedDB
3. Recreate infrastructure from scratch (D1 database, R2 bucket, migrations, secrets)
4. Users re-register and re-upload from their local data

### Recommendations

- **Verify D1 Time Travel is active** on a Workers Paid plan (free plan has no Time Travel)
- **Monitor R2 object count** — a sudden drop indicates accidental deletion
- **Periodically export D1** as an additional backup: `wrangler d1 export budget-db --remote --output=backup.sql`

## Observability

### Backend (Workers)

Already configured — `[observability]` in `wrangler.toml` enables request traces, error rates, latency, and CPU time in the Cloudflare dashboard at 100% sampling. All application logs are structured JSON with request IDs for tracing. Use `wrangler tail` to stream logs in real time.

### Frontend

Currently no error reporting to an external service. The app has React error boundaries (catch crashes and show fallback UI) and an in-memory debug logger, but errors are only visible client-side.

When you have enough users to justify it, add [Sentry](https://sentry.io) (free tier: 5K errors/month):

1. `npm install @sentry/react`
2. Initialise in `src/main.tsx` with your Sentry DSN
3. Wrap the router with `Sentry.wrapCreateBrowserRouterV7`
4. Sentry auto-captures unhandled exceptions, promise rejections, and React error boundaries

This is a ~15 minute job. Until then, you'll hear about frontend errors when users report them.

## Project Structure

```
worker/
├── migrations/          # D1 SQL migrations (applied in filename order)
├── src/
│   ├── index.ts         # Hono app entry point
│   ├── types.ts         # Env, User, Household, JWT types
│   ├── lib/             # crypto, bytes, wrapped-key validation, session, errors, IDs
│   ├── middleware/      # auth (plus the recovery-session and household guards), rate-limit
│   ├── routes/          # auth, invites, handoffs, households, vault handlers
│   ├── services/        # auth, email, users, households, invites, key-bundle, vault
│   └── __tests__/       # integration + unit tests
├── vitest.config.ts
├── wrangler.toml
└── tsconfig.json
```
