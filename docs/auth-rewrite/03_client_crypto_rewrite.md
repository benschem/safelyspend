# Phase 3 — Client crypto rewrite

- **Goal:** Replace `src/lib/e2e-crypto.ts` with the wrapped-key API and add the asymmetric helpers the invite handoff needs.
- **Files:** rewrite `src/lib/e2e-crypto.ts` (new public surface: `deriveKEK`, `generateMasterKey`, `wrap`/`unwrap`, `encryptVault`/`decryptVault`, `generateKeypair`, `wrapForRecipient`/`unwrapFromSender`); new `src/lib/key-vault.ts` (in-memory holder for the unwrapped master key and private key during a session); `src/hooks/use-sync.ts` (uses the master key, not a passphrase-derived key); `src/lib/types.ts` for the new key-material types.
- **Gates:** the Argon2id parameter benchmark (Phase 1 §3.4).
- **Size:** M
- **Deps:** [Phase 1](01_crypto_storage_design.md).

`src/lib/e2e-crypto.ts` is 91 lines and can be replaced outright rather than extended.

Format-v2 ciphertext carries an explicit version byte so a future v3 has a cheap discriminator. Reject anything that is not `0x02`.

## Encrypting IndexedDB at rest is not part of this

Local data stays plaintext on disk. The account password wraps the keys for the cloud vault; it is not a local lock, and there is no local unlock step anywhere in the app.

Two things depend on that being true:

- [Phase 5](05_login_unlock_logout.md) covers the cloud session only.
- [Phase 10](10_privacy_page.md) has to say plainly that on-device data is unencrypted.

`../HANDOVER.md` records the at-rest work as a parked idea, with the reasoning and what would change the answer.
