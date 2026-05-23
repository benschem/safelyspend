# Phase 8 — Household concept in app UI (shared vs personal scope)

- **Goal:** Implement the data model from `docs/couples-feature-plan.md`: `scope: 'household' | 'personal'` on Category / Transaction / BudgetRule / ForecastRule; spending-money allowance per member; shared dashboard.
- **Files:** `src/lib/types.ts` (add `scope`, real `userId`); `src/lib/db.ts` (version bump, index on `scope`, migration defaulting all existing rows to `'household'`); every hook in `src/hooks/use-*.ts` (filter personal by current `userId`); `src/routes/dashboard.tsx`, `src/routes/budget.tsx`, `src/routes/transactions/*`, `src/routes/categories/*` (scope-aware queries and toggles); new "Members & Allowances" pane in `src/routes/settings.tsx`.
- **Gates:** Q5 (one vs many households — UI affordance for switching), Q7 (leaving a household — what stays, what's re-keyed, what's deleted).
- **Size:** L (touches many files but each touch is small and pattern-repetitive).
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 7](07_invite_flow.md).

Privacy model is UI-enforced within a household-keyed vault (i.e. both members can technically see all bytes; the UI filters personal scope by `userId`). This is consistent with both the couples-feature-plan recommendation and the wrapped-key direction — they don't conflict, the wrapped-key part is just *how* the household vault is keyed.
