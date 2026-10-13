# Deployment guide

How to deploy and operate SafelySpend: the frontend on Netlify, the backend on
Cloudflare Workers. Working on the worker's code is covered in
[`worker/README.md`](../../worker/README.md), and local setup in
[DEVELOPMENT.md](DEVELOPMENT.md).

No secret value belongs in this file. Values go in `wrangler secret`, names go
here.

## Prerequisites

- A domain (`safelyspend.app`) with access to its DNS settings
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers, D1
  and R2 enabled (the free tier works)
- A [Netlify account](https://app.netlify.com/signup) (the free tier works)
- A [Resend account](https://resend.com/) for sending login codes and invites
- Node.js 20 or later, and npm

Wrangler is a dev dependency of the worker, so every `npx wrangler` and
`npm run` command below runs from `worker/`, after `npm install` there.

## 1. DNS (Cloudflare)

A Workers custom domain requires the domain to be on Cloudflare DNS, so use
Cloudflare as the DNS provider for `safelyspend.app`.

1. In the Cloudflare dashboard, add `safelyspend.app` as a site.
2. If the current provider holds DNS records (for email or an existing site,
   say), copy them into Cloudflare before switching nameservers. Cloudflare
   tries to import them automatically, so check that nothing is missing.
3. Update the nameservers at your domain registrar to the ones Cloudflare
   provides.
4. Wait for the nameservers to propagate. This usually takes minutes and can
   take up to 24 hours.

The DNS records themselves are added in later steps, once the Netlify site and
the worker exist.

## 2. Backend (Cloudflare Workers)

### Authenticate Wrangler

```bash
cd worker
npm install
npx wrangler login
```

### Create the D1 database and the R2 bucket

```bash
# Create the D1 database
npx wrangler d1 create budget-db
# Copy the database_id from the output

# Create the R2 bucket
npx wrangler r2 bucket create budget-vaults
```

Replace the `database_id` in `worker/wrangler.toml` with the one from the
output:

```toml
[[d1_databases]]
binding = "DB"
database_name = "budget-db"
database_id = "<paste-your-database-id>"
```

The bucket needs no config change: `wrangler.toml` already names
`budget-vaults`.

### Set the production values

`worker/wrangler.toml` holds the plain settings under `[vars]` and the custom
domain under `routes`. If you are deploying to your own domain, change
`FROM_EMAIL`, `APP_URL` and the route's `pattern` before the first deploy. The
value each one takes is under [Production values](#production-values).

### Run the database migrations

```bash
npm run db:migrate:remote
```

This applies every migration in `worker/migrations/` that the remote database
has not yet run. Run it again whenever a migration is added.

### Deploy the worker for the first time

Deploy once before setting secrets, because Cloudflare needs the worker to
exist before secrets can attach to it.

```bash
npm run deploy
```

On the first deploy Wrangler asks you to register a `workers.dev` subdomain.
Answer **Y** and choose a name. This happens once per Cloudflare account.

The worker uploads but fails at runtime until its secrets are set.

### Set the secrets

The worker needs two secrets. They are not stored in `wrangler.toml`:
Cloudflare encrypts them at rest. Each `wrangler secret put` prompts for the
value, so paste it and press Enter.

```bash
# 1. Generate a JWT signing secret and copy the output
openssl rand -base64 48

# 2. Store it in Cloudflare, pasting the value from step 1 when prompted
npx wrangler secret put JWT_SECRET

# 3. Get your Resend API key from https://resend.com/api-keys
#    (create one if you have not; it starts with "re_")

# 4. Store it in Cloudflare
npx wrangler secret put RESEND_API_KEY
```

Check that both are set:

```bash
npx wrangler secret list
```

### Deploy again

A secret takes effect as soon as it is set, so the worker already works. This
deploy confirms the upload and prints the address.

```bash
npm run deploy
```

Wrangler prints the worker's address (for example
`https://budget-api.<your-subdomain>.workers.dev`).

### Custom domain

`worker/wrangler.toml` declares the custom domain, so the deploy attaches it
and Cloudflare creates the DNS record:

```toml
routes = [
  { pattern = "api.safelyspend.app", custom_domain = true }
]
```

It can also be added by hand in the Cloudflare dashboard: Workers & Pages >
`budget-api` > Settings > Domains & Routes > Add > Custom Domain >
`api.safelyspend.app`.

### Verify

```bash
curl https://api.safelyspend.app/health
# Should return: {"ok":true}
```

## 3. Frontend (Netlify)

1. Log in to [app.netlify.com](https://app.netlify.com).
2. Click **Add new site** > **Import an existing project**.
3. Connect your GitHub repo.
4. Netlify reads `netlify.toml`. Check that the build command is
   `npm run build` and the publish directory is `dist`.
5. Click **Deploy site**.

### Custom domain

1. In Netlify: Site settings > Domain management > Add custom domain >
   `safelyspend.app`.
2. In Cloudflare DNS, add the records Netlify shows for the domain. If the
   site was already on Netlify, Cloudflare imported them in step 1: check
   that the A records pointing at Netlify's IPs came across correctly.
3. These records can stay Proxied (orange cloud): Cloudflare handles TLS in
   front of Netlify.
4. In Netlify: Domain management > HTTPS > Verify DNS and provision
   certificate.

### Analytics (Plausible)

Landing page visits are counted by the self-hosted Plausible instance at
`analytics.rocketzip.com.au`. Its own runbook lives in the `plausible-server`
repo, so operational detail for it does not belong here.

The tracker is proxied through a first-party path. `netlify.toml`
reverse-proxies `/pa-stats/js/*` and `/pa-stats/api/event` to the analytics
host with status 200, so the script and its events are same-origin. That
defeats adblocker path matching, and it means the CSP needs no third-party
exceptions. If you find yourself adding the analytics host to `script-src` or
`connect-src`, the proxy has broken. Fix the proxy.

Register the site before deploying the tracker. Plausible silently drops
events for a domain it does not know and still returns success, so skipping
this looks the same as a broken proxy:

1. Log in to `https://analytics.rocketzip.com.au`.
2. Click **+ Add a website**.
3. Set the domain to `safelyspend.app`: bare, with no scheme, no `www.` and no
   trailing slash. It must match the `data-domain` attribute in `index.html`
   character for character, because Plausible does not infer it from the
   request's Host header.
4. Set the timezone to `Australia/Sydney`.
5. Ignore the install snippet it offers. That snippet points at the analytics
   host directly, and the proxied tag is already in `index.html`.

Then exclude your own visits in each browser you test from, since at current
volumes your own traffic would otherwise dominate. In the browser console on
`safelyspend.app`:

```js
localStorage.plausible_ignore = 'true';
```

The tracker script checks that flag itself, so no app code is involved.

## 4. Email (Resend)

Login emails are sent from `auth@safelyspend.app`, so the domain has to be
verified with Resend.

1. In the Resend dashboard: Domains > Add domain > `safelyspend.app`.
2. Resend gives you DNS records to add. Typically they are:
   - **TXT** at `_dmarc`
   - **CNAME** at `resend._domainkey`
   - **MX** at `send`, or the name Resend specifies
3. Add them in Cloudflare DNS with the values Resend provides, all as DNS only
   (grey cloud).
4. Wait for Resend to verify the domain, usually a few minutes.
5. Test by logging in from the deployed app.

## 5. Post-deployment checklist

- [ ] `curl https://api.safelyspend.app/health` returns `{"ok":true}`
- [ ] `https://safelyspend.app` loads the frontend
- [ ] The login flow works: the email arrives, the code verifies and a session
      is created
- [ ] Cloud sync uploads and downloads
- [ ] CORS works: no blocked requests in the browser console
- [ ] The CSP does not block API calls: no violations in the browser console
- [ ] `https://safelyspend.app/pa-stats/js/script.manual.js` returns 200, so
      the proxy is live
- [ ] Loading the landing page fires one `POST /pa-stats/api/event` that
      returns 202
- [ ] Navigating into the app fires no further events, which is what the
      privacy page promises
- [ ] The visit appears in the Plausible dashboard under Realtime

## Production values

What each setting does is listed in
[DEVELOPMENT.md](DEVELOPMENT.md#settings-and-secrets). These are the values
production uses.

Plain settings, under `[vars]` in `worker/wrangler.toml`:

- `ENVIRONMENT`: `production`
- `FROM_EMAIL`: `auth@safelyspend.app`
- `APP_URL`: `https://safelyspend.app`

Secrets, set with `wrangler secret put`:

- `JWT_SECRET`: generated with `openssl rand -base64 48`
- `RESEND_API_KEY`: from the Resend dashboard
- `JWT_SECRET_PREVIOUS`: optional, set only while
  [rotating the JWT secret](#rotating-the-jwt-secret)

Bindings:

- `DB`: the D1 database `budget-db`
- `VAULT_BUCKET`: the R2 bucket `budget-vaults`

DNS records in Cloudflare:

- **A** at `@`: Netlify's IPs, imported automatically. Proxied.
- **CNAME** at `api`: created by Workers. Proxied.
- The records from Resend in step 4. DNS only.

## Updating

### Frontend

Push to `main`. Netlify deploys from GitHub automatically.

### Backend

```bash
cd worker
npm run deploy
```

When there is a new migration, apply it before deploying:

```bash
npm run db:migrate:remote
npm run deploy
```

## Operations

### Logs

Stream logs in real time:

```bash
cd worker
npx wrangler tail
```

This shows requests, errors and console output. Application logs are
structured JSON, and those written while handling a request carry a
`requestId` for tracing.

Historical logs are in the Cloudflare dashboard: Workers & Pages >
`budget-api` > Logs. `[observability]` in `wrangler.toml` enables request
traces, error rates, latency and CPU time there at 100% sampling.

### Database console

`wrangler d1 execute` runs SQL directly against the remote database:

```bash
npx wrangler d1 execute budget-db --remote --command="SQL here"
```

Common queries:

```bash
# Look up a user
npx wrangler d1 execute budget-db --remote \
  --command="SELECT * FROM users WHERE email = 'user@example.com'"

# List active sessions for a user
npx wrangler d1 execute budget-db --remote \
  --command="SELECT id, created_at, expires_at FROM sessions WHERE user_id = 'USER_ID' AND expires_at > datetime('now')"

# Find a user's household (vaults belong to the household)
npx wrangler d1 execute budget-db --remote \
  --command="SELECT household_id FROM household_members WHERE user_id = 'USER_ID'"

# Check a household's vault storage
npx wrangler d1 execute budget-db --remote \
  --command="SELECT COUNT(*) as versions, SUM(size_bytes) as total_bytes FROM vaults WHERE household_id = 'HOUSEHOLD_ID'"

# Count all users
npx wrangler d1 execute budget-db --remote \
  --command="SELECT COUNT(*) FROM users"

# Delete a user. Their sessions, codes, keys, membership and sent invites
# cascade. The household, its vaults and its R2 objects do not, so prefer
# deleting the account from the app, which removes those too. The delete
# fails if the user has handed the household key to another member:
# household_member_keys.sender_user_id has no ON DELETE rule.
npx wrangler d1 execute budget-db --remote \
  --command="DELETE FROM users WHERE id = 'USER_ID'"
```

Database information:

```bash
npx wrangler d1 info budget-db
```

### R2 storage

```bash
# Object count and total size
npx wrangler r2 bucket info budget-vaults

# Download an object
npx wrangler r2 object get budget-vaults/HOUSEHOLD_ID/VAULT_ID

# Delete an object
npx wrangler r2 object delete budget-vaults/HOUSEHOLD_ID/VAULT_ID
```

Wrangler cannot list objects. Keys are `{householdId}/{vaultId}` and come from
`vaults.r2_key` in D1, from the dashboard, or from the S3-compatible API.

The worker keeps the last 10 vault versions per household and prunes older
ones after each upload. An R2 object with no matching `vaults` row is an
orphan, and the daily cron removes those.

### Secrets

A secret takes effect as soon as it is set, with no redeploy.

```bash
# List secrets (names only, no values)
npx wrangler secret list

# Update a secret
npx wrangler secret put RESEND_API_KEY

# Delete a secret
npx wrangler secret delete JWT_SECRET_PREVIOUS
```

### Rotating the JWT secret

Changing `JWT_SECRET` on its own invalidates every active session and forces
every user to log in again. The worker avoids that with a fallback key. The
auth middleware verifies each JWT with `JWT_SECRET` first, and if that fails
and `JWT_SECRET_PREVIOUS` is set, it retries with the previous secret. New
JWTs are always signed with the current `JWT_SECRET`.

1. Set the old secret as the fallback:

   ```bash
   npx wrangler secret put JWT_SECRET_PREVIOUS
   # Paste the current value of JWT_SECRET
   ```

2. Set the new secret:

   ```bash
   npx wrangler secret put JWT_SECRET
   # Paste a new value from: openssl rand -base64 48
   ```

3. Deploy, if the deployed worker predates the fallback support:

   ```bash
   npm run deploy
   ```

4. Wait 7 days for the old JWTs to expire. During that time logins and
   renewals are signed with the new secret, and existing JWTs still verify
   through the fallback. A JWT renews once it is past halfway through its
   life, about 3.5 days, so users move to the new secret as they use the app.

5. Remove the fallback:

   ```bash
   npx wrangler secret delete JWT_SECRET_PREVIOUS
   ```

### Rollbacks

To roll back the worker's code, use the Cloudflare dashboard: Workers &
Pages > `budget-api` > Deployments > click a previous deployment > Rollback.

D1 migrations are forward-only, so there is no down migration to run. How to
undo one depends on what it did:

- **Additive** (new tables, columns or indexes): write a follow-up migration
  that reverses it, for example with `DROP INDEX` or `DROP TABLE`.
- **Destructive** (lost data or a broken schema): restore the database with
  [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/),
  D1's point-in-time recovery (30 days on the Workers Paid plan):

  ```bash
  # Check available restore points
  npx wrangler d1 time-travel info budget-db

  # Restore to a point in time before the migration
  npx wrangler d1 time-travel restore budget-db --timestamp=2026-02-23T00:00:00Z
  ```

  Then re-apply only the migrations you want with
  `npm run db:migrate:remote`.

Testing a migration locally first, as described in
[`worker/README.md`](../../worker/README.md#writing-a-migration), catches most
problems before they reach production.

### Disaster recovery

D1 and R2 depend on each other, and neither is enough alone.

- **D1**: users, households and membership, wrapped key material, sessions,
  auth codes, invites, vault metadata (versions, checksums, R2 key paths) and
  sync state. Without it the R2 objects are opaque blobs: nothing says which
  version is current, which household it belongs to, or which wrapped key
  opens it.
- **R2**: the encrypted vault blobs, which are the users' actual data. D1
  stores only metadata about them.

The `vaults.r2_key` column in D1 is the only mapping between metadata and
blobs.

Losing D1's wrapped key material (`users.pubkey` and the verifier columns,
`user_keys`, `household_member_keys`) is worse than losing vault metadata. The
R2 blobs stay encrypted under a MasterKey whose every wrapped copy lived in
D1, so without those rows the ciphertext cannot be recovered even with the
right password. The exception is a user who still holds their recovery phrase
and a local copy of the data, since the phrase only unwraps rows that still
exist.

The primary copy of each user's data is in their browser (IndexedDB). The
cloud vault is a backup of it.

#### Backups

D1 is covered by Time Travel on the Workers Paid plan, where it is enabled by
default. The free plan has no Time Travel. Check that it is active with
`npx wrangler d1 info budget-db`. The restore commands are under
[Rollbacks](#rollbacks). For a further backup, export the database
periodically:

```bash
npx wrangler d1 export budget-db --remote --output=backup.sql
```

R2 has no point-in-time recovery, and the vault blobs are the only server-side
copy of user data. What protects them:

- The 10 versions kept per household, so an accidental overwrite can be
  recovered from the version history.
- Each user's local data, which they can upload again through the sync UI.
- Optionally, a periodic copy of the R2 objects to a separate bucket or
  external storage, using `wrangler r2 object get`.

Watch the R2 object count as well. A sudden drop indicates accidental
deletion.

#### D1 lost, R2 intact

1. Restore D1 from Time Travel to the most recent point before the incident.
2. Verify it:

   ```bash
   npx wrangler d1 execute budget-db --remote --command="SELECT COUNT(*) FROM users"
   ```

3. Redeploy the worker with `npm run deploy`.

Users can then log in and reach their vaults straight away, because the R2
data was never touched.

If Time Travel is unavailable, the D1 data cannot be recovered. The R2 objects
survive, but Wrangler cannot list them and nothing can reconstruct the version
ordering, the household membership or the wrapped keys that would decrypt
them.

#### R2 lost, D1 intact

The D1 metadata stays valid, but every vault download returns 404 and users
see sync errors when they try to download. No server-side recovery is
possible. Each user's device still has their data in IndexedDB, and they can
upload it again through the sync UI.

#### Both lost

All server-side data is gone. Users still have the local data in their
browser's IndexedDB.

1. Recreate the infrastructure from step 2 of this guide: the D1 database, the
   R2 bucket, the migrations and the secrets.
2. Users register again and upload from their local data.

### Metrics

- **Dashboard**: Workers & Pages > `budget-api` > Analytics shows requests,
  errors and CPU time.
- **Health check**: `curl https://api.safelyspend.app/health`
- **Database status**: `npx wrangler d1 info budget-db`
- **Landing page traffic**: `https://analytics.rocketzip.com.au`. Only the
  landing page is measured, never the app itself.

The frontend reports errors to no external service. It has React error
boundaries, which catch crashes and show a fallback UI, and an in-memory debug
logger, but errors are visible only in the user's browser, so you hear about
them when users report them. When there are enough users to justify it, add
[Sentry](https://sentry.io) (its free tier covers 5K errors a month):

1. `npm install @sentry/react`, from the repo root
2. Initialise it in `src/main.tsx` with your Sentry DSN.
3. Wrap the router with `Sentry.wrapCreateBrowserRouterV7`.

Sentry then captures unhandled exceptions, promise rejections and errors
caught by the React error boundaries.

### Cron schedule

The orphan cleanup runs daily at 03:00 UTC. It is configured in
`worker/wrangler.toml`:

```toml
[triggers]
crons = ["0 3 * * *"]
```

To change the schedule, edit the cron expression and redeploy.

### Edge protection

Recommended Cloudflare dashboard settings that act at the edge, before a
request reaches the worker:

- **Bot Fight Mode**: enable under Security > Bots (free tier). Blocks known
  bot traffic.
- **Managed WAF ruleset**: enable the Cloudflare Managed Ruleset under
  Security > WAF. Covers the OWASP top ten and common attack patterns.
- **Edge rate limiting**: add a rate limiting rule for `/v1/auth/login` (for
  example, 10 requests per 10 seconds per IP) as a first line of defence ahead
  of the worker's own rate limiting.
- **Browser Integrity Check**: enable under Security > Settings. Evaluates
  HTTP headers for common bot signatures.

## Resetting a database created before the auth rewrite

This applies only to a deployment whose D1 database was created before the
auth rewrite. The reset destroys everything in D1 and R2. Never run it against
a database that holds real data: write a forward migration for that.

During the auth rewrite `0001_initial.sql` was rewritten in place and `0002`
to `0004` were deleted. Wrangler records applied migrations by filename in a
`d1_migrations` table, so a database that ran the old `0001` will not run the
new one and will not notice that its contents changed. It is left with the v1
tables, a ledger claiming four migrations ran, and a worker that queries
columns which do not exist.

Production was reset once, on 2026-09-13, when it held no vaults and no real
users: the R2 bucket `budget-vaults` was empty, and so were the D1 tables
`vaults` and `sync_state`. The client has no read path for format v1, so there
was nothing to migrate and nothing to preserve.

Check before doing anything:

```bash
npx wrangler d1 execute budget-db --remote --command="SELECT COUNT(*) AS vaults FROM vaults"
npx wrangler r2 bucket info budget-vaults
```

If the vault count is not zero, or the bucket reports any objects, stop.

Reset the local database first. It is disposable, so this is only a delete:

```bash
rm -rf .wrangler/state/v3/d1 .wrangler/state/v3/r2
npm run db:migrate:local
npm run test:run
```

Once the local tests pass, reset the remote database. Drop the v1 tables,
clear the ledger, then apply the schema again:

```bash
# 1. Drop every v1 table. Order matters: children before parents.
npx wrangler d1 execute budget-db --remote --command="
  DROP TABLE IF EXISTS sync_state;
  DROP TABLE IF EXISTS vaults;
  DROP TABLE IF EXISTS auth_codes;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS rate_limits;
  DROP TABLE IF EXISTS users;
"

# 2. Clear the applied-migrations ledger so the rewritten 0001 runs again.
npx wrangler d1 execute budget-db --remote --command="DELETE FROM d1_migrations"

# 3. Apply the new schema.
npm run db:migrate:remote

# 4. Confirm it landed.
npx wrangler d1 execute budget-db --remote --command="
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
"
```

R2 objects were keyed `{userId}/{vaultId}` under the old layout and are keyed
`{householdId}/{vaultId}` under the new one. Nothing reads the old prefix, so
any leftovers are orphans, and the daily cron (`cleanupOrphanedR2Objects`)
removes them. After a reset the bucket should already be empty, so checking it
is a confirmation. To clear leftovers without waiting for the cron:

```bash
npx wrangler r2 bucket info budget-vaults          # object_count and bucket_size
npx wrangler r2 object delete budget-vaults/<key>  # one key at a time
```

Finally, redeploy so the worker and the schema match:

```bash
npm run deploy
```

## Further reading

- [`worker/README.md`](../../worker/README.md): working on the worker's code,
  including tests, migrations and the route list
- [DEVELOPMENT.md](DEVELOPMENT.md): local setup, and the list of settings and
  secrets
- [api-design.md](api-design.md): the schema and the endpoint contracts
