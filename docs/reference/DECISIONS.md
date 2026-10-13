# Decisions

Mini ADRs (Architecture Decision Records) for choices that aren't obvious from reading the code.

## Why Vite?

**Chosen:** Vite with React plugin.

Fast HMR during development, fast production builds. No special configuration needed for the stack (React, TypeScript, Tailwind). The alternative was Next.js, but a local-first SPA has no use for server-side rendering.

## Why Tailwind CSS 4?

**Chosen:** Tailwind CSS 4 (CSS-based configuration, not `tailwind.config.js`).

Tailwind 4 dropped the JS config file in favour of CSS-based configuration. This simplifies the build pipeline. The tradeoff is that some tooling (e.g., older VS Code extensions) hasn't caught up yet.

## Why shadcn/ui?

**Chosen:** shadcn/ui components copied into `src/components/ui/`.

shadcn/ui copies the component source into the repo, so there is no npm dependency to update. Components are styled with Tailwind, built on Radix primitives, and ours to edit.

The `components.json` config file is missing, so `npx shadcn add` won't work until it is put back. Putting it back is a line in `docs/BACKLOG.md`.

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

## Why an email code and a password?

**Chosen:** a six-digit code sent by email, then a proof of the password. Signing in needs both.

The first version was passwordless: the emailed code was the whole login. That stopped being enough once the password became what unlocks the encrypted vault. Two things follow from having one:

- **The password has to exist anyway.** It derives the key that unwraps the household's key. The server never sees it.
- **Control of a mailbox alone should not open a session.** So after the code, the browser derives a second, independent value from the password with Argon2id and the server compares it with a stored verifier. `crypto-design.md` §3.3 has the detail.

The email code stays because it proves the address, which is what invites and recovery are sent to.

Tradeoffs:
- Depends on email delivery (Resend)
- No instant login: every sign-in means checking email
- Simpler than OAuth, with no third-party provider

### The accepted exception: resetting a forgotten password

Someone who has forgotten their password cannot produce the proof, so the recovery path skips it and issues a restricted session. The server cannot check that the recovery phrase was really used. A person who controls the mailbox can therefore set a new password, sign in, and overwrite or delete the cloud copy. They cannot read it.

Accepted by the maintainer on 2026-10-13, with no stronger proof planned: this is the email password reset most apps offer, and better in that nothing is disclosed. `api-design.md` §3.9 describes the mechanism.

## Why blob sync instead of per-entity sync?

**Chosen:** Upload/download the entire encrypted budget as a single blob.

The simplest protocol that works: client encrypts everything, uploads one blob, server stores it in R2 with a version number. Optimistic concurrency via `X-Expected-Version` header handles conflicts.

Tradeoffs:
- No partial sync: changing one transaction re-uploads everything
- No merge: two people in a household share the blob, and when both have edited, one side's changes are replaced
- No server-side queries on user data (it's encrypted)
- Simple to implement, debug and reason about

## Why client-side encryption?

**Chosen:** AES-256-GCM under a wrapped household key, with Argon2id deriving the keys that wrap it. Encryption happens entirely in the browser. `crypto-design.md` is the specification.

The server never sees plaintext budget data.

The first format derived the key straight from a sync passphrase with PBKDF2. It was replaced by the wrapped-key scheme so that two people can share one vault, each unlocking it with their own password, and so that a password can be changed or reset without re-encrypting anything.

Tradeoff: someone who loses both their password and their twelve-word recovery phrase cannot get their cloud copy back, and nobody can do it for them.

## Why one household per user, and no leaving?

**Chosen:** a user belongs to exactly one household, enforced by `UNIQUE(household_members.user_id)`. There is no way to leave a household or remove a member. Deleting the account is the only exit.

- **One household** keeps the session, the vault and the UI free of a switcher. Nobody has asked for two.
- **No leaving**, because a member who leaves still knows the household's key. Doing it properly means generating a new key and re-wrapping it for everyone who stays, which has not been designed.

Someone who signs up on their own gets their own household, and cannot then accept an invite to another.

## Why are the session and the keys separate?

**Chosen:** the session cookie and the in-memory keys have independent lifetimes. The session lasts days. The keys live in memory until the tab closes or the app is locked. Logging out clears the server session and does not touch the keys; locking clears the keys and leaves the session.

A returning tab with a live session only needs the password to unwrap the keys again, with no email code and no call that the server could refuse.

## Why isn't IndexedDB encrypted at rest?

**Chosen:** leave it in plaintext. Designed in full (`crypto-design.md` §5), then parked on 2026-09-06 without being started. It may never happen.

The threat it closes is narrow. FileVault and BitLocker are on by default, so a stolen powered-off laptop is already covered. Another OS account cannot read your browser profile. Malware running as you can read IndexedDB, but it can equally keylog the password you would type to unlock it. What is left is someone with read access to your browser profile while the app is locked, who cannot also read memory or keystrokes.

It does nothing for privacy inside a household. Both members hold the same household key and sit inside the encryption boundary.

The cost is the highest in the project. Whole-store encryption turns Dexie from a queryable database into a blob decrypted on unlock, and `useLiveQuery` plus the date-range indexes are what every hook in `src/hooks/` is built on. The per-row fallback keeps queries working but leaks index keys (dates, category ids, scenario ids) in plaintext, which is most of the shape of someone's finances even without the amounts.

**Consequences of leaving it parked:**

- There is no local unlock, because nothing is locked. The account password's only job is wrapping the keys for the cloud vault.
- Local data is plaintext on disk and the privacy page says so. "Your data stays on your device" is still true and is a different claim.

**What would change the answer:** shared or managed devices, a real user base beyond people who chose this app for its privacy story, or Dexie gaining encrypted indexes so the cost stops being architectural.

## Why `userId: 'local'`?

All entities have a `userId` field set to the string `'local'`. This was a forward-looking placeholder for multi-user support. Accounts and households now exist, but they share one vault, and records in it are not attributed to a person.

Removing `userId` would be a large refactor across every entity and hook. Keeping it as `'local'` is harmless.

## Why Australian financial year defaults?

The default date range is July 1 to June 30 (Australian financial year). The original author is Australian. There is no locale or calendar system yet, so it is hardcoded. Currency selection and a configurable financial year are on the wishlist in `docs/BACKLOG.md`.

## Why `adjustment` transactions?

A Transaction with `type: 'adjustment'` records a manual correction to the balance without calling it income or spending.

It used to carry the opening balance as well, so that a balance was simply the sum of every transaction. That job moved to balance anchors: the first-run wizard saves the starting balance as a `BalanceAnchor`, and a balance is the latest anchor plus the transactions after it. An anchor can be set again at any time, which forgives whatever drift built up before it.

## Why does the Categories page have no Add Category and no spending figures?

A category is made where it is first used: the category picker creates one when an allowance, a bill or a transaction is added. A separate Add Category would make categories that nothing uses.

The page (`src/routes/categories/index.tsx`) is for housekeeping: renaming, archiving and deleting. Cash Flow and the category detail page answer how a category is going, so the list shows what is planned for each category and not what was spent.

## Why are scenarios plain plans, with no sliders and no comparison?

**Chosen:** a scenario is a named set of rules that can be copied, edited and switched between. Amounts change only through the edit dialogs, and a page shows the selected scenario's own figures. The violet header is the only sign that a scenario other than the default is showing.

Up to 0.49 the Budget page had a slider on every row, held in memory as "What If" adjustments, and every page showed violet differences from the default plan. Both were removed between 0.50.0 and 0.53.0.

- **People would not touch the sliders.** They could not tell whether moving one would change their figures. Moving one stored nothing, but the header then offered Save on any scenario, the default included, which wrote the adjusted amounts over the real rules.
- **Every figure had to be right three times:** on the default plan, on another scenario, and with sliders moved. Rows that ignored the sliders and differences that compared a dated month with a monthly average were both found this way.

The way to ask "can we afford this?" is to copy a scenario and edit the copy. Safe to spend, tracked in `docs/BACKLOG.md`, is meant to answer it more directly.

## Why does calculation live in `src/lib/`, not in hooks?

**Chosen:** anything that works out a number is a pure function in `src/lib/`, and hooks only fetch data and call it.

Cadence expansion used to be written separately inside three hooks, and the copies drifted. It now lives in `src/lib/cadence.ts`, a category's limit in `src/lib/category-limits.ts`, and the bills reserve in `src/lib/bill-set-aside.ts`, each with tests.

The reason is testing. A function can be tested with plain inputs; logic inside a hook or a component needs a database and a renderer, so in practice it goes untested. The same figure worked out in two places is also how screens come to disagree.

Not everything has moved yet. Balance and date handling are still spread across hooks and routes; `docs/BACKLOG.md` tracks them.

## Why no ORM on the backend?

The Cloudflare D1 backend uses raw SQL strings in service functions. D1's API is simple enough that an ORM adds more complexity than it removes. The downside is that queries are not type-checked.

## Why signup spends the bridge token outside the batch

D1 rolls a batch back only when a statement raises an error. A guarded `UPDATE` that matches no rows succeeds with zero changes, and the statements after it still apply. Spending the bridge token inside the signup batch would therefore let a signup apply against a token already used. The token is spent first, in its own `UPDATE ... RETURNING`, and inside the batch a replay is stopped by primary keys and unique indexes. The cost is that a failure after the spend means a fresh code. `api-design.md` §6.1 has the detail.

## Why React Router 7 (not TanStack Router)?

React Router 7 was chosen because the project started with React Router 6 and the upgrade path was smooth. TanStack Router offers better type safety for route params, but wasn't worth a rewrite.

## Why landing-page-only analytics?

**Chosen:** Self-hosted Plausible, proxied first-party, firing on the landing page and nowhere else.

Three parts of this look like needless complexity, and simplifying any of them breaks something.

**Why the app itself isn't measured.** This is a budgeting app. Page paths inside it reveal what someone is doing with their money, and the landing page promises nothing you do inside the app is tracked. Whether anyone is arriving, and from where, can be answered without touching any of that.

**Why `script.manual.js` and not an exclusion list.** Plausible's exclusions extension takes a `data-exclude` denylist, and each pattern compiles to an anchored regex, so `/transactions` would not have covered `/transactions/new`. It is also fail-open: add a route, forget its exclusion, and the app starts measuring people. The manual variant fires no pageviews on its own, so tracking is fail-closed and a new route cannot leak. `src/lib/analytics.ts` holds the only call.

**Why the first-party proxy.** `netlify.toml` proxies `/pa-stats/*` to the analytics host at status 200. Adblockers can't pattern-match it. The script and its events also stay same-origin, so `script-src 'self'` and `connect-src 'self'` already cover them and the CSP needs no third-party exception. This depends on `data-api` in the script tag: without it the script posts to `/api/event` on our own origin, which isn't proxied, and every event vanishes into the SPA fallback.

**Why no custom events.** Pageviews answer the questions that currently exist. Plausible's own SaaS guidance is a four-step funnel, not an event catalogue. The usual reason to ration events (Cloud bills them like pageviews) doesn't apply to a self-hosted instance; the cost is events nobody reads. Activation and funnel events can come later if pageviews leave a question open.

## Why there is no v0.37 → v2 migration

**Chosen:** wipe production and start the schema clean, with no migration.

The auth rewrite originally carried a whole phase for migrating
existing cloud-sync users off the passphrase-derived vault format. Before designing
against it, production was checked: `users` held four rows, all of them the
maintainer's own testing, and `sync_state` was empty. No vault had ever been uploaded,
so R2 held nothing either.

The migration path was already designed, and was deleted anyway. Keeping it would
mean a second codepath that every future change has to keep working, exercised only
by data that does not exist.

What the deletion bought, beyond dropping one phase: no `schema_version` tombstone on
`users`, no `sv` JWT claim, no dual v1/v2 branch on the vault routes, no vestigial
`user_id` column on `vaults`, and a flat "reject any blob not starting with `0x02`"
rule in place of per-user version state. `src/lib/e2e-crypto.ts` also stopped being
dangerous to touch, since the format it implements has never encrypted a stored byte.

What was given up is prior art. If a format v3 ever ships there will be a live fleet,
and anti-downgrade protection becomes a requirement. The deleted design is in git
history: see commits `9df23fa` and `1c81392`.

## Where the auth rewrite's phase docs went

The rewrite that added passwords, recovery phrases and households was planned and built
from a folder of phase documents, `docs/auth-rewrite/`. Once it was built they
described how it was built and no longer what exists, and on 2026-10-13 they were
deleted.

- The backend design survives as `api-design.md`, because it is still the only full
  description of the API.
- The one unbuilt phase, personal spending money, survives as
  `docs/work/household-personal-money.md`.
- Everything else is in git history, under `docs/auth-rewrite/`, up to commit `ae63e9b`.
  `07_invite_flow.md` there holds a ready design for letting someone who signed up
  without their invite link still join.
