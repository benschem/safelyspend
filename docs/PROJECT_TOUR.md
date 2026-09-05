# Project Tour

Start here if you're new to the codebase.

## Start-here files

Read these first, in this order:

1. **`src/lib/types.ts`** — Every domain type. This is the data dictionary.
2. **`src/lib/db.ts`** — Dexie database setup, schema versions, export/import/reset.
3. **`src/App.tsx`** — All route definitions and lazy imports. Shows the shape of the app.
4. **`src/components/layout/root-layout.tsx`** — App shell: init guard, scenario context, WhatIf provider.
5. **`CLAUDE.md`** — Project conventions, build commands, patterns.

## Folder map

```
├── docs/                     # Developer documentation (you are here)
├── public/                   # Static assets
├── src/
│   ├── App.tsx               # Router configuration
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives (button, dialog, etc.)
│   │   ├── layout/           # RootLayout, Sidebar, AppHeader
│   │   ├── first-run-wizard.tsx   # Onboarding / landing page
│   │   ├── check-in-wizard.tsx    # Periodic budget review flow
│   │   ├── demo-banner.tsx        # Banner shown in demo mode
│   │   ├── error-boundary.tsx     # Top-level error boundary
│   │   └── ...               # Feature-specific components
│   ├── contexts/
│   │   └── what-if-context.tsx    # In-memory what-if adjustment layer
│   ├── hooks/
│   │   ├── use-app-config.ts      # App init state (IndexedDB singleton)
│   │   ├── use-scenarios.ts       # Scenario CRUD + active scenario
│   │   ├── use-view-state.ts      # Date range (localStorage)
│   │   ├── use-categories.ts      # Category CRUD
│   │   ├── use-budget-rules.ts    # Budget rules + cadence expansion
│   │   ├── use-forecasts.ts       # Forecast rules + cadence expansion
│   │   ├── use-transactions.ts    # Transaction CRUD + date filtering
│   │   ├── use-savings-goals.ts   # Savings goal CRUD
│   │   ├── use-balance-anchors.ts # Balance anchor CRUD
│   │   ├── use-savings-anchors.ts # Savings anchor CRUD
│   │   ├── use-category-rules.ts  # Auto-categorization rules
│   │   ├── use-sync.ts            # Cloud sync hook
│   │   ├── use-auth.ts            # Auth state hook
│   │   ├── use-multi-period-summary.ts  # Monthly breakdown calculations
│   │   ├── use-cash-surplus.ts    # "Safe to spend" computation
│   │   ├── use-adjusted-values.ts # Read what-if adjusted values
│   │   ├── use-scenario-diff.ts   # Scenario comparison
│   │   ├── use-budget-period-data.ts # Budget vs actual per period
│   │   ├── use-reports-data.ts    # Aggregate data for reports
│   │   ├── use-undo-delete.ts     # Undo delete toast pattern
│   │   ├── use-local-storage.ts   # Base localStorage hook
│   │   └── use-data-date-range.ts # DEAD CODE — see Handover
│   ├── lib/
│   │   ├── types.ts           # Domain types
│   │   ├── db.ts              # Dexie database + schema
│   │   ├── utils.ts           # formatCents, toMonthlyCents, generateId, etc.
│   │   ├── storage-keys.ts    # localStorage key constants
│   │   ├── e2e-crypto.ts      # PBKDF2 + AES-256-GCM encryption
│   │   ├── import-schema.ts   # Zod schemas for import validation + migration
│   │   ├── changelog.ts       # Version history entries
│   │   ├── analytics.ts       # Landing page pageview — the ONLY tracking call
│   │   └── demo/              # Demo persona data generators
│   └── routes/
│       ├── cash-flow/         # Monthly cash flow overview
│       ├── budget.tsx          # Budget rules + plan tab
│       ├── transactions/       # Transaction list + create
│       ├── net-wealth.tsx      # Balances overview
│       ├── categories/         # Category detail + import rules
│       ├── savings/            # Savings goals
│       ├── insights.tsx        # Spending insights
│       ├── scenarios/          # Scenario management
│       ├── settings.tsx        # App settings + data management
│       ├── changelog.tsx       # Version history page
│       ├── privacy.tsx         # Privacy policy (outside RootLayout)
│       └── login.tsx           # Auth login page
├── worker/
│   └── src/
│       ├── index.ts           # Hono app entry: middleware, routes, cron
│       ├── types.ts           # Worker env + Hono context types
│       ├── routes/
│       │   ├── auth.ts        # Auth endpoints (login, verify, session, logout)
│       │   └── vault.ts       # Vault endpoints (upload, download, versions)
│       ├── services/
│       │   ├── auth.ts        # Auth logic: OTP, brute-force protection, lockout
│       │   ├── vault.ts       # Vault logic: versioning, pruning, quota, orphan cleanup
│       │   ├── users.ts       # User record management
│       │   └── email.ts       # Resend email service
│       ├── middleware/
│       │   ├── auth.ts        # JWT verification + session rotation
│       │   └── rate-limit.ts  # D1-backed rate limiting
│       ├── lib/
│       │   ├── errors.ts      # AppError class
│       │   ├── crypto.ts      # JWT + hashing utilities
│       │   └── id.ts          # ID generation
│       └── __tests__/         # Vitest tests for worker
└── Configuration files
    ├── vite.config.ts
    ├── tailwind.config (via Tailwind CSS 4 / CSS-based config)
    ├── tsconfig*.json
    ├── worker/wrangler.toml    # Cloudflare Workers config
    └── eslint.config.js
```

## Top 10 Files

The files you'll touch most often, in rough order of importance:

| # | File | Why it matters |
|---|------|---------------|
| 1 | `src/lib/types.ts` | All domain types. Every entity definition lives here. Read this first. |
| 2 | `src/lib/db.ts` | Dexie database, schema versions, export/import/reset. Change carefully. |
| 3 | `src/components/layout/root-layout.tsx` | App shell: init guard, scenario context, WhatIf provider. |
| 4 | `src/App.tsx` | All route definitions and lazy imports. Add new pages here. |
| 5 | `src/hooks/use-transactions.ts` | CRUD + date filtering for the most-touched entity. |
| 6 | `src/hooks/use-forecasts.ts` | Forecast rule expansion over date ranges (cadence system core). |
| 7 | `src/contexts/what-if-context.tsx` | In-memory what-if adjustment layer. Many components depend on it. |
| 8 | `src/lib/utils.ts` | `formatCents`, `toMonthlyCents`, `generateId`, date helpers. |
| 9 | `worker/src/services/vault.ts` | Vault sync: upload, download, versioning, pruning, quota. |
| 10 | `worker/src/routes/auth.ts` | Auth endpoints: login, verify, session management. |

## How to Add a Feature (Checklist)

### Adding a new entity

1. Define the type in `src/lib/types.ts` (extend `BaseEntity`)
2. Add it to the `BudgetData` aggregate type in `types.ts`
3. Add the Dexie table in `src/lib/db.ts`:
   - Add `Table` property on `BudgetDatabase` class
   - Bump `CURRENT_SCHEMA_VERSION`
   - Add new `this.version(N).stores({...})` block
   - Document in the version history header comment
4. Create a hook in `src/hooks/use-<entity>.ts` following the existing pattern (CRUD via `useLiveQuery`)
5. Add Zod schema in `src/lib/import-schema.ts` for import validation
6. Add to `exportAllData()` / `importAllData()` in `db.ts`
7. Bump `CURRENT_DATA_VERSION` if the export format changes
8. Update `src/lib/changelog.ts` and bump `package.json` version

### Adding a new page/route

1. Create route component in `src/routes/<name>.tsx` (or `src/routes/<name>/index.tsx`)
2. Add lazy route in `src/App.tsx`
3. Add sidebar link in `src/components/layout/sidebar.tsx`
4. The route receives `{ activeScenarioId }` via `useOutletContext()`

### Adding a new field to an existing entity

1. Add the field to the type in `src/lib/types.ts`
2. If the field needs an IndexedDB index: bump schema version in `db.ts` (see schema versioning in `CLAUDE.md`)
3. If the field is non-indexed: no schema change needed (Dexie stores full objects)
4. Update the Zod schema in `src/lib/import-schema.ts` (add as optional for backwards compatibility)
5. Update any hooks that need to handle the new field
6. Update changelog + version

### Adding a UI component

1. For primitives: use `npx shadcn@latest add <component>` (installs to `src/components/ui/`)
2. For feature components: create in `src/components/` near where it's used
3. Follow card patterns from `CLAUDE.md` (hover states, cursor-pointer, arrow icons for navigation)

## Gotchas

Things that will bite you if you don't know about them.

### localStorage vs IndexedDB — why both?

The app migrated from localStorage to IndexedDB (Dexie) for domain data. But some things stayed in localStorage:

- **View state** (date range picker) — small, synchronous reads are fine, and it needs to survive IndexedDB resets
- **Theme** — needs to be read before React mounts to avoid a flash of wrong theme
- **Sync metadata** (version, timestamp) — simple key-value, not worth a Dexie table

If you see `useLocalStorage` in the codebase, it's intentional for these specific cases. All domain data (transactions, rules, etc.) goes through Dexie.

### Analytics is fail-closed on purpose

`src/lib/analytics.ts` has exactly one caller: the landing page. That is not an accident waiting to be tidied up.

The tracker uses Plausible's `manual` script variant, which fires no pageviews by itself, so nothing is measured unless code explicitly asks. Adding a `plausible()` call somewhere else would start measuring what people do inside a budgeting app — which `/privacy` and the landing page footer both promise doesn't happen. If you need in-app measurement, change those promises first. See "Why landing-page-only analytics?" in `DECISIONS.md`.

### Netlify redirect ordering

Redirects in `netlify.toml` are evaluated **before** `public/_redirects`, and the SPA catch-all (`/*` → `/index.html`) matches everything. Any new proxy or redirect rule must go in `netlify.toml` *above* that catch-all, or it will never fire — you'll get the SPA shell with a 200 and no obvious error.

This is why the `/pa-stats/*` analytics proxy lives in `netlify.toml` and why `public/_redirects` was deleted: two sources of redirect truth is what makes the trap invisible.

### End-of-month cadence edge cases

When a rule has `dayOfMonth: 31` and the month only has 30 (or 28/29) days, the expansion logic clamps to the last day of the month:

```typescript
const actualDay = Math.min(targetDay, getLastDayOfMonth(year, month));
```

This means a "31st of every month" rule fires on the 28th in February, the 30th in April, etc. This is correct behavior, but it can surprise you in tests.

### Fortnightly cadence alignment

Fortnightly rules anchor to their `startDate` to maintain consistent two-week cycles. Without this, changing the query date range would shift which days the fortnightly rule fires on. If a rule has no `startDate`, it falls back to a fixed anchor of January 1, 2020.

### Demo data is procedural, not static

The demo personas in `src/lib/demo/` generate data relative to today's date. Transactions, balances, and forecasts are all computed dynamically. There is no `fixtures.json` to update — if you change the generators, the demo data changes everywhere.

### `components.json` is missing

The shadcn/ui config file was deleted. This means `npx shadcn@latest add <component>` won't work. You can either:
- Re-run `npx shadcn@latest init` (choose "no" to overwrite prompts)
- Or manually copy component source from the shadcn/ui docs into `src/components/ui/`

### The WhatIfContext shape

`WhatIfContext` stores adjustments as four separate `Record<string, number>` maps:
- `incomeAdjustments` — keyed by forecast rule ID
- `budgetAdjustments` — keyed by category ID (not rule ID!)
- `fixedExpenseAdjustments` — keyed by forecast rule ID
- `savingsAdjustments` — keyed by forecast rule ID

The asymmetry (budget adjustments keyed by category, everything else by rule) exists because a category has exactly one budget rule, so the category ID is the natural key for UI interactions.

### Two different "cadence expansion" patterns

`use-budget-rules.ts` and `use-forecasts.ts` both expand cadence-based rules, but differently:

- **Budget rules** (`countOccurrences`) — returns a count of occurrences, multiplied by the per-occurrence amount. Simple arithmetic, no date list.
- **Forecast rules** (`expandRule`) — returns an array of `ExpandedForecast` objects with specific dates. Full materialization.

This is because budget rules only need a total ("$500/month over 3 months = $1500"), while forecast rules need individual dated entries for the forecast timeline.

### Import validation is the safety net

`src/lib/import-schema.ts` validates all imported data (from JSON files and from cloud sync pulls). It uses Zod schemas and includes migration logic for old export formats. If you add a new entity field, add it as **optional** in the Zod schema — otherwise old exports will fail validation.

### The `userId: 'local'` constant

Every entity hook has `const USER_ID = 'local'` at the top. This is a placeholder for future multi-user support. Don't remove it or change it — it's baked into all existing data.

## Build & Dev Commands

See [DEVELOPMENT.md](./DEVELOPMENT.md) for full setup instructions, commands, testing, and deployment.
