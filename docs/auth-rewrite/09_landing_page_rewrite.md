# Phase 9 — Landing page rewrite (two passes)

- **Goal:** Honest copy.
  - **Pass 1** (ships immediately, in parallel): describe what's true *today* — local-first, optional E2E sync, no tracking, no household yet.
  - **Pass 2** (ships after [Phase 6](06_migration_v037.md)): add the new guarantees — password-locked at rest, household sharing without server ever holding a key.
- **Files:** `src/components/landing-page.tsx` (likely split into `src/components/landing/*` — hero, how-it-works, threat-model-snippet, demo personas, footer).
- **Gates:** Q8 (is the GitHub repo public? affects "view source" trust signal).
- **Size:** S + S (pass 1 small, pass 2 small).
- **Deps:** Pass 1 — none. Pass 2 — [Phases 3](03_client_crypto_rewrite.md), [4](04_onboarding_rewrite.md), [5](05_login_unlock_logout.md), [6](06_migration_v037.md) (so the guarantees are real, not aspirational).
