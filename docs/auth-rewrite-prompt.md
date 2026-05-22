# SafelySpend — design & plan the auth + couples + privacy rewrite

> Session-handoff prompt. Paste this as the first message of a fresh Claude Code session to load full context for planning the auth + couples + privacy rewrite. Captures the decisions made and the open questions flagged so far.

SafelySpend (safelyspend.app) is a privacy-focused, local-first budgeting app. Today it's single-user, with optional E2E-encrypted cloud sync via Cloudflare Workers + D1 + R2. The goal of this session is to lay out a high-level, multi-phase plan that takes us from the current state to a model that supports password-locked local accounts, a household concept, and shared budgeting with a partner — without ever giving up the "server never sees your data" guarantee.

I want you in **planning mode**. Do not write code. Lay out a phased plan, then ask me which phase to flesh out in detail. Iterate phase by phase. Be honest about what's hard and what's unsolved.

## Decisions already made — don't relitigate these

### Architecture & crypto

- **Keep end-to-end encryption.** Privacy is the product's identity. Budget data never reaches the server in plaintext.
- **Unified household model from day one.** Every cloud-sync user is implicitly the only member of their own household. No special case for solo vs couples; the data path is the same.
- **Wrapped-key pattern.** Each household has a random 256-bit master key (generated client-side). The vault is encrypted with the master key. Each member's copy of the master key is wrapped (encrypted) with their passphrase-derived key, stored on the server in a `household_member_keys` table. Standard 1Password/Bitwarden pattern.
- **Curve25519 asymmetric keypair per user at signup.** Private key wrapped under the passphrase-derived key; public key plaintext on the server. Enables invite-time master-key handoff without both parties being online simultaneously.
- **Vault becomes household-keyed**, not user-keyed.

### Account model

- **Variant 2: required password from signup for ALL users**, including local-only. At-rest encryption for IndexedDB. One password unifies local lock + cloud-sync passphrase + household key derivation.
- **Email deferred.** Local-only accounts have password only; no email, no server record. Email is added at cloud-sync opt-in (verified via OTP). The server never learns of local-only users.
- **Recovery phrase mandatory at signup.** 12-word BIP-39-style. The only safety net for local-only users since there's no email to send a reset to. User must acknowledge they've saved it.
- **Client-generated UUIDs** so a local→cloud upgrade involves no ID renames.

### Invite flow

- Pattern lifted from `../searchyourstuff` (a Rails app with a very similar households + invites design).
- `Invite` has `token`, `sender`, `recipient` (nullable), `recipient_email`, `status`, `expires_at` (3 days).
- On signup of any new user, sweep pending invites by email and auto-attach.
- **Household membership creation is gated on the recipient completing signup + setting a password** — so by the time we add them, they have a keypair and we can do the asymmetric master-key handoff.
- Three paths to acceptance:
  1. No account → click email link → sign up there → see accept dialog
  2. No account → sign up from landing → see in-app invite banner (auto-attached by email match)
  3. Already have an account → click email link → see accept dialog

### Landing page & privacy

- **Two-pass rewrite.** First pass: honest copy for what's true *today* (local-first, optional E2E sync, no tracking). Second pass after Variant 2 ships: add the new guarantees (password-locked at rest, household sharing without giving us anything).
- **Privacy page.** Architecture-as-plain-English. KISS. Sections:
  - Where your data lives (list or diagram)
  - What we see / don't see at each network call
  - What we'd do if compelled (we can hand over encrypted bytes; we have no key)
  - The recovery tradeoff stated honestly (forgot your phrase = lost data; this is a feature, not a bug)
  - Link to the GitHub repo as a trust signal — confirm the repo is public first
  - Attribution to the maintainer's agency: `../rocketzip`
- **Inspiration repos:** look at `../saintheaven` (existing project of the same maintainer) and reference how Standard Notes / Proton frame their threat model.

## Open questions — flag, don't decide alone

1. **Recovery phrase UX.** Forcing a 12-word writedown at signup is real friction. How do we make it least painful? Allow a "save to password manager" path? Verify the user remembers it (re-enter on next launch)?
2. **Invite handoff choreography.** With asymmetric pubkeys, the existing member's client has to "next time it connects, wrap the master key for the new member." When does that happen — background sync, next login, a dedicated polling endpoint?
3. **Migration for existing v0.37 cloud-sync users.** They have direct-passphrase-encrypted vaults today. Needs a one-time forced "set a password now and we'll re-key everything" flow on next launch. Design this carefully — it's a one-shot thing and a bad migration could lose data.
4. **Encryption performance.** Web Crypto on every IndexedDB read/write. Plan when/how we measure this on real data sizes and whether we batch or defer for perf-sensitive paths.
5. **One household per user vs many.** Rails app uses HABTM (many). `docs/couples-feature-plan.md` says one-household-for-v1. Pick deliberately — it shapes the data model and the UI.
6. **Session lifetime on a logged-in device.** Today's cloud-sync auth is JWT with optional 30-day "remember me." Variant 2 introduces a real local password lock too. What's the relationship between the local lock session and the cloud auth session?
7. **Leaving a household.** Personal data stays with the leaving user; shared household data stays with the household. But the leaving user's wrapped master key needs to be revoked, and they may have data on-device that needs to go (or be re-keyed for personal-only).
8. **Repo visibility.** Is the GitHub repo public? Linking from the privacy page assumes it is. If not, decide whether we open-source as part of this push.

## What I want from this session

Enter planning mode. Lay out a phased plan covering at least:

1. **Crypto + storage design doc** (single `.md` artifact, no code yet) — the foundation everything else builds on
2. **Backend schema changes** — `households`, `household_members`, `household_member_keys`, `invites`, asymmetric pubkey storage + D1 migrations
3. **Client crypto rewrite** — wrapped-key, Curve25519, IndexedDB-at-rest encryption
4. **Onboarding rewrite** — account creation as first screen, recovery phrase moment, password-only signup
5. **Login/logout flow** with session timeout
6. **Migration for existing v0.37 users**
7. **Invite flow** — UI + backend + email
8. **Household concept in app UI** — shared vs personal scope on entities (see existing `docs/couples-feature-plan.md`)
9. **Landing page rewrite** — pass 1 (current truth) and pass 2 (post-Variant 2)
10. **Privacy page**

For each phase, give me:
- The goal in one line
- Files most likely touched
- Which "open questions" gate it
- Rough size estimate (S / M / L)
- Dependencies on other phases

Then ask me which phase to flesh out in detail. We'll iterate.

## Repo pointers

- `docs/couples-feature-plan.md` — existing couples design doc; data model sketch is mostly right but predates the wrapped-key + recovery-phrase decisions
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/HANDOVER.md`, `docs/DEVELOPMENT.md` — current architecture
- `src/lib/e2e-crypto.ts` — current encryption (will be rewritten — currently format v1: VERSION + SALT + IV + CIPHERTEXT+TAG)
- `src/lib/db.ts` — Dexie schema + version chain (will need a version bump)
- `src/lib/types.ts` — domain types
- `src/components/landing-page.tsx`, `src/components/first-run-wizard.tsx`, `src/routes/login.tsx` — UI surfaces being rewritten
- `worker/src/routes/auth.ts`, `worker/src/routes/vault.ts`, `worker/migrations/` — backend
- `../searchyourstuff/app/models/{house,invite,user}.rb` and `app/models/concerns/invitable.rb` — reference for invite data model and the `check_for_invites` auto-attach pattern
- `../rocketzip/` — agency, for attribution
- `../saintheaven/` — inspiration for design/copy

## Constraint reminder

Don't be eager to implement. Don't propose code in this session. Use the ExitPlanMode workflow when proposing the high-level plan, and again for each phase. Push back on me if I try to skip steps.

This is a multi-week effort, and the crypto and migration parts are unforgiving — get the design right before any code lands.
