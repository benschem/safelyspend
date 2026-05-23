# Phase 2 — Backend schema + endpoints

- **Goal:** D1 migrations for households, members, wrapped-key storage, invites, asymmetric pubkeys; switch vault scoping from user to household.
- **Files:** new `worker/migrations/0005_households.sql` and `0006_invites.sql` (likely split); `worker/src/routes/households.ts` (new), `worker/src/routes/invites.ts` (new); `worker/src/routes/vault.ts` (re-key from user_id to household_id, version per household); `worker/src/routes/auth.ts` (signup now stores `password_verifier`, `public_key`, wrapped private key blob); `worker/src/db.ts` (or wherever the user model lives).
- **Gates:** Q5 (membership cardinality shapes `household_members` PK and unique constraints), Q6 (session model may change JWT payload to include `household_id`).
- **Size:** M
- **Deps:** [Phase 1](01_crypto_storage_design.md) (schema embeds wrapped-key + pubkey column shapes from the design).

## Must specify

- `households(id, name, created_at)`.
- `household_members(id, household_id, user_id, role, joined_at)`.
- `household_member_keys(household_id, user_id, wrapped_master_key, kek_salt, kek_params)`.
- `users` gains `public_key` (plaintext) and `wrapped_private_key`, `password_verifier` (so the server can authenticate without learning the password — likely an Argon2id verifier of an HMAC of the password, distinct from the KEK).
- `invites(id, token, sender_user_id, household_id, recipient_email, recipient_user_id NULL, status, expires_at, created_at)`.
- Rate limits.
