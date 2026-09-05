# Decisions

Mini ADRs (Architecture Decision Records) for choices that aren't obvious from reading the code.

## Why Vite?

**Chosen:** Vite with React plugin.

Fast HMR during development, fast production builds. No special configuration needed for the stack (React, TypeScript, Tailwind). The alternative was Next.js, but this app has no server-side rendering needs — it's a local-first SPA. Vite keeps things simple.

## Why Tailwind CSS 4?

**Chosen:** Tailwind CSS 4 (CSS-based configuration, not `tailwind.config.js`).

Tailwind 4 dropped the JS config file in favour of CSS-based configuration. This simplifies the build pipeline. The tradeoff is that some tooling (e.g., older VS Code extensions) hasn't caught up yet.

## Why shadcn/ui?

**Chosen:** shadcn/ui components copied into `src/components/ui/`.

shadcn/ui gives you the component source code directly — no npm dependency to update or fight with. Components are styled with Tailwind and built on Radix primitives. You own the code and can modify anything.

Note: the `components.json` config file is currently missing (deleted at some point), so `npx shadcn add` won't work until it's re-added. See the refactor plan in `HANDOVER.md`.

## Why Dexie (IndexedDB)?

**Chosen:** Dexie.js wrapping IndexedDB for all domain data.

The app started with `useLocalStorage` for everything. As data grew (hundreds of transactions), localStorage's synchronous 5 MB limit became a problem. Dexie provides:

- Async reads/writes (non-blocking)
- Indexed queries (e.g., transactions by date range)
- Structured schema with versioned migrations
- `useLiveQuery()` for reactive reads

The tradeoff: schema migrations are more involved than localStorage's schema-free approach. See `db.ts` for the version chain.

localStorage is still used for small UI preferences (theme, view state) where reactive IndexedDB queries would be overkill.

## Why Hono?

**Chosen:** Hono framework for the Cloudflare Workers backend.

Hono is lightweight, TypeScript-native, and designed for edge runtimes (Cloudflare Workers, Deno, Bun). It has Express-like ergonomics (middleware, routing) without the Node.js baggage. The alternative was itty-router, but Hono's middleware ecosystem and type safety were more compelling.

## Why passwordless auth?

**Chosen:** Email OTP (one-time password) via Resend.

No passwords to store, hash, or have users forget. The flow:

1. User enters email
2. Server generates 6-digit OTP, stores hash in D1, sends via Resend
3. User enters OTP within 10 minutes
4. Server verifies, issues JWT in httpOnly cookie

Tradeoffs:
- Depends on email delivery (Resend reliability)
- No instant login — user must check email
- Simpler than OAuth (no third-party provider integration)

## Why blob sync instead of per-entity sync?

**Chosen:** Upload/download the entire encrypted budget as a single blob.

The simplest protocol that works: client encrypts everything, uploads one blob, server stores it in R2 with a version number. Optimistic concurrency via `X-Expected-Version` header handles conflicts.

Tradeoffs:
- No partial sync — changing one transaction re-uploads everything
- No collaborative editing — single-writer model
- No server-side queries on user data (it's encrypted)
- But: dead simple to implement, debug, and reason about

## Why client-side encryption?

**Chosen:** PBKDF2 (600,000 iterations) + AES-256-GCM. Encryption happens entirely in the browser.

The server never sees plaintext user data. This is a strong privacy guarantee. The binary format is: `[VERSION(1)] [SALT(16)] [IV(12)] [CIPHERTEXT+GCM_TAG]`.

Tradeoff: if the user forgets their sync passphrase, their cloud backup is irrecoverable. There is no "forgot passphrase" flow. This is by design.

## Why `userId: 'local'`?

All entities have a `userId` field set to the string `'local'`. This was a forward-looking placeholder for multi-user support that hasn't been implemented. The auth system exists for cloud sync, but the app itself is single-user per browser.

Removing `userId` would be a large refactor across every entity and hook. Keeping it as `'local'` is harmless.

## Why Australian financial year defaults?

The default date range is July 1 to June 30 (Australian financial year). The original author is Australian. There's no locale/calendar system yet — it's hardcoded. Currency selection and financial year customization are on the roadmap.

## Why `adjustment` transactions?

Instead of a separate "opening balance" entity, the app uses a Transaction with `type: 'adjustment'`. This keeps the balance calculation simple: sum all transactions. The first-run wizard creates an adjustment transaction for the starting balance.

## Why cadence expansion lives in hooks (not a shared module)?

The cadence expansion logic (turning a rule with cadence into individual dated occurrences) is duplicated across `use-budget-rules.ts`, `use-forecasts.ts`, and `use-multi-period-summary.ts`. A `toMonthlyCents()` utility exists in `utils.ts`, but the full expansion logic hasn't been extracted.

This is a known tech debt item. The logic is similar but not identical across hooks (different entity shapes, different output needs). A refactor to extract a shared `src/lib/cadence.ts` module is planned — see `HANDOVER.md`.

## Why no ORM on the backend?

The Cloudflare D1 backend uses raw SQL strings in service functions. D1's API is simple enough that an ORM adds more complexity than it removes. The downside is no type-safe queries — you're trusting your SQL strings.

## Why React Router 7 (not TanStack Router)?

React Router 7 was chosen because the project started with React Router 6 and the upgrade path was smooth. TanStack Router offers better type safety for route params, but wasn't worth a rewrite.

## Why landing-page-only analytics?

**Chosen:** Self-hosted Plausible, proxied first-party, firing on the landing page and nowhere else.

Three parts of this look like needless complexity from the outside. They aren't, and each is easy to "simplify" back into a mistake.

**Why the app itself isn't measured.** This is a budgeting app. Page paths inside it reveal what someone is doing with their money, and the landing page promises nothing you do inside the app is tracked. The acquisition question — is anyone arriving, and from where — is answerable without touching any of that, so it is.

**Why `script.manual.js` and not an exclusion list.** Plausible's exclusions extension takes a `data-exclude` denylist, and each pattern compiles to an anchored regex — `/transactions` would not have covered `/transactions/new`. Worse, it is fail-open: add a route, forget its exclusion, and the app quietly starts measuring people. The manual variant fires no pageviews on its own, so tracking is fail-closed and a new route cannot leak. `src/lib/analytics.ts` holds the only call.

**Why the first-party proxy.** `netlify.toml` proxies `/pa-stats/*` to the analytics host at status 200. Adblockers can't pattern-match it, but the bigger win is that the script and its events stay same-origin, so `script-src 'self'` and `connect-src 'self'` already cover them and the CSP needs no third-party exception. `data-api` in the script tag is load-bearing for this: without it the script posts to `/api/event` on our own origin, which isn't proxied, and every event vanishes into the SPA fallback.

**Why no custom events.** Pageviews answer the questions that currently exist. Plausible's own SaaS guidance is a four-step funnel, not an event catalogue, and the usual reason to ration events (Cloud bills them like pageviews) doesn't apply to a self-hosted instance — the real cost is events nobody reads. Activation and funnel events can come later if pageviews leave a genuine question open.
