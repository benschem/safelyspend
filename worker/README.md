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
| `RESEND_API_KEY` | `wrangler secret` | Resend API key for sending auth code emails |
| `ENVIRONMENT` | `wrangler.toml` [vars] | `"production"` or `"development"` |
| `FROM_EMAIL` | `wrangler.toml` [vars] | Sender address for auth code emails |
| `APP_URL` | `wrangler.toml` [vars] | Frontend URL (used in CORS and email links) |

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
