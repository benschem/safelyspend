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
- **Account** - Bank accounts with `openingBalanceCents` and `openingDate`
- **Category** - Expense categorization. Has `isArchived` flag.
- **Transaction** - Actual income/expenses/savings (`type: 'income' | 'expense' | 'savings'`)
- **Transfer** - Movement between accounts
- **SavingsGoal** - Global savings targets with `targetAmountCents` and optional `deadline`

#### Scenario-Scoped Entities (plans)
- **Scenario** - A named set of rules for what-if planning. One is marked `isDefault`.
- **BudgetRule** - Spending limit per category with cadence (weekly, fortnightly, monthly, quarterly, yearly)
- **ForecastRule** - Recurring income/expense/savings patterns with cadence
- **ForecastEvent** - One-off forecast items with specific dates

#### Computed Types
- **ExpandedForecast** - Materialized forecast for a specific date (computed from rules + events)

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
│   ├── use-scenarios.ts       # Scenario CRUD + active scenario
│   ├── use-view-state.ts      # Date range selection (defaults to AU financial year)
│   ├── use-accounts.ts
│   ├── use-categories.ts
│   ├── use-budget-rules.ts    # Budget rules with cadence expansion
│   ├── use-forecasts.ts       # Forecast rules + events + expansion
│   ├── use-transactions.ts    # Date range filtering
│   ├── use-transfers.ts
│   └── use-savings-goals.ts
├── routes/
│   ├── dashboard.tsx
│   ├── forecast/           # View expanded forecasts, add one-off events
│   ├── budget.tsx
│   ├── transactions/
│   ├── categories/
│   ├── savings/
│   ├── manage/scenarios/   # Scenario CRUD, duplicate with rules
│   ├── manage/accounts/
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
  - Manage: Bank Accounts, Scenarios, Forecast Rules
  - Settings

### Conventions

- All money amounts stored as cents, displayed with `formatCents()`
- All dates as ISO strings (`YYYY-MM-DD`)
- Timestamps as ISO strings with time
- `userId: 'local'` placeholder for future multi-user
- Storage keys prefixed with `budget:`
- Australian financial year default (July 1 - June 30)
