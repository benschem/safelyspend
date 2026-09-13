# SafelySpend — Auth + Couples + Privacy Rewrite (Phased Plan)

## Context

SafelySpend is a privacy-focused, local-first budgeting app at safelyspend.app. Today it is single-user with optional E2E-encrypted cloud sync (Cloudflare Workers + D1 + R2). Authentication is passwordless email-OTP; the vault is one encrypted blob per user, derived directly from a sync passphrase. IndexedDB on the client is plaintext on disk, and stays that way. No code-level concept of households or invites exists yet.

The goal is a unified account model, a household-keyed wrapped-vault crypto scheme, and an invite-based couples flow — without surrendering the "server never sees your data" guarantee. The crypto is unforgiving, so the design is locked before code lands.

Phases 1 and 2 have full design docs. The rest are one screen each and get their detail when they are picked up.

## Start with a clean database

Production holds no vaults and no real users, and the maintainer's local data is disposable. Drop the D1 tables and R2 objects, rewrite migrations `0001`–`0004` into a single clean household-keyed schema, re-run.

Everything downstream assumes this. There is no format-v1 read path, no migration, and no per-user version state anywhere in the plan. `DECISIONS.md` records why.

**Status: done, 2026-09-13.** Migrations `0002`–`0004` are gone and `0001_initial.sql` is the whole household-keyed schema, applied to both the local and the production database.

Re-verified immediately before the production reset: `vaults` 0 rows, `sync_state` 0 rows, R2 `budget-vaults` 0 objects and 0 bytes. Four `users` rows existed, the same four the earlier check identified as our own testing, and with no vault ever uploaded there was nothing attached to them. Those rows are gone.

The remote sequence was: drop the six v1 tables, `DELETE FROM d1_migrations` (4 entries), re-apply. Production now holds the 12 new tables and 19 named indexes, with `vaults` keyed by `household_id` and no `user_id` column. The pre-reset D1 bookmark was `00000013-00000000-000050e5-3e12429faad9bc55c7ade3eb4e1f5648`, restorable via Time Travel for 30 days.

The schema was re-applied once more the same day, to add `'declined'` to the `invites.status` CHECK before anything could be written (see `07_invite_flow.md`). Production carries that version; it does not need a later table rebuild.

**The deployed worker has not been redeployed**, so the live API is v1 code against a v2 schema until Phase 4 or 5 ships the client to match. That is the same deliberate outage as the rest of the interval. `worker/README.md` has the full procedure.

## Conventions used in each phase file

- **Goal** — one line
- **Files** — most-likely-touched paths (representative, not exhaustive)
- **Gates** — which open questions must be resolved before this phase can ship
- **Size** — S / M / L (rough scope, not time)
- **Deps** — which other phases must land first

Locked throughout: wrapped-key pattern, X25519 keypair per user, household-keyed vault, mandatory recovery phrase, client-generated UUIDs, invite pattern lifted from `../searchyourstuff`, three-path invite acceptance.

## Phase index

Numbering has a gap at 6. Renumbering would break every cross-link here and in the design docs.

- [Phase 1 — Crypto + storage design doc](01_crypto_storage_design.md) — **designed** (`../crypto-design.md`)
- [Phase 2 — Backend schema + endpoints](02_backend_schema_endpoints.md) — **built** (`02_backend_schema_endpoints_design.md`; §13 lists where the design was wrong)
- [Phase 3 — Client crypto rewrite](03_client_crypto_rewrite.md) — **built**
- [Phase 4 — Account creation at cloud-sync opt-in](04_onboarding_rewrite.md)
- [Phase 5 — Cloud login and logout](05_login_unlock_logout.md)
- [Phase 7 — Invite flow (UI + backend + email)](07_invite_flow.md)
- [Phase 8 — Household concept in app UI (shared vs personal scope)](08_household_ui_scope.md)
- [Phase 9 — Landing page rewrite (two passes)](09_landing_page_rewrite.md)
- [Phase 10 — Privacy page](10_privacy_page.md)

## Critical path

```
3 ──► 2 ──► 4 ──► 5 ──► 7 ──► 8 ──► 9(pass 2) ──► 10

9(pass 1) — ships any time, parallel to all.
```

Phase 1 gates the entire rewrite. Phase 3 gates the client-side work (4, 5, 7, 8). Phase 2 gates the server-touching work (5, 7). Phase 8 cannot land until invites work (7) and households are real on both sides. Pass 2 of Phase 9 waits on Phase 8, which is the point at which the new guarantees are true rather than aspirational.

## The benchmark came first — and is done

Phase 1 pre-committed to Argon2id at m=64 MiB / t=3 without having measured it, the one cheap thing that could have invalidated the expensive doc. Measured 2026-09-13 with `hash-wasm`: 134 ms p95 on an M1, 216 ms p95 on an iPhone 11, so 432 ms for a full cloud login. The params stand as written and the m=32 MiB fallback is not taken. The mid-tier Android leg was deliberately skipped — the fleet is the maintainer's own devices. `../crypto-design.md` §3.4 has the numbers and the reasoning.

## How each phase will be verified as it lands

This meta-plan does not produce code, so there is nothing to verify here. Each individual phase, when its own plan is written, will include a verification section appropriate to its scope:

- Phases 1, 9, 10 — written-artefact review (read it, does it match reality, does it answer the open questions it's gating).
- Phases 2, 3 — unit + integration tests against the schema and crypto primitives; round-trip tests (encrypt → decrypt under derived material) covering every envelope variant, including the asymmetric handoff.
- Phases 4, 5, 7, 8 — manual UI walkthrough by the maintainer in the browser, plus the existing test suite for any hooks touched.
- Phase 7 specifically — the walkthrough needs two browsers (or one plus a private window) and two real mailboxes. It is the only flow in the app that cannot be exercised single-handed.

## Open questions

Answered and locked:

- **Q1** (recovery UX) — display + "copy to password manager" CTA + acknowledgement checkbox.
- **Q2** (invite handoff choreography) — the existing member's client wraps on their next cloud login; the invitee polls. Pubkeys are verified out-of-band before the wrap.
- **Q5** (households per user) — one, in v1. Enforced by `UNIQUE(household_members.user_id)`.
- **Q6** (session lifetimes) — JWT and MasterKey are independent. JWT 7d in a cookie; MasterKey in memory until tab close **or explicit lock**. Local re-unlock reads the cached wrapped-key rows — no OTP, no server contact. Logout clears the server session without touching the MasterKey, and clearing the MasterKey leaves the JWT alone. `02_backend_schema_endpoints_design.md` §1 is the fuller statement.
- **Q7** (leaving a household) — not supported in v1. Requires MasterKey rotation, which is not designed. Account deletion is the only exit.
- **Q8** (is the repo public) — yes. `github.com/benschem/safelyspend`, confirmed public 2026-09-13. Phase 9 and Phase 10 can both offer a "read the source" link.
- **Q4** (perf budget) — benchmarked 2026-09-13. **m=64 MiB / t=3 / p=1 stands.** 134 ms p95 on an M1, 216 ms on an iPhone 11 — a 432 ms cloud login on the slower of the two, comfortably inside the old 2 s budget. The mid-tier Android leg was dropped rather than measured: the fleet is the maintainer's own devices, and a slow unlock on old hardware is not a cost worth trading security for. `../crypto-design.md` §3.4 records the revised criterion, the extrapolated slow-path figure, and the fact that a login pays Argon2id twice.

No open questions remain. Phase 1 is locked; the benchmark that gated it is done.
