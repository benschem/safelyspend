# SafelySpend

A personal finance tool that tells you how much you can safely spend.

It is live at [safelyspend.app](https://safelyspend.app).

User data is stored locally in the browser using IndexedDB. Optional cloud sync backs up your data to a Cloudflare Worker backend as an end-to-end encrypted blob, so the server never sees your plaintext data.

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

## Tech stack

**Frontend:** React 19, React Router 7, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Dexie (IndexedDB)

**Backend (optional):** Cloudflare Workers, Hono, D1 (SQLite), R2 (blob storage)

**Tooling:** ESLint, Prettier

## Project structure

This is a monorepo with two packages:

- `/`: React frontend (Vite)
- `/worker`: Cloudflare Worker backend (see [`worker/README.md`](worker/README.md) to work on it, and [docs/reference/DEPLOYMENT.md](docs/reference/DEPLOYMENT.md) to deploy it)

## Setup

```bash
npm install
npm run dev       # start Vite dev server with hot reload
```

The app works fully offline. Accounts, cloud sync and sharing need a backend, and `npm run dev` expects one at `http://localhost:8787`: run the worker locally as described in [docs/reference/DEVELOPMENT.md](docs/reference/DEVELOPMENT.md).

The API address comes from `VITE_API_URL`, set in `.env.development` for `npm run dev` and in `.env.production` for `npm run build`. The same value fills the `connect-src` of the Content-Security-Policy in `index.html`, so the page can only call the API it was built for. If you host your own backend, change the address in `.env.production` and in `public/_headers`.

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

- [docs/reference/DEPLOYMENT.md](docs/reference/DEPLOYMENT.md): deploying to Netlify and Cloudflare, and operating the backend (secrets, logs, database console, JWT secret rotation, rollbacks, disaster recovery)
- [docs/reference/DEVELOPMENT.md](docs/reference/DEVELOPMENT.md): local setup for the frontend and the worker, and testing
- [worker/README.md](worker/README.md): working on the backend's code: local development, tests, writing a migration, the route list
- [CLAUDE.md](CLAUDE.md): codebase architecture, domain model, conventions and development patterns
