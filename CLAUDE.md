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

A React 19 + TypeScript budgeting app with local-only persistence. Answers the question: "How much money can I freely spend between now and end of period?"

**Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, shadcn/ui, Vite

### Domain Model

All entities have base fields: `id`, `userId`, `createdAt`, `updatedAt`. Amounts stored as integer cents.

- **Period** - Primary workspace (e.g., "FY 2025-26"). Most data is scoped to the active period.
- **Account** - Bank accounts. Has `isArchived` flag.
- **OpeningBalance** - Per account, per period starting balance.
- **Category** - Expense categorization. Has `isArchived` flag.
- **BudgetLine** - Spending limit per category per period.
- **Forecast** - Unified type for projected income/expenses (`type: 'income' | 'expense'`).
- **Transaction** - Actual income/expenses. `categoryId` optional (null for income, optional for expenses).
- **Transfer** - Movement between accounts.
- **SavingsGoal** - Savings targets. Progress calculated from savings transactions.

### Key Directories

```
src/
├── components/
│   ├── ui/           # shadcn components (button, select, separator)
│   └── layout/       # Header, Sidebar, RootLayout
├── hooks/            # State management hooks
│   ├── use-local-storage.ts   # Base persistence hook
│   ├── use-periods.ts         # Period CRUD + active period selection
│   ├── use-accounts.ts
│   ├── use-categories.ts
│   ├── use-forecasts.ts
│   ├── use-transactions.ts
│   ├── use-transfers.ts
│   ├── use-budget-lines.ts
│   ├── use-opening-balances.ts
│   └── use-savings-goals.ts
├── routes/           # Page components
│   ├── dashboard.tsx
│   ├── forecast/
│   ├── budget.tsx
│   ├── transactions/
│   ├── categories/
│   ├── savings/
│   ├── manage/periods/
│   ├── manage/accounts/
│   └── settings.tsx
├── lib/
│   ├── types.ts      # Domain types
│   └── utils.ts      # formatMoney, cn, generateId, etc.
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

Active period is stored separately (`budget:activePeriodId`) and passed via React Router's outlet context.

### Navigation Structure

- Header: Period selector (workspace switcher)
- Sidebar:
  - Dashboard
  - Plan: Forecast, Budget
  - Track: Transactions, Categories, Savings
  - Manage: Periods, Accounts
  - Settings

### Conventions

- All money amounts with cents but displayed without cents (use `formatMoney()` for display)
- All dates as ISO strings (`YYYY-MM-DD`)
- Timestamps as ISO strings with time
- `userId: 'local'` placeholder for future multi-user
- Storage keys prefixed with `budget:`
