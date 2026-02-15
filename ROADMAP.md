# ROADMAP

## Features
- Server side db
- Currency selection (currently AUD-centric)
- Date format preferences
- Financial year start customization
- Superannuation
- Investments
- Debt

- ~~Per-account login throttling — track sends per email address, not just per IP~~ ✅
- ~~Session listing/revocation — let users see and kill active sessions~~ ✅

## WAF & Bot Management (Cloudflare Dashboard)

Recommended Cloudflare dashboard settings for edge-layer protection:

- **Bot Fight Mode** — Enable under Security > Bots (free tier). Blocks known bot traffic before it reaches the Worker.
- **Managed WAF Ruleset** — Enable the Cloudflare Managed Ruleset under Security > WAF. Covers OWASP top-10 and common attack patterns.
- **Edge Rate Limiting** — Add a rate limiting rule for `/auth/login` (e.g. 10 requests per 10 seconds per IP) to provide a first line of defense before Worker-level rate limiting.
- **Browser Integrity Check** — Enable under Security > Settings. Evaluates HTTP headers for common bot signatures.
- **Turnstile CAPTCHA** (future) — Consider adding Cloudflare Turnstile to the login flow for interactive challenge-based bot protection.
