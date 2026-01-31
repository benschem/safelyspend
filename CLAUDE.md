# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # Build for production (tsc + vite build)
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
npx prettier --write "src/**/*.{ts,tsx}"  # Format code
```

## Architecture Overview

A React 19 + TypeScript budgeting app with local-only persistence. Supports "what-if" scenario planning by separating facts (transactions) from plans (scenarios with rules).

**Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, shadcn/ui, Vite

### Core Concepts

- **Scenarios** contain budget rules and forecast rules (the "plan")
- **Transactions** are global facts that exist independent of scenarios
- **Date Range** is a view filter - the same transactions can be viewed across different date ranges
- **Cadence-based rules** expand into individual instances over any date range

### Domain Model

All entities have base fields: `id`, `userId`, `createdAt`, `updatedAt`. Amounts stored as integer cents.

#### Global Entities (facts)
- **Category** - Expense categorisation. Has `isArchived` flag.
- **Transaction** - Actual income/expenses/savings/adjustments (`type: 'income' | 'expense' | 'savings' | 'adjustment'`)
- **SavingsGoal** - Global savings targets with `targetAmountCents` and optional `deadline`

Note: `adjustment` transactions are used for opening balance and manual corrections.

#### Scenario-Scoped Entities (plans)
- **Scenario** - A named set of rules for what-if planning. One is marked `isDefault`.
- **BudgetRule** - Spending limit per category with cadence (weekly, fortnightly, monthly, quarterly, yearly)
- **ForecastRule** - Recurring income/expense/savings patterns with cadence
- **ForecastEvent** - One-off forecast items with specific dates

#### Computed Types
- **ExpandedForecast** - Materialised forecast for a specific date (computed from rules + events)

### Cadence System

Rules use a `Cadence` type: `'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'`

- `dayOfWeek` (0-6) for weekly/fortnightly
- `dayOfMonth` (1-31) for monthly/quarterly/yearly

Rules expand over any date range to calculate totals or generate individual occurrences.

### Key Directories

```
src/
├── components/
│   ├── ui/           # shadcn components
│   └── layout/       # Header, Sidebar, RootLayout
├── hooks/
│   ├── use-local-storage.ts   # Base persistence hook
│   ├── use-app-config.ts      # App initialisation state
│   ├── use-scenarios.ts       # Scenario CRUD + active scenario
│   ├── use-view-state.ts      # Date range selection (defaults to AU financial year)
│   ├── use-categories.ts
│   ├── use-budget-rules.ts    # Budget rules with cadence expansion
│   ├── use-forecasts.ts       # Forecast rules + events + expansion
│   ├── use-transactions.ts    # Date range filtering
│   └── use-savings-goals.ts
├── routes/
│   ├── dashboard.tsx
│   ├── forecast/           # View expanded forecasts, add one-off events
│   ├── budget.tsx
│   ├── transactions/
│   ├── categories/
│   ├── savings/
│   ├── manage/scenarios/   # Scenario CRUD, duplicate with rules
│   ├── manage/rules/       # Forecast rule CRUD
│   └── settings.tsx
├── lib/
│   ├── types.ts      # Domain types
│   └── utils.ts      # formatCents, cn, generateId, etc.
└── App.tsx           # Router configuration
```

### State Management Pattern

Each entity hook wraps `useLocalStorage` and provides CRUD operations:

```typescript
const [items, setItems] = useLocalStorage<Type[]>('budget:key', []);
// add: creates with generateId(), userId, createdAt, updatedAt
// update: maps and sets updatedAt
// delete: filters
```

**Context passing:** RootLayout passes `{ activeScenarioId, startDate, endDate }` via React Router's outlet context.

### Navigation Structure

- Header: Scenario selector + Date range picker
- Sidebar:
  - Dashboard (Overview)
  - Plan: Forecasts, Budgets
  - Track: Transactions, Categories, Savings
  - Manage: Categories, Scenarios, Forecast Rules
  - Settings

### First-Run Wizard

On first launch (when `budget:appConfig.isInitialized` is false), a wizard prompts for initial spending balance. This creates an `adjustment` transaction for the opening balance.

### UI Component Patterns

#### Cards

Base card style: `rounded-lg border bg-card p-4` (or `rounded-xl` and `p-5` for larger cards)

**Clickable card that navigates (Link):**
```tsx
<Link
  to="/some-page"
  className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
>
  {/* Card content */}
  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
</Link>
```

**Clickable card that opens dialog/modal (no navigation):**
```tsx
<button
  type="button"
  onClick={handleClick}
  className="w-full cursor-pointer text-left rounded-lg transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  {/* Card content - NO arrow icon */}
</button>
```

**Static/disabled card:**
```tsx
<div className="rounded-xl border bg-card p-5 opacity-50">
  {/* Card content */}
</div>
```

Key principles:
- Use `hover:bg-muted/50` for interactive cards (not ring/shadow)
- Arrow icon only for cards that navigate to another page
- No arrow for cards that open dialogs/modals
- Use `group` class to show/hide arrow on hover

#### Interactive Elements

**All clickable elements must have `cursor-pointer`** to provide clear visual feedback that the element is interactive. This applies to:
- Native `<button>` elements (add `cursor-pointer` class explicitly)
- Icons with `onClick` handlers
- Custom toggle buttons, legend items, tab controls
- Any element that responds to click events

Exception: shadcn `<Button>` component and `<Link>` elements already have proper cursor styling built-in.

```tsx
// Native button - always add cursor-pointer
<button
  onClick={handleClick}
  className="cursor-pointer rounded px-2 py-1 hover:bg-muted"
>
  Click me
</button>

// Icon with onClick - add cursor-pointer
<X
  className="h-4 w-4 cursor-pointer opacity-50 hover:opacity-100"
  onClick={handleClose}
/>

// shadcn Button - cursor-pointer is built-in (no need to add)
<Button onClick={handleClick}>Click me</Button>
```

### Conventions

- All money amounts stored as cents, displayed with `formatCents()`
- All dates as ISO strings (`YYYY-MM-DD`)
- Timestamps as ISO strings with time
- `userId: 'local'` placeholder for future multi-user
- Storage keys prefixed with `budget:`
- Australian financial year default (July 1 - June 30)

### Schema Versioning

The app uses Dexie (IndexedDB) with versioned schema migrations. **Always consider data migration when making changes.**

**Version numbers:**
- `CURRENT_SCHEMA_VERSION` in `src/lib/db.ts` - IndexedDB schema version
- `CURRENT_DATA_VERSION` in `src/lib/db.ts` - Export/import format version
- `package.json` version - App version for users

**When adding new fields to entities:**

1. **Non-indexed fields** (most cases): Just add to `types.ts` and `import-schema.ts`. No schema version bump needed - Dexie stores full objects.

2. **New indexed fields**: Bump `CURRENT_SCHEMA_VERSION` and add a new `this.version(N)` block in db.ts.

3. **Breaking changes to existing fields**: Requires migration. Add `.upgrade()` function to the new version block.

**Example - Adding a new schema version:**
```typescript
// In db.ts constructor
this.version(2).stores({
  // Only specify tables/indexes that changed
  forecastRules: 'id, scenarioId, newIndexedField',
}).upgrade(tx => {
  return tx.table('forecastRules').toCollection().modify(rule => {
    rule.newField = rule.newField ?? 'default';
  });
});
```

**For import compatibility:**
- Add new optional fields to schemas in `import-schema.ts`
- Add migration logic in `migrateImportData()` if format changes
- Bump `CURRENT_DATA_VERSION` if export format changes

### Versioning and Changelog

The app is currently in **beta** (0.x.x versions). Version 1.0.0 will mark the stable release.

Uses **semantic versioning** (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes or major redesigns (1.0.0 = stable release)
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes and minor improvements

**After each commit, you must:**
1. Update `package.json` version appropriately
2. Add an entry to `src/lib/changelog.ts`
3. The `currentVersion` export auto-reads from the changelog

**Changelog guidelines:**
- Write for non-technical users (no code jargon)
- Focus on what users can do, not implementation details
- Keep descriptions to one sentence each
- Never include security-sensitive information
- Don't add to changelog until changes are committed
- **Do NOT** add changelog entries or bump version for demo persona changes or landing page updates

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

Prefix all commits with `claude:` followed by a conventional commit type:

```
claude: feat: add new feature
claude: fix: fix a bug
claude: chore: maintenance task
claude: refactor: code refactoring
claude: docs: documentation changes
claude: style: formatting changes
```

When asked to commit changes:
1. **Group by feature** - Each commit should be one logical change
2. **Order by dependency** - Commit foundational changes before dependent ones
3. **Keep descriptions brief** - One line of intent, optional body for context
4. **Stage specific files** - Don't use `git add .`, list files explicitly per commit
5. **Use patch mode** - Use `git add -p <file>` to stage partial changes when a file spans multiple features
