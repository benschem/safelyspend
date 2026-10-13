# Budget API worker

The Cloudflare Worker backend for SafelySpend, built with Hono. It handles
authentication (an emailed code plus a password verifier), household
membership and invites, storage of wrapped key material, and encrypted vault
storage (metadata in D1, blobs in R2).

The server never sees a password, a key, or a byte of plaintext budget data.
It stores locked boxes and hands them back, and the unlocking always happens
in the browser. The detail is in
[crypto-design.md](../docs/reference/crypto-design.md).

This file is for working on the worker's code. Deploying and operating it
(secrets, logs, the database console, JWT secret rotation, rollbacks, disaster
recovery) is in [DEPLOYMENT.md](../docs/reference/DEPLOYMENT.md).

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in JWT_SECRET and RESEND_API_KEY
npm run db:migrate:local         # apply the D1 migrations to local SQLite
npm run dev                      # start the wrangler dev server
```

This needs Node.js 20 or later. The dev server emulates D1 and R2 locally, so
it needs no Cloudflare account. It does need a working Resend key, because
login codes and invites are sent as real emails.

[DEVELOPMENT.md](../docs/reference/DEVELOPMENT.md) has the rest: what
`.dev.vars` overrides, how the frontend finds the local worker, and the list
of settings and secrets under
[Settings and secrets](../docs/reference/DEVELOPMENT.md#settings-and-secrets).

## Tests

```bash
npm run test        # watch mode
npm run test:run    # single run
npm run typecheck   # tsc --noEmit
```

Tests use `@cloudflare/vitest-pool-workers` to run inside workerd with real D1
and R2 bindings. They need no external services or secrets: the test secrets
are set in `vitest.config.ts`.

Run `npm run typecheck` as well as the tests. The worker has its own
`tsconfig.json` and is not covered by the repo root's `npm run build`, so
nothing else type-checks it.

## Writing a migration

D1 migrations live in `migrations/` as numbered SQL files. Wrangler applies
them in filename order and records which have run in a `d1_migrations` table,
so each one runs once and applying is repeatable.

There is one migration, `0001_initial.sql`, which holds the whole schema:
accounts and key material, households and membership, wrapped-key storage,
invites, household-keyed vaults and sync state, sessions and rate limits. It
replaced four earlier migrations during the auth rewrite. A database created
before that needs the reset described in
[DEPLOYMENT.md](../docs/reference/DEPLOYMENT.md#resetting-a-database-created-before-the-auth-rewrite).

1. Create a file in `migrations/` with the next sequence number:

   ```
   migrations/0002_description.sql
   ```

2. Write forward-only SQL. D1 migrations have no "down", so use additive
   changes:
   - `CREATE TABLE` and `CREATE INDEX` are always safe.
   - `ALTER TABLE ... ADD COLUMN` is safe when the column is nullable or has a
     default.
   - `DROP TABLE` and `DROP INDEX` are safe if nothing references what is
     dropped.
   - Renaming or removing a column is not safe. SQLite does not support
     `ALTER TABLE ... DROP COLUMN` reliably.

3. Test it locally:

   ```bash
   npm run db:migrate:local
   npm run test:run
   ```

4. Apply it to production as part of a deploy, as described under Updating in
   [DEPLOYMENT.md](../docs/reference/DEPLOYMENT.md#updating). Undoing a
   migration that has reached production is under
   [Rollbacks](../docs/reference/DEPLOYMENT.md#rollbacks) there.

## Endpoints

Every endpoint returns JSON. The request and response contracts, the error
model and the rate limits are in
[api-design.md](../docs/reference/api-design.md). This is the list of routes.

A route that needs a session reads it from the `__budget_session` cookie,
which the login flow sets.

### Health

- `GET /health`: returns `{ "ok": true }`. No session.

### Auth (`/v1/auth`)

Logging in takes three calls. `/login` sends the code, `/verify-otp` exchanges
the code for a short-lived bridge token plus the parameters needed to derive a
password verifier, and `/login-complete` checks that verifier and issues the
session. The split exists so that proving control of a mailbox is never enough
alone to obtain a session, and so the verifier salt is handed out only after
the code has been passed.

No session:

- `POST /v1/auth/login`: send a 6-digit login code to an email address.
- `POST /v1/auth/verify-otp`: exchange a code for a bridge token and the
  verifier parameters.
- `POST /v1/auth/login-complete`: check the password verifier, then issue a
  session and the key bundle.
- `POST /v1/auth/signup`: create a cloud-sync account and its household.
  Needs a bridge token.
- `POST /v1/auth/signup-with-invite`: create an account that joins someone
  else's household.

Session required:

- `GET /v1/auth/key-bundle`: fetch the wrapped keys needed for a local unlock.
- `POST /v1/auth/rewrap-keys`: replace the password-wrapped rows at stronger
  Argon2id parameters.
- `POST /v1/auth/recovery-reset`: set a new password after unlocking with the
  recovery phrase.
- `POST /v1/auth/logout`: delete the current session.
- `GET /v1/auth/me`: return the current user and their household.
- `DELETE /v1/auth/account`: delete the account, and the household if nobody
  else is left in it.
- `GET /v1/auth/sessions`: list active sessions.
- `DELETE /v1/auth/sessions/:id`: revoke one session.
- `POST /v1/auth/revoke-all-sessions`: revoke every session except the
  current one.

### Invites and handoffs (`/v1/invites`, `/v1/handoffs`, `/v1/households`)

Adding a partner is a two-sided exchange, and the two people never have to be
online at the same time. The existing member issues an invite. The recipient
signs up and waits. The existing member wraps the household key for the
recipient's public key on their next login, and the recipient unwraps it and
re-wraps it under their own password and recovery phrase. Both sides compare a
fingerprint out of band before trusting the other's public key.

All of these need a session.

- `POST /v1/invites`: issue an invite and email it.
- `GET /v1/invites`: list invites sent and received.
- `POST /v1/invites/:token/accept`: accept an invite as an existing account.
- `DELETE /v1/invites/:id`: revoke an invite you sent.
- `GET /v1/handoffs/pending`: invitees waiting for you to wrap the household
  key for them.
- `GET /v1/handoffs/incoming`: a household key wrapped for you, waiting to be
  re-wrapped.
- `POST /v1/households/:householdId/members`: complete the handoff from the
  sender's side.
- `POST /v1/households/:householdId/members/:userId/rewrap`: complete it from
  the recipient's side.

### Vault (`/v1/vault`)

Every vault route needs a session and membership of a household, because the
vault is shared by the household and not owned by a user. A signed-in user
with no household yet gets `409 NO_HOUSEHOLD`.

- `GET /v1/vault`: get the vault's metadata (version, size, checksum).
- `GET /v1/vault/data`: download the current encrypted blob.
- `PUT /v1/vault/data`: upload an encrypted blob. Requires the
  `X-Expected-Version` header.
- `GET /v1/vault/history`: list the vault's versions.
- `GET /v1/vault/data/:vaultId`: download one historical version.

`X-Expected-Version` guards against two people as well as two tabs. A rejected
push means your partner's work is on the server and yours is not, so the
client cannot discard and retry.

## Project structure

```
worker/
├── migrations/          # D1 SQL migrations (applied in filename order)
├── src/
│   ├── index.ts         # Hono app entry point and the scheduled handler
│   ├── types.ts         # Env, User, Household, JWT types
│   ├── lib/             # crypto, bytes, wrapped-key validation, session, errors, IDs
│   ├── middleware/      # auth (plus the recovery-session and household guards), rate-limit
│   ├── routes/          # auth, invites, handoffs, households, vault handlers, shared helpers
│   ├── services/        # auth, email, users, households, invites, key-bundle, vault
│   └── __tests__/       # integration + unit tests
├── .dev.vars.example
├── vitest.config.ts
├── wrangler.toml
└── tsconfig.json
```
