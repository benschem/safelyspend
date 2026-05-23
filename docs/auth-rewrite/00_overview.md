# SafelySpend — Auth + Couples + Privacy Rewrite (Phased Plan)

## Context

SafelySpend is a privacy-focused, local-first budgeting app at safelyspend.app. Today it is single-user with optional E2E-encrypted cloud sync (Cloudflare Workers + D1 + R2). Authentication is passwordless email-OTP; the vault is one encrypted blob per user, derived directly from a sync passphrase (PBKDF2 → AES-GCM, format v1: `VERSION | SALT | IV | CIPHERTEXT+TAG`). IndexedDB on the client is plaintext on disk. No code-level concept of households or invites exists yet — only `docs/couples-feature-plan.md` (which predates the wrapped-key + recovery-phrase decisions).

The goal is to land **Variant 2**: a unified password-locked account model, a household-keyed wrapped-vault crypto scheme, and an invite-based couples flow — without surrendering the "server never sees your data" guarantee. This is a multi-week, multi-phase effort. The crypto and the v0.37 migration are unforgiving, so the design must be locked before code lands.

This directory is a **meta-plan**: ten phases at one screen of detail each. After approval, the next step is to deep-dive on a single phase via a follow-up planning session — not to start coding any of them.

## Conventions used in each phase file

- **Goal** — one line
- **Files** — most-likely-touched paths (representative, not exhaustive)
- **Gates** — which "open questions" from `docs/auth-rewrite-prompt.md` must be resolved before this phase can ship
- **Size** — S / M / L (rough scope, not time)
- **Deps** — which other phases must land first

Decisions already locked (see handoff): wrapped-key pattern, Curve25519 keypair per user, household-keyed vault, password mandatory from signup, recovery phrase mandatory, client-generated UUIDs, invite pattern lifted from `../searchyourstuff`, three-path invite acceptance, two-pass landing rewrite.

## Phase index

- [Phase 1 — Crypto + storage design doc](01_crypto_storage_design.md)
- [Phase 2 — Backend schema + endpoints](02_backend_schema_endpoints.md)
- [Phase 3 — Client crypto rewrite](03_client_crypto_rewrite.md)
- [Phase 4 — Onboarding rewrite](04_onboarding_rewrite.md)
- [Phase 5 — Login / unlock / logout with session timeout](05_login_unlock_logout.md)
- [Phase 6 — Migration for existing v0.37 cloud-sync users](06_migration_v037.md)
- [Phase 7 — Invite flow (UI + backend + email)](07_invite_flow.md)
- [Phase 8 — Household concept in app UI (shared vs personal scope)](08_household_ui_scope.md)
- [Phase 9 — Landing page rewrite (two passes)](09_landing_page_rewrite.md)
- [Phase 10 — Privacy page](10_privacy_page.md)

## Critical path

```
1 ────► 2 ──┐
   │        ├──► 5 ──┐
   └► 3 ────┤        ├──► 6 ──► 9(pass 2)
            ├──► 4 ──┘             │
            └────────► 7 ──► 8     ▼
                                  10
9(pass 1) — ships any time, parallel to all.
```

Phase 1 gates the entire rewrite. Phase 3 gates the client-side work (4, 5, 6, 7, 8). Phase 2 gates the server-touching work (5, 6, 7). Phase 8 cannot land until invites work (7) and households are real on both sides.

## How each phase will be verified as it lands

This meta-plan does not produce code, so there is nothing to verify here. Each individual phase, when its own plan is written, will include a verification section appropriate to its scope:

- Phases 1, 9, 10 — written-artefact review (read it, does it match reality, does it answer the open questions it's gating).
- Phases 2, 3 — unit + integration tests against migrations and crypto primitives; round-trip tests (encrypt → decrypt under derived material) that catch format-v1/v2 confusion.
- Phases 4, 5, 7, 8 — manual UI walkthrough by the maintainer in the browser, plus the existing test suite for any hooks touched.
- Phase 6 — a dedicated migration testbed: seed a v0.37-shaped vault + user record, run the migration, assert post-state is correct, assert idempotency (re-running is a no-op), assert mid-flow crash + restart still converges.

## Open questions still owed an answer before phases 1 and 2 can be fully scoped

- Q1 (recovery UX) — gates Phase 1 + Phase 4.
- Q2 (invite handoff choreography) — gates Phase 1 + Phase 7.
- Q3 (v0.37 migration shape) — gates Phase 6.
- Q4 (Web Crypto perf budget on real vault sizes) — gates Phase 1 + Phase 3 + Phase 6.
- Q5 (one vs many households) — gates Phase 1 + Phase 2 + Phase 8.
- Q6 (local unlock vs cloud auth session relationship) — gates Phase 1 + Phase 2 + Phase 5.
- Q7 (leaving a household) — gates Phase 1 + Phase 8.
- Q8 (is the repo public) — gates Phase 9 + Phase 10. A simple yes/no but it affects landing copy.

The right next step after approval of this meta-plan is to pick **one** phase and write its dedicated detailed plan (starting with Phase 1, since it gates everything). At that point the gating open questions for that phase get pinned down via `AskUserQuestion` before any code is committed to.
