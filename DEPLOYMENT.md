# Deployment Guide

Full deployment guide for SafelySpend: frontend on Netlify, backend on Cloudflare Workers.

## Prerequisites

- A domain (`safelyspend.app`) with access to DNS settings
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works for Workers, D1, and R2)
- A [Netlify account](https://app.netlify.com/signup) (free tier works)
- A [Resend account](https://resend.com/) for sending login emails
- Node.js 18+ and npm installed locally

## 1. DNS Setup (Cloudflare)

Cloudflare Workers custom domains require the domain to be on Cloudflare DNS. Use Cloudflare as your DNS provider for `safelyspend.app`.

1. In the Cloudflare dashboard, add `safelyspend.app` as a site
2. Update your domain registrar's nameservers to the ones Cloudflare provides
3. If you have existing DNS records at your current provider (e.g. for email, a current site, etc.), **copy them into Cloudflare first** before switching nameservers — Cloudflare will attempt to auto-import them, but verify nothing is missing
4. Wait for nameserver propagation (can take up to 24 hours, usually minutes)

DNS records are configured in later steps after creating the Netlify site and Cloudflare Worker.

## 2. Backend (Cloudflare Workers)

### Authenticate Wrangler

```bash
cd worker
npx wrangler login
```

### Create resources

```bash
# Create the D1 database
npx wrangler d1 create budget-db
# Copy the database_id from the output

# Create the R2 bucket
npx wrangler r2 bucket create budget-vaults
```

Update `worker/wrangler.toml` with the real database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "budget-db"
database_id = "<paste-your-database-id>"
```

### Run database migrations

```bash
npm run db:migrate:remote
```

### Deploy the worker (first deploy)

Deploy once before setting secrets — Cloudflare needs the worker to exist first.

```bash
npm run deploy
```

On first deploy you'll be prompted to register a `workers.dev` subdomain — say **Y** and choose a subdomain name. This is a one-time setup for your Cloudflare account.

The worker will be uploaded but will fail at runtime (missing secrets). That's expected — it creates the worker resource that secrets attach to.

### Set secrets

Each `wrangler secret put` command will prompt you to enter the value — paste it and press Enter.

```bash
# 1. Generate a JWT signing secret
openssl rand -base64 48
# Copy the output

# 2. Store it in Cloudflare
npx wrangler secret put JWT_SECRET
# Paste the value from step 1 when prompted

# 3. Get your Resend API key from https://resend.com/api-keys
#    (create one if you haven't — it starts with "re_")

# 4. Store it in Cloudflare
npx wrangler secret put RESEND_API_KEY
# Paste your Resend API key when prompted
```

Verify both are set:

```bash
npx wrangler secret list
```

### Redeploy with secrets

```bash
npm run deploy
```

Now the worker is fully functional at `https://budget-api.<your-subdomain>.workers.dev`.

### Add custom domain

In Cloudflare dashboard: Workers & Pages > `budget-api` > Settings > Domains & Routes > Add > Custom Domain > `api.safelyspend.app`

Cloudflare will automatically create the DNS record for this.

### Verify

```bash
curl https://api.safelyspend.app/health
# Should return: {"ok":true}
```

## 3. Frontend (Netlify)

1. Log in to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** > **Import an existing project**
3. Connect your GitHub repo
4. Netlify auto-detects `netlify.toml` — verify:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy site**

### Add custom domain

1. In Netlify: Site settings > Domain management > Add custom domain > `safelyspend.app`
2. When Cloudflare is added as DNS provider (step 1), it will auto-import existing DNS records from your domain registrar — verify the A records pointing to Netlify's IPs were imported correctly
3. These records can stay **Proxied** (orange cloud) — Cloudflare handles TLS in front of Netlify
4. In Netlify: Domain management > HTTPS > Verify DNS and provision certificate

### Analytics (Plausible)

Landing page visits are counted by the self-hosted Plausible instance at
`analytics.rocketzip.com.au` (its own runbook lives in the `plausible-server`
repo — don't duplicate operational detail here).

The tracker is **proxied through a first-party path**. `netlify.toml` reverse-proxies
`/pa-stats/*` to the analytics host with status 200, so the script and its events are
same-origin. That defeats adblocker path matching and, more importantly, means the CSP
needs no third-party exceptions. If you ever find yourself adding the analytics host to
`script-src` or `connect-src`, the proxy has broken — fix that instead.

Register the site before deploying the tracker. Plausible silently drops events for a
domain it doesn't know and still returns success, so skipping this looks exactly like a
broken proxy:

1. Log in to `https://analytics.rocketzip.com.au`
2. **+ Add a website**
3. Domain: `safelyspend.app` — bare, no scheme, no `www.`, no trailing slash. It must
   match the `data-domain` attribute in `index.html` exactly; Plausible does not infer
   it from the request Host header
4. Timezone: `Australia/Sydney`
5. Ignore the install snippet it offers — it points at the analytics host directly, and
   we use the proxied tag already in `index.html`

Then exclude your own visits, per browser you test from — at current volumes your own
traffic would otherwise dominate. In the browser console on `safelyspend.app`:

```js
localStorage.plausible_ignore = 'true';
```

The tracker script checks that flag itself, so no app code is involved.

## 4. Email (Resend)

For login emails to send from `auth@safelyspend.app`, you need to verify the domain with Resend.

1. In Resend dashboard: Domains > Add domain > `safelyspend.app`
2. Resend will give you DNS records to add (typically):

| Type  | Name                          | Value                          |
|-------|-------------------------------|--------------------------------|
| TXT   | `_dmarc`                      | (Resend provides this)         |
| CNAME | `resend._domainkey`           | (Resend provides this)         |
| MX    | `send` (or as specified)      | (Resend provides this)         |

3. Add these records in Cloudflare DNS (all **DNS only**, grey cloud)
4. Wait for Resend to verify (usually a few minutes)
5. Test by triggering a login from the deployed app

## 5. Post-Deployment Checklist

- [ ] `curl https://api.safelyspend.app/health` returns `{"ok":true}`
- [ ] `https://safelyspend.app` loads the frontend
- [ ] Login flow works (email received, code verifies, session created)
- [ ] Cloud sync uploads and downloads successfully
- [ ] CORS works (no blocked requests in browser console)
- [ ] CSP doesn't block API calls (check browser console for violations)
- [ ] `https://safelyspend.app/pa-stats/js/script.manual.js` returns 200 (proxy is live)
- [ ] Loading the landing page fires one `POST /pa-stats/api/event` returning 202
- [ ] Navigating into the app fires **no** further events — this is what the privacy page promises
- [ ] The visit appears in the Plausible dashboard under Realtime

## Environment Summary

### Cloudflare Worker (`worker/wrangler.toml` vars)

| Variable      | Value                       |
|---------------|-----------------------------|
| `ENVIRONMENT` | `production`                |
| `FROM_EMAIL`  | `auth@safelyspend.app`      |
| `APP_URL`     | `https://safelyspend.app`   |

### Cloudflare Worker secrets

| Secret                 | Source                              |
|------------------------|-------------------------------------|
| `JWT_SECRET`           | `openssl rand -base64 48`           |
| `RESEND_API_KEY`       | Resend dashboard                    |
| `JWT_SECRET_PREVIOUS`  | (Optional) Set during key rotation  |

### Cloudflare bindings

| Binding        | Type | Resource name    |
|----------------|------|------------------|
| `DB`           | D1   | `budget-db`      |
| `VAULT_BUCKET` | R2   | `budget-vaults`  |

### DNS Records (Cloudflare)

| Type  | Name              | Target / Value                    | Proxy     |
|-------|-------------------|-----------------------------------|-----------|
| A     | `@`               | (Netlify IPs, auto-imported)      | Proxied   |
| CNAME | `api`             | (auto-created by Workers)         | Proxied   |
| TXT   | `_dmarc`          | (from Resend)                     | DNS only  |
| CNAME | `resend._domainkey`| (from Resend)                    | DNS only  |

## Updating

### Frontend

Push to main — Netlify auto-deploys from GitHub.

### Backend

```bash
cd worker
npm run deploy
```

For database changes, apply migrations before deploying:

```bash
npm run db:migrate:remote
npm run deploy
```

## Operations

### Logs

**Real-time log streaming:**

```bash
cd worker
npx wrangler tail
```

This streams all worker logs (requests, errors, console output) to your terminal. All logs are JSON-structured with a `requestId` for tracing.

**Historical logs:** Cloudflare Dashboard > Workers & Pages > `budget-api` > Logs

### Database console

There's no Rails-console equivalent for Workers. The closest thing is `wrangler d1 execute`, which lets you run SQL directly against the remote database.

```bash
# Run a query
npx wrangler d1 execute budget-db --remote --command="SQL here"
```

**Common queries:**

```bash
# Look up a user
npx wrangler d1 execute budget-db --remote \
  --command="SELECT * FROM users WHERE email = 'user@example.com'"

# List active sessions for a user
npx wrangler d1 execute budget-db --remote \
  --command="SELECT id, created_at, expires_at FROM sessions WHERE user_id = 'USER_ID' AND expires_at > datetime('now')"

# Check a user's vault storage
npx wrangler d1 execute budget-db --remote \
  --command="SELECT COUNT(*) as versions, SUM(size_bytes) as total_bytes FROM vaults WHERE user_id = 'USER_ID'"

# Count all users
npx wrangler d1 execute budget-db --remote \
  --command="SELECT COUNT(*) FROM users"

# Delete a specific user (cascades to sessions, auth_codes, sync_state)
npx wrangler d1 execute budget-db --remote \
  --command="DELETE FROM users WHERE id = 'USER_ID'"
```

**Database info:**

```bash
npx wrangler d1 info budget-db
```

### R2 storage

```bash
# List all objects
npx wrangler r2 object list budget-vaults

# List objects for a specific user
npx wrangler r2 object list budget-vaults --prefix=USER_ID/

# Download an object
npx wrangler r2 object get budget-vaults USER_ID/VAULT_ID

# Delete an object
npx wrangler r2 object delete budget-vaults USER_ID/VAULT_ID
```

Orphaned R2 objects (no matching DB record) are cleaned up automatically by the daily cron at 03:00 UTC.

### Secrets

Secrets take effect immediately — no redeploy needed.

```bash
# List secrets (names only, no values)
npx wrangler secret list

# Update a secret
npx wrangler secret put RESEND_API_KEY

# Delete a secret
npx wrangler secret delete JWT_SECRET_PREVIOUS
```

For JWT secret rotation, see `worker/README.md` — the worker supports zero-downtime rotation via a fallback key.

### Rollbacks

**Worker code:** Cloudflare Dashboard > Workers & Pages > `budget-api` > Deployments > click a previous deployment > Rollback

**Database:** D1 supports point-in-time recovery (30 days, paid plan):

```bash
# Check available restore points
npx wrangler d1 time-travel info budget-db

# Restore to a point in time
npx wrangler d1 time-travel restore budget-db --timestamp=2026-02-23T00:00:00Z
```

### Metrics

- **Dashboard:** Workers & Pages > `budget-api` > Analytics (requests, errors, CPU time)
- **Health check:** `curl https://api.safelyspend.app/health`
- **Database status:** `npx wrangler d1 info budget-db`
- **Landing page traffic:** `https://analytics.rocketzip.com.au` (landing page only — the app itself is not measured)

### Cron schedule

The orphan cleanup cron is configured in `worker/wrangler.toml`:

```toml
[triggers]
crons = ["0 3 * * *"]  # Daily at 03:00 UTC
```

To change the schedule, edit the cron expression and redeploy.

## Further Reading

- `worker/README.md` — full backend docs (API endpoints, JWT rotation, disaster recovery, migrations)
- `CLAUDE.md` — codebase architecture and conventions
