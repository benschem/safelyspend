# Development Guide

How to set up, run, test, and deploy SafelySpend.

## Prerequisites

- Node.js 20+
- npm 10+
- A Cloudflare account (for worker deployment only — not needed for frontend dev)

## Frontend Setup

```bash
# Clone and install
git clone <repo-url>
cd budget
npm install

# Start dev server
npm run dev
# → http://localhost:5173
```

That's it for frontend development. The app works fully offline with IndexedDB — no backend needed unless you're working on cloud sync.

One expected error in the dev console: the analytics script at `/pa-stats/js/script.manual.js` 404s. The `/pa-stats/*` proxy is a Netlify redirect, so it only exists on a deployed site. Harmless — the app degrades quietly without the tracker, and no analytics are sent from local development. Nothing to fix.

### Frontend commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (`tsc` + `vite build`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run |
| `npx prettier --write "src/**/*.{ts,tsx}"` | Format code |

## Worker Setup (Backend)

The backend is a Cloudflare Worker in the `worker/` directory. You only need this if working on auth or cloud sync.

```bash
cd worker
npm install
```

### Environment variables

The worker needs these bindings (defined in `worker/wrangler.toml`):

| Variable | What it is | Where to get it |
|----------|-----------|-----------------|
| `DB` | D1 database binding | Created via `wrangler d1 create budget-db` |
| `VAULT_BUCKET` | R2 bucket binding | Created via `wrangler r2 bucket create budget-vaults` |
| `JWT_SECRET` | Secret for signing JWTs | Generate a random string, set via `wrangler secret put JWT_SECRET` |
| `JWT_SECRET_PREVIOUS` | Previous JWT secret (for rotation) | Optional. Set when rotating secrets. |
| `RESEND_API_KEY` | Resend email API key | From [resend.com](https://resend.com) dashboard |
| `ENVIRONMENT` | `"production"` or `"development"` | Set in `wrangler.toml` `[vars]` |
| `FROM_EMAIL` | Sender email for OTP emails | Set in `wrangler.toml` `[vars]` |
| `APP_URL` | Frontend URL (for CORS) | Set in `wrangler.toml` `[vars]` |

### Create D1 database and run migrations

```bash
cd worker

# Create the D1 database (if it doesn't exist)
npx wrangler d1 create budget-db
# Update the database_id in wrangler.toml with the ID from the output

# Run migrations
npx wrangler d1 migrations apply budget-db

# For local development, apply to local D1:
npx wrangler d1 migrations apply budget-db --local
```

Migrations are in `worker/migrations/`:
1. `0001_initial.sql` — users, auth_codes, vaults, sync_state tables
2. `0002_security.sql` — Security additions (rate limiting, sessions)
3. `0003_cleanup_indexes.sql` — Index optimizations
4. `0004_idempotency.sql` — Idempotency key column on vaults

### Create R2 bucket

```bash
npx wrangler r2 bucket create budget-vaults
```

### Run worker locally

```bash
cd worker
npx wrangler dev
# → http://localhost:8787
```

For the frontend to talk to the local worker, `ENVIRONMENT` must be `"development"` in `wrangler.toml` (this allows CORS from `localhost:5173`).

### Set secrets

Secrets are set per-environment and not stored in `wrangler.toml`:

```bash
cd worker
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
```

## Deployment

There is no CI/CD. Deployment is manual.

### Frontend

The frontend is a static SPA. Build it and deploy to your hosting provider:

```bash
npm run build
# Output in dist/
```

### Worker

```bash
cd worker
npx wrangler deploy
```

This deploys to Cloudflare Workers using the config in `worker/wrangler.toml`.

### Scheduled tasks

The worker has a daily cron (`0 3 * * *` UTC) for cleaning up orphaned R2 objects. This is configured in `wrangler.toml` under `[triggers]` and runs automatically once deployed.

## Testing

### Frontend tests

Tests are in `src/__tests__/` and use Vitest:

```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

What's covered:
- `lib/utils.test.ts` — Date helpers, formatting, `toMonthlyCents`
- `lib/import-schema.test.ts` — Zod schema validation, import migration
- `lib/e2e-crypto.test.ts` — Encrypt/decrypt round-trip
- `lib/db-versioning.test.ts` — Schema version checks
- `lib/up-csv-parser.test.ts` — Up Bank CSV parsing
- `lib/duplicate-detection.test.ts` — Import fingerprint dedup
- `lib/anchors.test.ts` — Balance anchor calculations
- `lib/interest-rate.test.ts` — Interest rate schedule resolution
- `lib/chart-calculations.test.ts` — Chart data computation
- `lib/api-client.test.ts` — API client error handling
- `routes/budget-segments.test.ts` — Budget segmentation logic

What's **not** covered (no component tests):
- React component rendering
- Hook behavior (would need a test harness with Dexie)
- Integration flows (e.g., create scenario → add rules → see forecast)

### Worker tests

Tests are in `worker/src/__tests__/` and use Vitest with Cloudflare Workers test utilities:

```bash
cd worker
npm run test
```

What's covered:
- Auth flow: login, verify, session management, brute-force protection
- Vault: upload, download, version conflicts, idempotency, owner isolation
- Error handling
- Crypto utilities

### Writing new tests

Follow existing patterns:
- Put tests in `src/__tests__/<category>/` (frontend) or `worker/src/__tests__/` (worker)
- Name files `<module>.test.ts`
- Frontend tests import directly from `@/lib/...`
- Worker tests use the Cloudflare Workers test harness for D1/R2 mocking

## Project Conventions

These are enforced by convention, not tooling:

- **Amounts** — always integer cents (e.g., `$12.34` = `1234`)
- **Dates** — ISO strings (`"2025-07-01"`)
- **Timestamps** — ISO with time (`"2025-07-01T10:30:00.000Z"`)
- **User ID** — always `"local"` (single-user placeholder)
- **Storage keys** — prefixed with `budget:`, defined in `src/lib/storage-keys.ts`
- **Commit messages** — prefixed with `claude:` + conventional commit type (see `CLAUDE.md`)
- **Changelog** — every user-facing change gets an entry in `src/lib/changelog.ts`
- **Version bumps** — `package.json` version updated with each release

## Common Development Tasks

### Inspecting IndexedDB data

Open browser DevTools → Application → IndexedDB → `BudgetApp`. You can see all tables and records directly.

### Resetting app state

In the app: Settings → Reset Data. Or in the console:

```js
// Clear IndexedDB only (keeps theme/view prefs)
indexedDB.deleteDatabase('BudgetApp');
location.reload();
```

### Testing with demo data

On the landing page, click "Try Demo" to load procedurally-generated data. Demo data is generated relative to today's date (not static fixtures), so dates and amounts will vary.

### Testing cloud sync locally

1. Start the worker locally (`cd worker && npx wrangler dev`)
2. Set `ENVIRONMENT=development` in `wrangler.toml`
3. The frontend's API client should point to `localhost:8787`
4. You'll need a valid `RESEND_API_KEY` for OTP emails (or mock the email service)
