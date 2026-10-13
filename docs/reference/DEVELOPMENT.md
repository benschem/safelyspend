# Development Guide

How to set up, run and test SafelySpend, and what to know before changing it. Deploying is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Where to start

Read these first, in this order:

1. **`src/lib/types.ts`**: every domain type. This is the data dictionary.
2. **`src/lib/db.ts`**: the Dexie database, its schema versions, and export, import and reset.
3. **`src/App.tsx`**: every route and its lazy import. Shows the shape of the app.
4. **`src/components/layout/root-layout.tsx`**: the app shell: the first-run guard, the scenario context and the What If provider.
5. **`CLAUDE.md`**: commands, conventions and patterns.

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the parts fit together. Work is tracked in [`docs/BACKLOG.md`](../BACKLOG.md); [`docs/README.md`](../README.md) says how.

## Prerequisites

- Node.js 20+
- npm 10+
- A Cloudflare account, for deploying the worker only. Not needed for frontend work.

## Frontend setup

```bash
git clone <repo-url>
cd safelyspend
npm install

npm run dev
# → http://localhost:5173
```

That is all frontend work needs. The app runs fully offline on IndexedDB; the backend only matters for accounts and cloud sync.

One expected error in the dev console: the analytics script at `/pa-stats/js/script.manual.js` fails to load. The `/pa-stats/*` proxy is a Netlify redirect, so it only exists on a deployed site. It is harmless, and no analytics are sent from local development.

### Frontend commands

- `npm run dev`: Vite dev server with hot reload
- `npm run build`: production build (`tsc -b`, then `vite build`)
- `npm run preview`: serve the production build locally
- `npm run lint`: ESLint
- `npm run test`: Vitest in watch mode
- `npm run test:run`: Vitest, one run
- `npx prettier --write <files>`: format the files you touched

## Worker setup

The backend is a Cloudflare Worker in `worker/`. It is only needed for work on accounts, households or cloud sync.

```bash
cd worker
npm install
```

### Settings and secrets

Bindings and plain settings are in `worker/wrangler.toml`. Secrets are set with `wrangler secret put` and never stored in the repo.

- `DB`: the D1 database binding
- `VAULT_BUCKET`: the R2 bucket binding
- `ENVIRONMENT`: `"production"` or `"development"`
- `FROM_EMAIL`: the sender address for login codes and invites
- `APP_URL`: the frontend's address, used for CORS and for links in emails
- `JWT_SECRET`: secret for signing session tokens
- `JWT_SECRET_PREVIOUS`: the previous secret, optional, set while rotating
- `RESEND_API_KEY`: from the [Resend](https://resend.com) dashboard

### Run the worker locally

The worker reads its local settings from `worker/.dev.vars`, which is gitignored. Create it once from the example and fill in the two secrets:

```bash
cd worker
cp .dev.vars.example .dev.vars
```

Values in `.dev.vars` replace the `[vars]` of the same name in `wrangler.toml`, so the production values there stay untouched. It sets `ENVIRONMENT` to `"development"`, which allows CORS from `localhost:5173`, and `APP_URL` to the Vite dev server, so emailed invite links point at your local app and not the production site.

Then apply the schema to the local database and start the worker:

```bash
npm run db:migrate:local
npm run dev
# → http://localhost:8787
```

There is one migration, `worker/migrations/0001_initial.sql`.

The frontend needs no setup: `.env.development` points `npm run dev` at `http://localhost:8787`. The same `VITE_API_URL` fills the `connect-src` of the Content-Security-Policy in `index.html`, so the page may call whichever API it is pointed at and no other. `.env.production` holds the live address for builds.

The session cookie is `Secure`. Chrome and Firefox accept that on `http://localhost`; Safari may not, so sign-in can appear to do nothing there.

`RESEND_API_KEY` must be a working key: login codes and invites are sent as real emails, even locally.

### Scheduled tasks

The worker has a daily cron (`0 3 * * *` UTC) that cleans up orphaned R2 objects. It is set in `wrangler.toml` under `[triggers]` and runs once deployed.

## Testing

### Frontend tests

In `src/__tests__/`, in `lib/`, `hooks/` and `routes/` folders that mirror `src/`. They use Vitest, with `happy-dom` and React Testing Library's `renderHook` for hooks.

```bash
npm run test        # watch mode
npm run test:run    # one run
```

Covered: the pure logic in `src/lib/` (cadence, category limits, bills set aside, imports, the crypto and account code) and several hooks.

Not covered: nothing renders a component, so routes, dialogs and wizards have no tests. Logic that lives inside a component is untested until it is pulled out into a function.

### Worker tests

In `worker/src/__tests__/`. They have their own Vitest config and do not run from the root:

```bash
cd worker
npm run test:run
npm run typecheck
```

### Writing new tests

- Put a test in `src/__tests__/<folder>/` or `worker/src/__tests__/`, named `<module>.test.ts`.
- Import what is being tested from `@/lib/...` or `@/hooks/...`. A test that defines its own copy of the logic guards nothing.
- A test goes in the same commit as the code it tests.

## How to add things

### A new entity

1. Define the type in `src/lib/types.ts`, extending `BaseEntity`, and add it to the `BudgetData` type.
2. Add the Dexie table in `src/lib/db.ts`: the `Table` property, a new `this.version(N).stores({...})` block, a bumped `CURRENT_SCHEMA_VERSION`, and a line in the version history comment.
3. Add a hook in `src/hooks/use-<entity>.ts`, following the existing ones (reads through `useLiveQuery`).
4. Add its Zod schema to `src/lib/import-schema.ts`.
5. Add it to `exportAllData()`, `importAllData()`, `resetDatabase()` and `loadDemoData()` in `db.ts`.
6. Bump `CURRENT_DATA_VERSION` if the export format changed.

### A new field on an existing entity

1. Add it to the type in `src/lib/types.ts`.
2. Add it to the Zod schema in `src/lib/import-schema.ts`, as optional so older exports still load. Miss this and every sync pull silently strips the field.
3. If it needs an index, bump the schema version in `db.ts`. If not, no schema change is needed: Dexie stores whole objects.

### A new page

1. Create the component in `src/routes/<name>.tsx` or `src/routes/<name>/index.tsx`.
2. Add a lazy route in `src/App.tsx`.
3. Add a link in `src/components/layout/sidebar.tsx`.
4. The route gets `{ activeScenarioId }` through `useOutletContext()`.

### A UI component

- Primitives live in `src/components/ui/` and come from shadcn/ui. `components.json` is missing, so `npx shadcn@latest add` does not work until it is put back; until then, copy the component source in by hand.
- Feature components go in `src/components/`, near where they are used.

Any change a user can see also needs a version bump and a changelog entry. `CLAUDE.md` says how.

## Gotchas

### localStorage and IndexedDB, and why both

Budget data moved from localStorage to IndexedDB. A few things stayed behind on purpose:

- **View state** (the date range picker): small, and it should survive a database reset.
- **Theme**: has to be read before React mounts, or the wrong theme flashes.
- **Sync bookkeeping** (version, timestamp): two values, not worth a table.

`useLocalStorage` is for those. All budget data goes through Dexie.

### Analytics is fail-closed on purpose

`src/lib/analytics.ts` has one caller, the landing page, and should keep one.

The tracker uses Plausible's `manual` script, which fires no pageviews by itself, so nothing is measured unless code asks. A `plausible()` call anywhere else would start measuring what people do inside a budgeting app, which `/privacy` and the landing page footer both promise does not happen. See "Why landing-page-only analytics?" in [DECISIONS.md](DECISIONS.md).

### Netlify redirect ordering

Redirects in `netlify.toml` are matched in order, and the SPA catch-all (`/*` to `/index.html`) matches everything. Any new proxy or redirect must sit above that catch-all or it never fires: you get the app shell with a 200 and no error.

This is why the `/pa-stats/*` analytics proxy lives in `netlify.toml`, and why `public/_redirects` was deleted. Two places to define redirects is what makes the trap invisible.

### A rule on the 31st

When a rule has `dayOfMonth: 31` and the month is shorter, expansion clamps to the month's last day: the 28th in February, the 30th in April. This is intended, and it can surprise you in a test. The logic and its tests are in `src/lib/cadence.ts`.

### Fortnightly rules need an anchor

A fortnightly rule counts its fortnights from its `startDate`, so the days it lands on do not shift with the date range being viewed. With no `startDate` it counts from the first matching weekday of January 2020, which may or may not be the right week.

### Demo data is generated, not stored

The personas in `src/lib/demo-personas/` generate data relative to today's date. There is no fixture file to update: change a generator or a persona and the demo changes everywhere.

### Import validation is the safety net

`src/lib/import-schema.ts` validates everything that comes in, from JSON files and from every cloud sync pull, and migrates older export formats. Zod drops keys a schema does not list, so the schema has to keep up with `types.ts`.

### `userId: 'local'`

Every entity hook writes `userId: 'local'`. It is a placeholder from before accounts existed and is in all existing data. Leave it alone. See [DECISIONS.md](DECISIONS.md).

## Common tasks

### Inspecting IndexedDB

Browser DevTools, then Application, IndexedDB, `BudgetApp`. Every table and record is visible.

### Resetting app state

In the app: Settings, then Delete All Data. Or in the console:

```js
// Clears IndexedDB only (keeps theme and view preferences)
indexedDB.deleteDatabase('BudgetApp');
location.reload();
```

### Trying it with demo data

On the landing page, choose the demo. The data is generated relative to today, so dates and amounts vary.

### Testing cloud sync locally

1. Create `worker/.dev.vars` with a working `RESEND_API_KEY`.
2. Apply the schema locally: `cd worker && npm run db:migrate:local`.
3. Start the worker: `cd worker && npm run dev`.
4. Start the frontend: `npm run dev`. It already points at `localhost:8787`.

Testing an invite needs two browsers, or one and a private window, and two real mailboxes.
