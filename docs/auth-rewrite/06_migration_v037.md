# Phase 6 — Migration for existing v0.37 cloud-sync users

- **Goal:** One-shot, no-data-loss migration of every existing direct-passphrase vault to the wrapped-key household-vault model, with the user setting a real account password and acknowledging a recovery phrase.
- **Files:** new `src/lib/migration-v0.37.ts`; integration hook in `src/App.tsx` (or wherever app boots) that detects v1 ciphertext format / pre-migration user records; possible `worker/migrations/000N_migrated_at.sql` to track which users finished migration; UI: new `src/routes/migrate.tsx` (forced modal flow on next launch).
- **Gates:** Q3 (migration design itself — fail-safes, what happens if mid-flow crash, can we rollback), Q4 (re-encrypting a multi-MB vault has a perceptible cost; must measure).
- **Size:** M–L
- **Deps:** [Phase 3](03_client_crypto_rewrite.md) (new crypto), [Phase 5](05_login_unlock_logout.md) (entry-point login can dispatch into migration), [Phase 2](02_backend_schema_endpoints.md) (any new columns).

## Specifies

- Detection rule (read first byte of stored blob → version).
- Prompt for current sync passphrase + new password.
- Derive new KEK, generate keypair + master key, re-encrypt vault under master, upload v2 blob, update server-side wrapped key, mark `migrated_at`.
- Idempotent and resumable — if it crashes mid-way the next launch should pick up where it left off.
