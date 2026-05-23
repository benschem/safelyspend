# Phase 3 — Client crypto rewrite

- **Goal:** Replace `src/lib/e2e-crypto.ts` with the wrapped-key API; add asymmetric helpers; add IndexedDB at-rest encryption.
- **Files:** rewrite `src/lib/e2e-crypto.ts` (new public surface: `deriveKEK`, `generateMasterKey`, `wrap/unwrap`, `encryptVault/decryptVault`, `generateKeypair`, `wrapForRecipient/unwrapFromSender`); new `src/lib/key-vault.ts` (in-memory holder for the unwrapped master key + private key during a logged-in session); `src/lib/db.ts` (Dexie version bump, middleware that encrypts/decrypts row payloads using the in-memory master key); `src/hooks/use-sync.ts` (uses the master key, not a passphrase-derived key directly); `src/lib/types.ts` for new key-material types.
- **Gates:** Q4 (perf budget — informs per-row vs whole-store encryption and whether reads are sync or async), Q6 (when keys exist in memory).
- **Size:** L
- **Deps:** [Phase 1](01_crypto_storage_design.md).

The format-v2 ciphertext must carry an explicit version byte so [Phase 6](06_migration_v037.md) can detect v1 vs v2 on read and migrate.
