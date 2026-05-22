# SafelySpend — Auth + Couples + Privacy Rewrite (Phased Plan)

## Context

SafelySpend is a privacy-focused, local-first budgeting app at safelyspend.app. Today it is single-user with optional E2E-encrypted cloud sync (Cloudflare Workers + D1 + R2). Authentication is passwordless email-OTP; the vault is one encrypted blob per user, derived directly from a sync passphrase (PBKDF2 → AES-GCM, format v1: `VERSION | SALT | IV | CIPHERTEXT+TAG`). IndexedDB on the client is plaintext on disk. No code-level concept of households or invites exists yet — only `docs/couples-feature-plan.md` (which predates the wrapped-key + recovery-phrase decisions).

The goal is to land **Variant 2**: a unified password-locked account model, a household-keyed wrapped-vault crypto scheme, and an invite-based couples flow — without surrendering the "server never sees your data" guarantee. This is a multi-week, multi-phase effort. The crypto and the v0.37 migration are unforgiving, so the design must be locked before code lands.

This file is a **meta-plan**: ten phases at one screen of detail each. After approval, the next step is to deep-dive on a single phase via a follow-up planning session — not to start coding any of them.

## Conventions used in each phase block

- **Goal** — one line
- **Files** — most-likely-touched paths (representative, not exhaustive)
- **Gates** — which "open questions" from `docs/auth-rewrite-prompt.md` must be resolved before this phase can ship
- **Size** — S / M / L (rough scope, not time)
- **Deps** — which other phases must land first

Decisions already locked (see handoff): wrapped-key pattern, Curve25519 keypair per user, household-keyed vault, password mandatory from signup, recovery phrase mandatory, client-generated UUIDs, invite pattern lifted from `../searchyourstuff`, three-path invite acceptance, two-pass landing rewrite.

---

## The ten phases

### Phase 1 — Crypto + storage design doc

- **Goal:** Single source-of-truth `.md` for the wrapped-key + Curve25519 + IndexedDB-at-rest design. No code yet.
- **Files:** new `docs/crypto-design.md`; eventual touch-ups to `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` once locked.
- **Gates:** Q1 (recovery phrase UX), Q2 (invite handoff choreography), Q4 (Web Crypto perf budget), Q5 (one vs many households), Q7 (leaving a household).
- **Size:** M
- **Deps:** none — foundation for everything below.

Must specify: key hierarchy (passphrase-KEK → wraps personal pubkeypair-priv + wraps household master key; household master key → encrypts vault), KDF choice + params (PBKDF2 vs Argon2id — current code uses PBKDF2 600k, revisit), exact ciphertext formats with version bytes, IndexedDB at-rest scheme (per-record vs whole-store, encrypted via Dexie middleware), recovery-phrase derivation (BIP-39 mnemonic → backup KEK that also wraps the master key, so the phrase alone can recover without the password), and the asymmetric handoff sequence diagram for invites.

### Phase 2 — Backend schema + endpoints

- **Goal:** D1 migrations for households, members, wrapped-key storage, invites, asymmetric pubkeys; switch vault scoping from user to household.
- **Files:** new `worker/migrations/0005_households.sql` and `0006_invites.sql` (likely split); `worker/src/routes/households.ts` (new), `worker/src/routes/invites.ts` (new); `worker/src/routes/vault.ts` (re-key from user_id to household_id, version per household); `worker/src/routes/auth.ts` (signup now stores `password_verifier`, `public_key`, wrapped private key blob); `worker/src/db.ts` (or wherever the user model lives).
- **Gates:** Q5 (membership cardinality shapes `household_members` PK and unique constraints), Q6 (session model may change JWT payload to include `household_id`).
- **Size:** M
- **Deps:** Phase 1 (schema embeds wrapped-key + pubkey column shapes from the design).

Must specify: `households(id, name, created_at)`; `household_members(id, household_id, user_id, role, joined_at)`; `household_member_keys(household_id, user_id, wrapped_master_key, kek_salt, kek_params)`; `users` gains `public_key` (plaintext) and `wrapped_private_key`, `password_verifier` (so the server can authenticate without learning the password — likely an Argon2id verifier of an HMAC of the password, distinct from the KEK); `invites(id, token, sender_user_id, household_id, recipient_email, recipient_user_id NULL, status, expires_at, created_at)`; rate limits.

### Phase 3 — Client crypto rewrite

- **Goal:** Replace `src/lib/e2e-crypto.ts` with the wrapped-key API; add asymmetric helpers; add IndexedDB at-rest encryption.
- **Files:** rewrite `src/lib/e2e-crypto.ts` (new public surface: `deriveKEK`, `generateMasterKey`, `wrap/unwrap`, `encryptVault/decryptVault`, `generateKeypair`, `wrapForRecipient/unwrapFromSender`); new `src/lib/key-vault.ts` (in-memory holder for the unwrapped master key + private key during a logged-in session); `src/lib/db.ts` (Dexie version bump, middleware that encrypts/decrypts row payloads using the in-memory master key); `src/hooks/use-sync.ts` (uses the master key, not a passphrase-derived key directly); `src/lib/types.ts` for new key-material types.
- **Gates:** Q4 (perf budget — informs per-row vs whole-store encryption and whether reads are sync or async), Q6 (when keys exist in memory).
- **Size:** L
- **Deps:** Phase 1.

The format-v2 ciphertext must carry an explicit version byte so Phase 6 can detect v1 vs v2 on read and migrate.

### Phase 4 — Onboarding rewrite

- **Goal:** Account creation is the first screen for every new install. Collect password + recovery phrase. No cloud opt-in here.
- **Files:** restructure `src/components/first-run-wizard.tsx` (likely split: `account-step`, `password-step`, `recovery-phrase-step`, then the existing budget setup steps); `src/components/landing-page.tsx` (CTA changes from "View Demo" / "Log in" to "Create Account" / "I have an account"); `src/App.tsx` routing; `src/hooks/use-app-config.ts` (new init state covers `hasAccount`, `recoveryAcknowledged`).
- **Gates:** Q1 (recovery phrase UX — write-down vs verify-on-next-launch vs "I saved it to my password manager" path).
- **Size:** L
- **Deps:** Phase 3 (must be able to generate keypair + master key + wrapped artefacts).

The wizard ends with a local-only account; sync opt-in (which collects email + sends OTP + stores wrapped material server-side) is a separate later flow in Settings, gated by Phase 2.

### Phase 5 — Login / unlock / logout with session timeout

- **Goal:** Two distinct sessions: (a) **local unlock** that decrypts IndexedDB on app open, (b) **cloud auth session** for the worker (still email-OTP, now binding to a household).
- **Files:** rewrite `src/routes/login.tsx` (or split — `routes/unlock.tsx` for local, `routes/login.tsx` for cloud); new `src/hooks/use-unlock.ts` and lifecycle wiring in `src/App.tsx`/root layout; `worker/src/routes/auth.ts` (JWT payload may gain `householdId`, session lifetime semantics revisited).
- **Gates:** Q6 (how long is the local unlock cached — until tab close? configurable idle timeout? what's the relationship to JWT "remember me"?).
- **Size:** M
- **Deps:** Phase 3, Phase 2.

### Phase 6 — Migration for existing v0.37 cloud-sync users

- **Goal:** One-shot, no-data-loss migration of every existing direct-passphrase vault to the wrapped-key household-vault model, with the user setting a real account password and acknowledging a recovery phrase.
- **Files:** new `src/lib/migration-v0.37.ts`; integration hook in `src/App.tsx` (or wherever app boots) that detects v1 ciphertext format / pre-migration user records; possible `worker/migrations/000N_migrated_at.sql` to track which users finished migration; UI: new `src/routes/migrate.tsx` (forced modal flow on next launch).
- **Gates:** Q3 (migration design itself — fail-safes, what happens if mid-flow crash, can we rollback), Q4 (re-encrypting a multi-MB vault has a perceptible cost; must measure).
- **Size:** M–L
- **Deps:** Phase 3 (new crypto), Phase 5 (entry-point login can dispatch into migration), Phase 2 (any new columns).

Specifies: detection rule (read first byte of stored blob → version), prompt for current sync passphrase + new password, derive new KEK, generate keypair + master key, re-encrypt vault under master, upload v2 blob, update server-side wrapped key, mark `migrated_at`. Idempotent and resumable — if it crashes mid-way the next launch should pick up where it left off.

### Phase 7 — Invite flow (UI + backend + email)

- **Goal:** Existing member invites a partner by email. Three acceptance paths land. Asymmetric master-key handoff completes once the recipient sets a password.
- **Files:** `worker/src/routes/invites.ts` (issue / list / accept / revoke); Resend email template; `src/routes/settings.tsx` (invite section — send invite, list pending invites); new `src/routes/accept-invite.tsx`; in-app banner component for path #2 (account exists, invite auto-attached on signup); `src/hooks/use-invites.ts`; client-side "pending handoffs" worker that, on every cloud login of an existing member, checks for invitees with a pubkey but no wrapped master key and writes one.
- **Gates:** Q2 (when does the existing member's client perform the wrap — on next login? polling? dedicated endpoint that surfaces "handoffs you owe"?).
- **Size:** L
- **Deps:** Phase 2, Phase 3, Phase 4.

Reference: `../searchyourstuff/app/models/{house,invite,user}.rb` and `app/models/concerns/invitable.rb` — sweep-on-signup pattern is the model.

### Phase 8 — Household concept in app UI (shared vs personal scope)

- **Goal:** Implement the data model from `docs/couples-feature-plan.md`: `scope: 'household' | 'personal'` on Category / Transaction / BudgetRule / ForecastRule; spending-money allowance per member; shared dashboard.
- **Files:** `src/lib/types.ts` (add `scope`, real `userId`); `src/lib/db.ts` (version bump, index on `scope`, migration defaulting all existing rows to `'household'`); every hook in `src/hooks/use-*.ts` (filter personal by current `userId`); `src/routes/dashboard.tsx`, `src/routes/budget.tsx`, `src/routes/transactions/*`, `src/routes/categories/*` (scope-aware queries and toggles); new "Members & Allowances" pane in `src/routes/settings.tsx`.
- **Gates:** Q5 (one vs many households — UI affordance for switching), Q7 (leaving a household — what stays, what's re-keyed, what's deleted).
- **Size:** L (touches many files but each touch is small and pattern-repetitive).
- **Deps:** Phase 2, Phase 3, Phase 7.

Privacy model is UI-enforced within a household-keyed vault (i.e. both members can technically see all bytes; the UI filters personal scope by `userId`). This is consistent with both the couples-feature-plan recommendation and the wrapped-key direction — they don't conflict, the wrapped-key part is just *how* the household vault is keyed.

### Phase 9 — Landing page rewrite (two passes)

- **Goal:** Honest copy.
  - **Pass 1** (ships immediately, in parallel): describe what's true *today* — local-first, optional E2E sync, no tracking, no household yet.
  - **Pass 2** (ships after Phase 6): add the new guarantees — password-locked at rest, household sharing without server ever holding a key.
- **Files:** `src/components/landing-page.tsx` (likely split into `src/components/landing/*` — hero, how-it-works, threat-model-snippet, demo personas, footer).
- **Gates:** Q8 (is the GitHub repo public? affects "view source" trust signal).
- **Size:** S + S (pass 1 small, pass 2 small).
- **Deps:** Pass 1 — none. Pass 2 — Phases 3, 4, 5, 6 (so the guarantees are real, not aspirational).

### Phase 10 — Privacy page

- **Goal:** Architecture-as-plain-English at `/privacy`. KISS.
- **Files:** new `src/routes/privacy.tsx`; route registration in `src/App.tsx`; possibly `src/components/architecture-diagram.tsx` or an inline SVG; link from landing page footer.
- **Gates:** Q8 (repo visibility — whether to link).
- **Size:** S–M
- **Deps:** Phase 1 final design doc (so copy reflects reality, not aspiration). Otherwise standalone.

Sections to include (per handoff): where your data lives, what we see/don't see at each network call, what we'd hand over if compelled, the recovery tradeoff stated honestly, repo link if public, attribution to `../rocketzip`. Reference frames: Standard Notes / Proton threat-model writeups; `../saintheaven` for tone.

---

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
