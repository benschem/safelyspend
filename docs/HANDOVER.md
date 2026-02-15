# Handover

Current status of the project as of v0.37.0 (February 2026).

## What Works

These features are complete and stable:

- **Full budgeting workflow** — categories, transactions, budget rules, forecast rules, savings goals
- **What-if scenario comparison** — adjust values in-memory, see visual diff, save as new scenario
- **Cadence-based rules** — weekly, fortnightly, monthly, quarterly, yearly with expansion over any date range
- **CSV import** — generic CSV and Up Bank format, with duplicate detection via `importFingerprint`
- **JSON export/import** — full data backup and restore with schema migration
- **Demo mode** — 4 procedurally-generated personas for trying the app without real data
- **Cloud sync** — E2E encrypted (PBKDF2 + AES-256-GCM), blob upload/download to Cloudflare R2
- **Auth system** — passwordless email OTP, JWT sessions, session rotation, account deletion
- **Landing page** — marketing page with interactive demos
- **Check-in wizard** — periodic budget review flow with configurable cadence
- **Category import rules** — auto-categorize transactions on import
- **Version history** — vault rollback to previous sync versions
- **Balance anchors** — declare a known balance at a point in time for reconciliation
- **Savings anchors** — point-in-time balance records for savings goals with interest tracking

## What's Unfinished

| Item | Status | Notes |
|------|--------|-------|
| Landing page "Log in" button | Disabled | Auth system is built and working, but the login button on the landing page isn't wired up |
| `useDataDateRange` hook | Dead code | Reads localStorage keys that are no longer populated after the IndexedDB migration. Safe to delete. |
| `public/dummyBudgetData.json` | Dead code | Legacy fixture from early development. Not referenced anywhere. Safe to delete. |
| Legacy `.eslintrc.json` | Dead code | Old config alongside the newer `eslint.config.js`. Safe to delete. |
| `components.json` | Missing | shadcn/ui config file was deleted. `npx shadcn add` won't work until re-added. |
| CI/CD | None | Deployment is manual `wrangler deploy`. No automated tests in CI. |
| Analytics | Not started | Plausible integration is a TODO |
| Editing recurring forecasts | Partial | Uses old-style detail view instead of inline editing |

## What's Risky (Don't-Touch List)

These files are correct but fragile. Change them only with full understanding and test coverage:

| File | Why |
|------|-----|
| `src/lib/db.ts` | Dexie schema version chain. A wrong version bump or bad migration can corrupt or lose user data. Always test import/export round-trips after changes. |
| `src/lib/import-schema.ts` | Zod schemas for import validation + data migration. Breaking this breaks data restore from backups. |
| `src/lib/e2e-crypto.ts` | Encryption binary format. Changing the format makes existing synced vaults unreadable. Format is versioned (currently v1) but there's no v2 migration path yet. |
| `worker/src/services/vault.ts` (`putData`) | Optimistic concurrency + orphan cleanup. Subtle race condition handling between D1 metadata and R2 blob writes. |
| `worker/src/middleware/auth.ts` | JWT verification + session rotation. Security-critical. |
| `worker/src/services/auth.ts` | Brute-force protection, OTP hash storage, lockout logic. Security-critical. |
| `src/contexts/what-if-context.tsx` | Complex in-memory overlay that many components depend on. Works well but the internal shape is non-obvious. |

## 2-Week Roadmap

Suggested priorities if picking this up today:

### Week 1: Clean up and stabilize

1. Delete dead code (`useDataDateRange`, `dummyBudgetData.json`, `.eslintrc.json`)
2. Re-add `components.json` for shadcn/ui CLI
3. Wire up the landing page "Log in" button to `/login`
4. Set up basic CI (GitHub Actions: lint + typecheck + test)
5. Extract cadence expansion into shared module (see refactor plan below)

### Week 2: Ship features

6. Add currency selection (currently hardcoded AUD)
7. Add date format preferences
8. Add Plausible analytics
9. Improve recurring forecast editing (inline instead of detail page)
10. Start planning financial year customization

## Refactor Plan

### Small (low risk, high clarity)

**1. Delete dead code**
- `src/hooks/use-data-date-range.ts` — reads localStorage keys no longer populated post-IndexedDB migration
- `public/dummyBudgetData.json` — legacy fixture, unreferenced
- `.eslintrc.json` — legacy config, superseded by `eslint.config.js`

**2. Re-add `components.json`**

The shadcn/ui config file was deleted. Without it, `npx shadcn@latest add <component>` fails. Re-run `npx shadcn@latest init` (choose "no" to overwrite prompts) or manually create it pointing to `src/components/ui/`.

### Medium (worth it, moderate effort)

**3. Extract cadence expansion into `src/lib/cadence.ts`**

Currently, cadence expansion logic is spread across:
- `src/hooks/use-budget-rules.ts`
- `src/hooks/use-forecasts.ts`
- `src/hooks/use-multi-period-summary.ts`

A `toMonthlyCents()` utility exists in `utils.ts`, but the full date-range expansion (generating individual occurrences from a rule + cadence + date range) is duplicated.

Extract into a single `src/lib/cadence.ts` module with:
- Pure functions (no React, no hooks)
- `expandRule(rule, startDate, endDate)` — returns dated occurrences
- `sumRuleOverRange(rule, startDate, endDate)` — returns total cents
- Unit tests covering edge cases (month boundaries, leap years, fortnightly alignment)

Then update the three hooks to import from the shared module.

### Leave alone

These are complex but working, well-tested, and rarely need changes:

- **What-if context** — complex in-memory overlay, but stable and well-understood
- **Vault sync protocol** — subtle concurrency handling, battle-tested
- **Auth flow** — security-critical, fully tested
- **Demo persona system** — isolated, works well, self-contained
