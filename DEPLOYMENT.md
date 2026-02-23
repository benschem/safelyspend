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
3. Wait for nameserver propagation (can take up to 24 hours, usually minutes)

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

### Set secrets

```bash
# Generate and set a JWT signing secret
npx wrangler secret put JWT_SECRET
# Paste output of: openssl rand -base64 48

# Set your Resend API key (from https://resend.com/api-keys)
npx wrangler secret put RESEND_API_KEY
```

### Deploy the worker

```bash
npm run deploy
```

This deploys to `https://budget-api.<your-subdomain>.workers.dev`.

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
2. Netlify will show you a DNS target (e.g. `your-site.netlify.app`)
3. In Cloudflare DNS, add these records:

| Type  | Name | Target                     | Proxy |
|-------|------|----------------------------|-------|
| CNAME | `@`  | `<your-site>.netlify.app`  | DNS only (grey cloud) |
| CNAME | `www`| `<your-site>.netlify.app`  | DNS only (grey cloud) |

**Important:** Set Cloudflare proxy to **DNS only** (grey cloud icon) for Netlify records. Netlify needs to terminate TLS itself to serve the site and provision its SSL certificate. Orange cloud (proxied) will break Netlify's SSL.

4. In Netlify: Domain management > HTTPS > Verify DNS and provision certificate

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
| CNAME | `@`               | `<your-site>.netlify.app`         | DNS only  |
| CNAME | `www`             | `<your-site>.netlify.app`         | DNS only  |
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

## Further Reading

- `worker/README.md` — full backend docs (API endpoints, JWT rotation, disaster recovery, migrations)
- `CLAUDE.md` — codebase architecture and conventions
