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
