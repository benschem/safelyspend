# Budget API Worker

Cloudflare Worker backend for SafelySpend. Handles authentication (email code login) and encrypted vault storage (D1 metadata + R2 blobs).

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
npm run test       # watch mode
npm run test:run   # single run
```

Tests use `@cloudflare/vitest-pool-workers` to run inside workerd with real D1/R2 bindings. No external services or secrets are required — test secrets are configured in `vitest.config.ts`.

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

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Send a 6-digit login code to an email address |
| POST | `/auth/verify` | No | Verify a login code, returns a session cookie |
| POST | `/auth/logout` | Yes | Delete the current session |
| GET | `/auth/me` | Yes | Return the current user |
| DELETE | `/auth/account` | Yes | Delete the user account and all associated data |
| GET | `/auth/sessions` | Yes | List active sessions |
| DELETE | `/auth/sessions/:id` | Yes | Revoke a specific session |
| POST | `/auth/revoke-all-sessions` | Yes | Revoke all sessions except the current one |

### Vault (`/vault`)

All vault routes require authentication.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vault` | Yes | Get vault metadata (version, size, checksum) |
| GET | `/vault/data` | Yes | Download the current encrypted blob |
| PUT | `/vault/data` | Yes | Upload an encrypted blob (requires `X-Expected-Version` header) |
| GET | `/vault/history` | Yes | List all vault versions |
| GET | `/vault/data/:vaultId` | Yes | Download a specific historical version |

## Project Structure

```
worker/
├── migrations/          # D1 SQL migrations (applied in filename order)
├── src/
│   ├── index.ts         # Hono app entry point
│   ├── types.ts         # Env, User, JWT types
│   ├── lib/             # crypto, error helpers, ID generation
│   ├── middleware/       # auth, rate-limit
│   ├── routes/          # auth, vault route handlers
│   ├── services/        # auth, email, users, vault business logic
│   └── __tests__/       # integration + unit tests
├── vitest.config.ts
├── wrangler.toml
└── tsconfig.json
```
