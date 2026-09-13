# Phase 3 — Client crypto rewrite

- **Goal:** Replace `src/lib/e2e-crypto.ts` with the wrapped-key API and add the asymmetric helpers the invite handoff needs.
- **Files:** new `src/lib/envelope.ts` (pure byte codec: `sealWithKey`/`openWithKey`, `sealExportFile`/`parseExportFile`/`openExportFile`, `sealHandoff`/`parseHandoff`/`openHandoff`, plus `encodeArgon2idParams`/`decodeArgon2idParams` and `EnvelopeFormatError`); rewrite `src/lib/e2e-crypto.ts` (public surface: `deriveKEK`, `deriveVerifier`, `generateMasterKey`, `wrap`/`unwrap`, `encryptVault`/`decryptVault`, `generateKeypair`, `wrapForRecipient`/`unwrapFromSender`, `generateRecoveryPhrase`, `deriveKEKFromRecoveryPhrase`, `fingerprint`); new `src/lib/key-vault.ts` (in-memory holder for the unwrapped master key and private key during a session, plus the explicit clear); `src/hooks/use-sync.ts` (uses the master key, not a passphrase-derived key); `src/lib/types.ts` for the new key-material types.
- **Gates:** none. The Argon2id benchmark that gated this phase is done — `../crypto-design.md` §3.4.
- **Prerequisite (not a gate):** `00_overview.md` puts the clean-database reset before this phase — drop the D1 tables and R2 objects, collapse migrations `0001`–`0004` into one household-keyed schema, re-run. It is Phase 2's schema, but it happens first and nothing here assumes a format-v1 read path.
- **Size:** M
- **Deps:** [Phase 1](01_crypto_storage_design.md).

`src/lib/e2e-crypto.ts` is 91 lines and can be replaced outright rather than extended.

Format-v2 ciphertext carries an explicit version byte so a future v3 has a cheap discriminator. Reject anything that is not `0x02`.

## Blast radius

Only two files import the module: `src/hooks/use-sync.ts` and `src/__tests__/lib/e2e-crypto.test.ts`. Nothing else in `src/` touches crypto. The rewrite is therefore contained, and the old test file is deleted rather than adapted — it tests a passphrase API that no longer exists.

## The public surface is wider than the stub said

The stub's file list named `deriveKEK`, `generateMasterKey`, `wrap`/`unwrap`, `encryptVault`/`decryptVault`, `generateKeypair`, `wrapForRecipient`/`unwrapFromSender`. Reading `../crypto-design.md` end to end, three more primitives are load-bearing. The Files line above is amended to include them; this is why each one is there:

- **`deriveVerifier(password, verifierSalt)`** — §3.3 step 2 has the *client* derive `verifier_candidate` and send it to the server. Argon2id at the same params as `deriveKEK`, different salt. Phase 5 cannot log in without it.
- **`generateRecoveryPhrase()` and `deriveKEKFromRecoveryPhrase(mnemonic)`** — §6.1 and §6.2. Phase 4 owns the UI, but the primitive belongs here: signup cannot write the `kek_kind='recovery'` rows without it (§6.3), and Phase 5's recovery flow (§6.4) unwraps with it. Note that these rows are **envelope A**, with the KDF descriptor in the `kek_kdf_kind` / `kek_kdf_params` columns — `KDF_KIND` appears inside an envelope only on variant B (§3.2), which is export files (`KIND=0x05`). No shipping v1 flow writes `KDF_KIND=0x03` on the wire, so the codec does not depend on this primitive; the account flows do.
- **`fingerprint(pubkey)`** — §8 fixes the crypto input as SHA-256 of the 32-byte pubkey truncated to a documented length. Only the display format is Phase 4's call.

Recovery derivation is exactly: `seed = PBKDF2-HMAC-SHA512(mnemonic, salt="mnemonic", 2048, 64)`, then `KEK_rec = HKDF-SHA256(salt=null, ikm=seed, info="safelyspend-recovery-kek-v1", 32)`.

## Dependencies to add

Four, all small, none previously in `package.json`:

- **`hash-wasm`** for Argon2id. Use the ordinary named import, `import { argon2id } from "hash-wasm"`. Measured 2026-09-13 by building both options through Vite in library mode: the named import tree-shakes to 32,242 bytes raw / 11,934 gzipped, while the argon2-only deep import (`hash-wasm/dist/argon2.umd.min.js`) comes to 34,638 / 12,288. The deep import is the *larger* of the two, is UMD rather than ESM, and resolves no types — `argon2.d.ts` sits under `dist/lib/`, which a `dist/*.umd.min.js` specifier will not find. An earlier draft of this plan recommended the deep import on the strength of the raw file sizes in `node_modules`; that reasoning ignored tree-shaking and was wrong. WASM is embedded as base64, so there is no second network fetch and no CSP or asset-path problem either way.
- **`@noble/curves`** for X25519 (`x25519.scalarMult`) — Web Crypto does not expose it. Named in `../crypto-design.md` §4.3.
- **`@noble/hashes`** for HKDF-SHA256 (envelope C key derivation, and the recovery path in §6.2).
- **`@scure/bip39`** plus its English wordlist, for mnemonic generation and validation (§6.1). Missed on the first pass because the stub's surface list omitted recovery entirely.

AES-GCM, SHA-256 and the PBKDF2-HMAC-SHA512 BIP-39 seed step stay on Web Crypto. Nothing hand-rolled.

One deliberate split worth stating, because the obvious implementation does the opposite: `@scure/bip39` also ships `mnemonicToSeed`, which performs that PBKDF2 step itself via `@noble/hashes`. Use it only for `generateMnemonic` and `validateMnemonic`, and take the seed from Web Crypto's `deriveBits`. Same output either way — the preference is that a standards-mandated derivation runs on the platform primitive rather than a JS reimplementation of it, and that `@scure/bip39`'s role stays narrow enough to describe in one clause. If a future reader prefers `mnemonicToSeed`, that is a fine call; make it deliberately and update this line.

## Build it as two layers

The mistake to avoid is one flat module where envelope framing and key management interleave. Split them:

**`src/lib/envelope.ts` (new; absent from the stub's file list, added above) — pure byte codec.** Serialise and parse envelopes A, B and C per §4. No key derivation, no storage, no async beyond Web Crypto. Every function takes bytes and keys and returns bytes. This is the layer the test vectors hit, and it is the layer most likely to be wrong in a way that only shows up months later.

The three variants are named for what a caller reaches for rather than for the mechanism, because nobody thinks "I need the self-describing one" — they think "I am opening an export file":

- `sealWithKey` / `openWithKey` — envelope A. The caller already holds the key and passes the `KIND`, since A carries several.
- `sealExportFile` / `parseExportFile` / `openExportFile` — envelope B. Parse and open are separate because the header is what tells you which KDF to derive the key with.
- `sealHandoff` / `parseHandoff` / `openHandoff` — envelope C. The public keys go in a named object (`HandoffSealKeys`, `HandoffOpenKeys`), not positionally: all three are 32-byte arrays, so a transposed sender and recipient would type-check and then fail to open with no useful message.

Parsed envelopes copy every small header field, so they are the caller's to keep. `ciphertext` alone stays a view into the source buffer — copying a multi-megabyte vault to decrypt it once is not worth it — so the buffer must not be mutated between parse and open. A test pins that.

**`src/lib/e2e-crypto.ts` — the key-management surface.** Derivation, generation, wrapping, and the vault encrypt/decrypt pair. Calls into the codec; never lays out bytes itself.

The split matters because the AAD binding in §4 is a property of the *framing*, not of any caller. If each call site assembles its own associated data, one of them will eventually assemble it slightly differently and the bug will be a decrypt failure in production with no obvious cause. Assemble AAD in exactly one place: the codec, derived from the header it just wrote.

## Details worth pinning before writing code

**Password normalisation.** §3.5 requires NFKD-normalised UTF-8, no trimming, no case folding. `password.normalize('NFKD')` at the single point of entry to `deriveKEK`, not at each caller. A password that round-trips through a different normalisation once is a permanently unopenable vault.

**Two derivations per login.** §3.4 records that a cloud login runs Argon2id twice — once for the verifier (`verifier_salt`), once for `KEK_pwd` (`kek_salt`). Independent salts, no shared work. Measured at 432 ms on an iPhone 11, so run them sequentially in v1; the parallel-workers option stays documented as the lever if that ever becomes the complaint.

**Zeroisation is best-effort in JS and should be labelled as such.** `key-vault.ts` can overwrite the `Uint8Array` backing raw key material, but `CryptoKey` objects are opaque and strings are immutable and GC-controlled. Write the overwrite where it is cheap, and do not let the code imply a guarantee the runtime does not give. Prefer non-extractable `CryptoKey` where the key never needs to leave Web Crypto — that is a real protection, unlike scrubbing a string.

**MasterKey lifetime is tab-close, per Q6**, independent of the 7-day JWT. `key-vault.ts` holds it in a module-level variable and nothing persists it — no `sessionStorage`, no IndexedDB. Reopening a tab on a live session re-derives `KEK_pwd` only (one Argon2id, ~216 ms on the slow device measured). The vault holds **PrivKey as well as MasterKey**: §7's login sweep needs PrivKey in memory to unwrap an envelope C handoff, so a holder that only carries MasterKey blocks Phase 7.

Q6 is "until tab close **or explicit lock**", so `key-vault.ts` exposes a `clear()` alongside the setters — the one function the zeroisation note above exists to serve. Phase 5 calls it on logout and on an explicit lock; logout also clears the server session, and the two are independent in both directions (a cleared vault leaves the JWT alone).

**Recovery rows have a NULL salt, and that is not an error case.** §6.3: `kek_kind='recovery'` rows carry `kek_salt = NULL` because BIP-39 is deterministic from the phrase, and `kek_kind='ecies'` rows carry NULL for both salt and KDF columns. Code that treats a missing salt as corruption will reject perfectly valid rows.

**Refuse to generate a mnemonic without a CSPRNG.** §6.1 is explicit: if `crypto.getRandomValues` is unavailable or throws, hard-error and abort signup. Never fall back to `Math.random`. This is the kind of fallback that gets added later by someone making tests pass in a non-secure context.

**Envelope C needs `RECIPIENT_PUB` in the AAD but not in the wire format.** §4.3's header is `VERSION || KIND || SENDER_PUB || EPHEMERAL_PUB`, while the AAD is `VERSION || KIND || SENDER_PUB || RECIPIENT_PUB || EPHEMERAL_PUB`. The recipient's pubkey is bound without being transmitted — it is known to both sides. Easy to get wrong by assembling AAD as "the header bytes", which is the rule for envelopes A and B but not for C.

## Tests

This is the phase where tests are the deliverable, not a chore appended to it. Per `00_overview.md`, Phase 3 is verified by "unit + integration tests against the schema and crypto primitives; round-trip tests (encrypt → decrypt under derived material) covering every envelope variant, including the asymmetric handoff."

- **Argon2id conformance against published known-answer vectors.** The last outstanding item in the library-selection bullet in `../crypto-design.md` §8. That bullet asks for three things: bundle size is answered, the slow-path benchmark is declined on the record (§3.4 does not measure an Android and says so), conformance is done as of 2026-09-13 and `hash-wasm` passes. Note the source: RFC 9106 §5.3's own vector supplies associated data, and `hash-wasm` hardcodes the associated-data length to zero, so that vector is unreachable through its API. The vectors used are the eight Argon2id v1.3 vectors from the reference implementation (`P-H-C/phc-winner-argon2`, `src/test.c`), which vary password, salt, `t`, `m` and `p` — every input this app varies. §8 records the reasoning.
- **HKDF with `salt=null` against RFC 5869 vectors.** §6.2 warns that an implementation silently substituting a non-zero default salt must be rejected. That substitution produces a working-looking key that simply is not the specified one, so nothing catches it except a vector test.
- **BIP-39 reference vectors**, mnemonic → seed, before the HKDF step. A wrong seed derivation locks every recovery phrase out permanently.
- **Mnemonic generation refuses to run without `crypto.getRandomValues`** (§6.1).
- **Round-trip per envelope variant**, A / B / C, including an empty plaintext and a multi-megabyte one.
- **AAD swap rejection.** Take a wrapped-PrivKey blob (KIND=0x03), rewrite its KIND byte to 0x02, confirm decryption fails. This is the specific attack §4 exists to block, and a test that passes without the AAD binding in place is a test that proves nothing — write it so it fails against a deliberately unbound implementation first.
- **Version byte rejection.** Any first byte that is not `0x02` is a hard failure, not a legacy branch (§4.4).
- **Sender authentication.** An envelope C whose `SENDER_PUB` does not match the pubkey the recipient expects must be refused before decryption is attempted (§4.3 recipient validation rule).
- **NFKD normalisation.** The same password typed in composed and decomposed forms derives the same KEK.
- **A fresh IV per seal.** Nonce reuse under a fixed key is the one AES-GCM mistake that is catastrophic rather than merely wrong, and a single line produces the IV. Seal the same plaintext twice and assert the IV bytes differ.
- **Minimum envelope length includes the GCM tag.** A blob past the header and IV but short of a 16-byte tag must fail as a format error, not as an opaque `OperationError` from inside Web Crypto — callers distinguish "malformed blob" from "wrong key" on that boundary.
- **KDF kind is validated, not asserted.** An unknown byte, and a known-but-underivable one (reserved PBKDF2, or none), are both rejected at parse and refused at seal.

## Order of work

1. Add the four dependencies; confirm the named `hash-wasm` import tree-shakes to roughly the size recorded above.
2. `src/lib/envelope.ts` plus its tests — codec only, no key management, no app wiring.
3. Argon2id conformance vectors. If `hash-wasm` fails these, the library choice reopens and everything after this step waits.
4. `src/lib/e2e-crypto.ts` rewrite against the codec.
5. `src/lib/key-vault.ts`.
6. `src/hooks/use-sync.ts` onto the master key; delete `src/__tests__/lib/e2e-crypto.test.ts` and replace it.
7. `src/lib/types.ts` key-material types — last, once the shapes have stopped moving.

Steps 2–3 are the ones that are expensive to get wrong and cheap to verify. Do not start step 4 until step 3 is green.

## Commit points

The seven steps above are execution order, not commit boundaries. A commit lands where the tree is **green** — `npm run build` and `npm run test:run` both pass — because a commit that does not build is a commit `git bisect` cannot use later.

That test splits the work into five commits:

```
chore: pin the crypto libraries the wrapped-key scheme needs   (step 1)
docs: correct the phase 3 plan against what the design doc says
feat: add the format-v2 envelope codec                          (step 2)
test: check argon2id against the argon2 reference vectors       (step 3)
feat: replace the passphrase crypto with the wrapped-key scheme (steps 4-7)
```

**Steps 4 to 7 are one commit and cannot be split.** Step 4 changes the public surface of `e2e-crypto.ts`, which breaks its only consumer, `use-sync.ts`; nothing type-checks again until step 6 migrates it. The key vault and the new key-material types land in the same commit for the same reason.

**No version bump or changelog entry for this phase.** `CLAUDE.md` asks for both after each commit, but the changelog is written for non-technical users in terms of what they can now do, and nothing in Phase 3 is user-visible — there is no honest sentence to write for "replaced the envelope format". Bump the version and write one entry when [Phase 4](04_onboarding_rewrite.md) or [Phase 5](05_login_unlock_logout.md) makes the capability real. This is a deliberate deviation from the written rule, recorded here so it does not look like an oversight.

## Cloud sync is non-functional between this phase and Phase 5

Worth stating before step 6 rather than discovering during it. `use-sync.ts` currently takes a passphrase straight from the user and derives a key from it. After this phase it takes a MasterKey — and the flows that produce a MasterKey (account creation in [Phase 4](04_onboarding_rewrite.md), login in [Phase 5](05_login_unlock_logout.md)) do not exist yet. The critical path is `3 ──► 2 ──► 4 ──► 5`, so there is a real interval where the sync UI has no way to obtain a key.

This is acceptable, and only because production holds zero vaults and zero real users (verified 2026-09-13: R2 `budget-vaults` is 0 objects, D1 `vaults` and `sync_state` are both empty). Nobody loses data, and nothing is depending on sync working.

What it forbids is shipping the intermediate state to the landing page as though sync worked. Take the decision deliberately at step 6: either disable the sync entry point behind a flag until Phase 5 lands, or accept a knowingly broken control on a site nobody but the maintainer uses. Do not leave it looking functional.

## Encrypting IndexedDB at rest is not part of this

Local data stays plaintext on disk. The account password wraps the keys for the cloud vault; it is not a local lock, and there is no local unlock step anywhere in the app.

Two things depend on that being true:

- [Phase 5](05_login_unlock_logout.md) covers the cloud session only.
- [Phase 10](10_privacy_page.md) has to say plainly that on-device data is unencrypted.

`../HANDOVER.md` records the at-rest work as a parked idea, with the reasoning and what would change the answer.

One consequence for this phase: there is **no Phase 3 at-rest benchmark**. `../crypto-design.md` §5 used to schedule one, to pick between whole-store, per-table and per-row shapes against an open-app-to-dashboard target. No at-rest scheme ships, so there is no shape to pick and nothing to measure; §5 now says so, and the criterion is kept only against the day the work is picked up. The only benchmark this phase owes anyone is the Argon2id conformance run in step 3.
