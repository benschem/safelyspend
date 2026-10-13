# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Work Tracking

**Read [`docs/README.md`](docs/README.md) before starting, planning or noting any work.**
It is short, and it is the rule for how work is tracked here.

- `docs/BACKLOG.md` is the only list of work, one line per item, in priority order.
  "Pick up the next thing" means the top line of Now.
- `docs/work/<slug>.md` holds the detail and the plan for one piece of work.
- `docs/reference/` describes the project as it is now. Change it in the same commit
  as the code that makes it untrue.
- Noticed something unrelated while working? Add one line to Inbox at the bottom of
  `docs/BACKLOG.md` and carry on. Do not fix it in the current change.
- Only the maintainer reorders the queue or moves items out of Inbox unless he tells you to explicitly.

## Build and Development Commands

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # Build for production (tsc + vite build)
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
npx prettier --write "src/**/*.{ts,tsx}"  # Format code
```

### Formatting

**Run Prettier on the files you touched before calling any piece of work
done**, as the last step before committing, alongside `npm run lint` and
`npm run build`:

```bash
npx prettier --write src/routes/login.tsx src/components/layout/app-header.tsx
```

`src/` is fully formatted as of `6c4f000`, so this only ever touches lines you
wrote. If Prettier does reformat code you didn't write, something has drifted.
Land that as its own `style:` commit, not inside a feature diff.

Nothing enforces this: there is no pre-commit hook and no CI workflow. Check
what is still unformatted with:

```bash
npx prettier --list-different "src/**/*.{ts,tsx}"
```

## Architecture Overview

A React 19 + TypeScript budgeting app. Local-first: budget data lives in IndexedDB in the browser. An optional account keeps an end-to-end encrypted copy in the cloud, shared by a household, through a Cloudflare Worker in `worker/`. Supports "what-if" scenario planning by separating facts (transactions) from plans (scenarios with rules).

**Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, shadcn/ui, Vite, Dexie. Backend: Hono on Cloudflare Workers, D1, R2.

This section is a summary. `docs/reference/ARCHITECTURE.md` is the full picture.

### Core Concepts

- **Scenarios** contain budget rules and forecast rules (the "plan")
- **The UI says "allowance" for a budget rule and "bill" for a recurring expense.** The code keeps the older names
- **Transactions** are global facts that exist independent of scenarios
- **Date Range** is a view filter - the same transactions can be viewed across different date ranges
- **Cadence-based rules** expand into individual instances over any date range

### Domain Model

All entities have base fields: `id`, `userId`, `createdAt`, `updatedAt`. Amounts stored as integer cents.

#### Global Entities (facts)
- **Category** - Expense categorisation. Has `isArchived` flag.
- **Transaction** - Actual income/expenses/savings/adjustments (`type: 'income' | 'expense' | 'savings' | 'adjustment'`)
- **SavingsGoal** - Global savings targets with `targetAmountCents` and optional `deadline`
- **BalanceAnchor** / **SavingsAnchor** - A known balance on a date, for cash or for one savings goal. A balance is the latest anchor plus the transactions after it
- **CategoryRule** - Import rule that assigns a category to imported transactions

Note: the opening balance is a `BalanceAnchor`. `adjustment` transactions are for manual corrections.

#### Scenario-Scoped Entities (plans)
- **Scenario** - A named set of rules for what-if planning. One is marked `isDefault`.
- **BudgetRule** - Spending limit per category with cadence (weekly, fortnightly, monthly, quarterly, yearly)
- **ForecastRule** - Recurring income/expense/savings patterns with cadence

#### Computed Types
- **ExpandedForecast** - Materialised forecast for a specific date (computed from rules)

### Cadence System

Rules use a `Cadence` type: `'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'`

Forecast rules also say which day they land on:

- `dayOfWeek` (0-6) for weekly/fortnightly
- `dayOfMonth` (1-31) for monthly/quarterly/yearly

A budget rule has a cadence and nothing else. Forecast rules expand over any date range into dated occurrences in `src/lib/cadence.ts`.

### Key Directories

```
src/
├── components/
│   ├── ui/           # shadcn components
│   ├── layout/       # RootLayout, AppHeader, Sidebar
│   ├── dialogs/      # Entity editing dialogs
│   ├── charts/       # Recharts visualisations
│   ├── account/      # Sign-in, signup, recovery and household steps
│   ├── budget/       # Parts of the Budget page
│   ├── cash-flow/    # Parts of the Cash Flow page
│   ├── first-run-wizard.tsx   # Landing page and first-time setup
│   └── check-in-wizard.tsx    # Periodic review
├── contexts/
│   └── what-if-context.tsx    # In-memory What If adjustments
├── hooks/            # One hook per entity, plus hooks that derive figures
│   ├── use-scenarios.ts       # Scenario CRUD + active scenario
│   ├── use-categories.ts, use-transactions.ts, use-savings-goals.ts
│   ├── use-budget-rules.ts    # Allowances
│   ├── use-forecasts.ts       # Income, bills and savings transfers
│   ├── use-balance-anchors.ts, use-savings-anchors.ts
│   ├── use-budget-period-data.ts   # Cash Flow's figures for a period
│   ├── use-reports-data.ts    # Insights and savings figures
│   ├── use-auth.ts, use-sync.ts, use-invites.ts   # Account, cloud sync, household
│   ├── use-app-config.ts      # App initialisation state
│   └── use-view-state.ts      # Date range selection (localStorage)
├── lib/              # Types and pure logic. Calculation belongs here, not in hooks
│   ├── types.ts            # Domain types
│   ├── db.ts               # Dexie database, schema versions, export/import
│   ├── import-schema.ts    # Zod validation for file imports and sync pulls
│   ├── cadence.ts          # Expanding rules into dated occurrences
│   ├── category-limits.ts  # A category's limit: bills due plus allowance
│   ├── bill-set-aside.ts   # Cash already spoken for by bills not yet due
│   ├── envelope.ts, key-management.ts, key-vault.ts, account.ts   # Encryption and keys
│   ├── api-client.ts       # Every call to the worker
│   ├── changelog.ts        # User-facing version history
│   ├── analytics.ts        # Landing page pageview - the only tracking call
│   └── utils.ts            # formatCents, cn, generateId, etc.
├── routes/           # One file or folder per page
│   ├── net-wealth.tsx
│   ├── cash-flow/
│   ├── budget/             # Allowances, bills, income and savings (the plan)
│   ├── scenarios/          # "What If" in the sidebar
│   ├── transactions/
│   ├── categories/         # List of every category, detail page, import rules
│   ├── savings/
│   ├── insights.tsx
│   ├── settings.tsx
│   ├── login.tsx, accept-invite.tsx, household-waiting.tsx   # Outside RootLayout
│   └── privacy.tsx         # Privacy policy (outside RootLayout)
├── __tests__/        # Mirrors src/: lib/, hooks/, routes/
└── App.tsx           # Router configuration
worker/               # Cloudflare Worker: accounts, households, the encrypted vault
docs/                 # See docs/README.md
```

### State Management Pattern

Each entity hook reads its table reactively with `useLiveQuery` and writes straight to Dexie:

```typescript
const rawItems = useLiveQuery(() => db.items.toArray(), []);
const items = useMemo(() => rawItems ?? [], [rawItems]);
const isLoading = rawItems === undefined;
// add: db.items.add({ id: generateId(), userId: 'local', createdAt, updatedAt, ...data })
// update: db.items.update(id, { ...updates, updatedAt: now() })
// delete: db.items.delete(id), plus anything that pointed at it
```

`useLocalStorage` is only for UI preferences such as the date range. Budget data never goes in localStorage.

**Context passing:** RootLayout passes `{ activeScenarioId }` via React Router's outlet context.

### Navigation Structure

- Header: scenario picker and What If controls
- Sidebar:
  - Overview: Net Wealth, Cash Flow
  - Plan: Budget, What If
  - Track: Transactions, Categories, Savings
  - Analyse: Insights
  - Settings
- Landing page footer: link to `/privacy` (rendered outside RootLayout)

### First-Run Wizard

On first launch (when the `appConfig` record in IndexedDB has `isInitialized` false), a wizard prompts for the starting cash balance and saves it as a `BalanceAnchor`. Someone who joins a household skips the wizard: pulling the household's vault marks the device initialised.

### Rules That Load When Relevant

Guidance that only matters for some files lives in `.claude/rules/` and loads when
a matching file is read or edited. It is not repeated here.

- `ui-patterns.md`: cards, `cursor-pointer` and data tables, for anything under
  `src/components/` and `src/routes/`
- `schema-versioning.md`: Dexie schema versions and import compatibility, for
  `src/lib/db.ts`, `src/lib/types.ts` and `src/lib/import-schema.ts`
- `deployment-doc.md`: why `docs/reference/DEPLOYMENT.md` is committed and what must
  never go in it, for that file and `README.md`
- `docs-writing.md`: how to write docs here, for anything under `docs/`, the
  READMEs, this file and the rules themselves. Read it before creating a new doc

### Conventions

- All money amounts stored as cents, displayed with `formatCents()`
- All dates as ISO strings (`YYYY-MM-DD`)
- Timestamps as ISO strings with time
- `userId: 'local'` on every record, a placeholder from before accounts existed. Leave it alone
- Storage keys prefixed with `budget:`
- Australian financial year default (July 1 - June 30)

### Versioning and Changelog

The app is currently in **beta** (0.x.x versions). Version 1.0.0 will mark the stable release.

Uses **semantic versioning** (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes or major redesigns (1.0.0 = stable release)
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes and minor improvements

**The version bump and changelog entry go in the same commit as the change they
describe.** Do not make a separate `chore: bump version` commit. One after every
change is noise, and it leaves the changelog line pointing at a commit that changed
nothing. History up to 2026-10-11 has them separate and is left as it is.

When a user-visible change is ready to stage:
1. Bump the version with `npm version <x.y.z> --no-git-tag-version`, which updates
   `package.json` and `package-lock.json` together without committing or tagging
2. Add an entry to `src/lib/changelog.ts`
3. Stage both with the change. The `currentVersion` export auto-reads from the changelog

**Changelog guidelines:**
- Write for non-technical users (no code jargon)
- Focus on what users can do, not implementation details
- Keep descriptions to one sentence each
- Never include security-sensitive information
- **Do NOT** add changelog entries or bump version for demo persona changes, landing page updates or docs-only commits

**Example changelog entry:**
```typescript
{
  version: '1.2.0',
  date: '2026-02-01',
  changes: [
    'Added ability to set recurring reminders for bills',
    'Improved loading speed on the transactions page',
  ],
}
```

Users can view the changelog via Settings > "View Changelog".

### Git Commit Messages

Use a plain conventional commit type. Do **not** prefix with `claude:`. Commits up to
2026-09-05 carry that prefix and are left as they are.

```
feat: add new feature
fix: fix a bug
chore: maintenance task
refactor: code refactoring
docs: documentation changes
style: formatting changes
```

When asked to commit changes:
1. **Group by feature** - Each commit should be one logical change
2. **Order by dependency** - Commit foundational changes before dependent ones
3. **Keep descriptions brief** - One line of intent, optional body for context
4. **Stage specific files** - Don't use `git add .`, list files explicitly per commit
5. **Use patch mode** - Use `git add -p <file>` to stage partial changes when a file spans multiple features
