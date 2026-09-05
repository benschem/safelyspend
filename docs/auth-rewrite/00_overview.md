# SafelySpend — Auth + Couples + Privacy Rewrite (Phased Plan)

## Context

SafelySpend is a privacy-focused, local-first budgeting app at safelyspend.app. Today it is single-user with optional E2E-encrypted cloud sync (Cloudflare Workers + D1 + R2). Authentication is passwordless email-OTP; the vault is one encrypted blob per user, derived directly from a sync passphrase (PBKDF2 → AES-GCM, format v1: `VERSION | SALT | IV | CIPHERTEXT+TAG`). IndexedDB on the client is plaintext on disk. No code-level concept of households or invites exists yet — only `docs/couples-feature-plan.md` (which predates the wrapped-key + recovery-phrase decisions).

The goal is to land **Variant 2**: a unified password-locked account model, a household-keyed wrapped-vault crypto scheme, and an invite-based couples flow — without surrendering the "server never sees your data" guarantee. This is a multi-week, multi-phase effort. The crypto is unforgiving, so the design must be locked before code lands.

This directory is a **meta-plan**: ten phases at one screen of detail each. Phases 1 and 2 have since been deep-dived into full design docs; Phase 6 has been dropped (see below). The remaining phases are still one screen each and get their detail when they are picked up.

## There is no data to migrate (2026-09-05)

Production was checked before any code was planned against it: `users` held four rows, all of them the maintainer's own testing (two placeholder addresses, two real ones created the same day while fixing the landing page login), and `sync_state` was **empty**. No vault has ever been uploaded, so R2 holds nothing either. The maintainer's local IndexedDB data is explicitly disposable.

**Consequences, which reach further than deleting one phase:**

- **Phase 6 is dropped entirely.** Replaced by a one-off chore: drop the D1 tables and R2 objects, rewrite migrations `0001`–`0004` into a single clean household-keyed schema, re-run. The phase file is deleted; this section is its epitaph.
- **There is no v1 read path anywhere.** Format v1 (`VERSION=0x01`, PBKDF2-direct) has never encrypted a byte in production. Nothing needs to decrypt it, detect it, or refuse it.
- **Anti-downgrade protection is unnecessary.** It defended against a malicious server replaying stale v1 ciphertext to hold a user on the weaker KDF. There is no stale v1 ciphertext. The `users.schema_version` tombstone, the `sv` JWT claim, and the `SCHEMA_VERSION_MISMATCH` branch all go.
- **`src/lib/e2e-crypto.ts` comes off the don't-touch list** in `../HANDOVER.md`. Its stated risk was "changing the format makes existing synced vaults unreadable." There are no synced vaults. It is now ordinary code that can be rewritten in place.
- **Q3 is void** and Q4 loses its Phase 6 dependency.

Do the wipe *before* Phase 3 starts, so nothing downstream is quietly designed around data that is about to be deleted.

## Conventions used in each phase file

- **Goal** — one line
- **Files** — most-likely-touched paths (representative, not exhaustive)
- **Gates** — which "open questions" from `docs/auth-rewrite-prompt.md` must be resolved before this phase can ship
- **Size** — S / M / L (rough scope, not time)
- **Deps** — which other phases must land first

Decisions already locked (see handoff): wrapped-key pattern, Curve25519 keypair per user, household-keyed vault, password mandatory from signup, recovery phrase mandatory, client-generated UUIDs, invite pattern lifted from `../searchyourstuff`, three-path invite acceptance, two-pass landing rewrite.

## Phase index

Phases keep their original numbers even though 6 is gone. Renumbering would break every cross-link in this directory and in the two design docs, and would silently rewrite the meaning of "Phase 7" in commit messages that already exist.

- [Phase 1 — Crypto + storage design doc](01_crypto_storage_design.md) — **designed** (`../crypto-design.md`)
- [Phase 2 — Backend schema + endpoints](02_backend_schema_endpoints.md) — **designed** (`02_backend_schema_endpoints_design.md`)
- [Phase 3 — Client crypto rewrite](03_client_crypto_rewrite.md)
- [Phase 4 — Onboarding rewrite](04_onboarding_rewrite.md)
- [Phase 5 — Login / unlock / logout with session timeout](05_login_unlock_logout.md)
- Phase 6 — ~~Migration for existing v0.37 cloud-sync users~~ — **dropped**, no data to migrate
- [Phase 7 — Invite flow (UI + backend + email)](07_invite_flow.md)
- [Phase 8 — Household concept in app UI (shared vs personal scope)](08_household_ui_scope.md)
- [Phase 9 — Landing page rewrite (two passes)](09_landing_page_rewrite.md)
- [Phase 10 — Privacy page](10_privacy_page.md)

## Critical path

```
1 ────► 2 ──┐
   │        ├──► 5 ──┐
   └► 3 ────┤        ├──► 7 ──► 8 ──► 9(pass 2) ──► 10
            └► 4 ────┘
9(pass 1) — ships any time, parallel to all.
```

Phase 1 gates the entire rewrite. Phase 3 gates the client-side work (4, 5, 7, 8). Phase 2 gates the server-touching work (5, 7). Phase 8 cannot land until invites work (7) and households are real on both sides.

Pass 2 of Phase 9 previously waited on the migration; it now waits on Phase 8, which is the point at which the new guarantees are actually true rather than aspirational.

## Sequencing note: the benchmark comes first

Phase 1 pre-commits to two numbers it has not measured — Argon2id at m=64 MiB / t=3, and whole-store IndexedDB encryption. Both have documented fallbacks, and the whole-store fallback (per-row, `KIND=0x04`) **weakens the at-rest threat-model claim in §1.5** and would force a privacy-page correction.

Run that benchmark before treating Phase 1 as locked. It is roughly half a day with `hash-wasm` and a seeded 5,000-transaction vault, and it is the only cheap thing that can invalidate the expensive doc.

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
- **Q6** (local unlock vs cloud auth session) — independent lifetimes. JWT 7d in a cookie; MasterKey in memory until tab close or explicit lock.
- **Q7** (leaving a household) — not supported in v1. Requires MasterKey rotation, which is not designed. Account deletion is the only exit.

Void:

- ~~**Q3** (v0.37 migration shape)~~ — there is nothing to migrate.

Still open:

- **Q4** (perf budget) — gates Phase 1 + Phase 3. Not a discussion; a benchmark. See the sequencing note above.
- **Q8** (is the repo public) — gates Phase 9 + Phase 10. A yes/no that decides whether the privacy page and landing page can offer a "read the source" trust signal. Open since February; costs nothing to answer.
