# SafelySpend

A personal finance tool that tells you how much you can safely spend.

User data is stored locally in the browser using IndexedDB. Optional cloud sync backs up your data to a Cloudflare Worker backend as an end-to-end encrypted blob — the server never sees your plaintext data.

This is the first time I've used Claude CLI to help me finish a project, and it was a surprisingly good experience. Despite a significant portion of the code being written by AI, I like to think I understand this codebase reasonably well and it's still representative of my architectural decisions.

## Features

- Track income, expenses and savings
- Define categories (e.g. groceries, rent, entertainment, savings)
- Set budgets with flexible frequencies (weekly, fortnightly, monthly, quarterly, yearly)
- Compare actual spending to projected spending per category
- Check how much money is free to spend
- Simulate budget adjustments with what-if scenarios (e.g. "What happens if I reduce dining out by $100 per month?")
- Set and track savings goals with interest rate forecasting
- Import transactions from CSV (generic or Up Bank format)
- Periodic check-in wizard for reviewing your finances
- Cloud sync with end-to-end encryption across devices
- Export and import your data as JSON

## Tech Stack

**Frontend:** React 19, React Router 7, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Dexie (IndexedDB)

**Backend (optional):** Cloudflare Workers, Hono, D1 (SQLite), R2 (blob storage)

**Tooling:** ESLint, Prettier

## Project Structure

This is a monorepo with two packages:

- `/` — React frontend (Vite)
- `/worker` — Cloudflare Worker backend (see [`worker/README.md`](worker/README.md) for deployment and secrets)

## Setup

```bash
npm install
npm run dev       # start Vite dev server with hot reload
```

To connect to a backend for cloud sync, set the API URL:

```bash
VITE_API_URL=http://localhost:8787 npm run dev
```

If `VITE_API_URL` is not set, the frontend defaults to `https://api.safelyspend.app`. Cloud sync features are only available when a backend is reachable.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # type-check and build for production
npm run preview   # serve the production build locally
npm run lint      # run ESLint
npm run test      # run tests in watch mode
npm run test:run  # run tests once
```

See [`worker/README.md`](worker/README.md) for backend commands.

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Full deployment guide (Netlify + Cloudflare) and operations handbook (logs, database console, rollbacks)
- [worker/README.md](worker/README.md) — Backend API endpoints, database migrations, JWT rotation, disaster recovery
- [CLAUDE.md](CLAUDE.md) — Codebase architecture, domain model, conventions, and development patterns
