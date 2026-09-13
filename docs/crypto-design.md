# SafelySpend — Crypto + Storage Design

**Status:** Phase 1 of the auth + couples + privacy rewrite. Locks the cryptographic surface for everything that follows. No code lands until this doc is approved.

**Scope:** key hierarchy, KDF choice, ciphertext envelopes (format v2), recovery-phrase derivation, asymmetric invite handoff. §5 specifies an at-rest scheme that is designed but not scheduled. Does **not** cover backend schema (Phase 2) or client API (Phase 3) — those reference this doc.

**Gating answers used:**
- Q1 (recovery UX) — display + "copy to password manager" CTA + checkbox.
- Q2 (invite handoff) — sweep on every cloud login by the existing member; invitee pubkey is verified out-of-band before the wrap proceeds (§7.2).
- Q4 (perf budget) — envelope is fixed here; Argon2id parameters are benchmarked and locked at m=64 MiB / t=3 / p=1 (§3.4, resolved 2026-09-13).
- Q5 (households) — one household per user in v1.
- Q7 (leaving a household) — not supported in v1; account deletion is the only exit.

## 0. In plain English

### The problem

You and a partner want to share one budget. It syncs through your server. The server must never be able to read it — that's the promise the app makes.

So the data gets encrypted on your device before it's uploaded. Fine. But that raises an awkward question: where does the key live?

### Why not just use the password as the key

The obvious answer is "turn the password into the key". That's what the app does today, and it has two problems.

Change your password, and every byte you've ever encrypted has to be downloaded, decrypted, re-encrypted, re-uploaded. And there's no way to let a partner in without literally telling them your password.

### The fix: lock the key, not the data

One random key encrypts the budget. Call it the master key. It never changes.

Then you put that key inside several locked boxes:

- a box your password opens
- a box your recovery phrase opens
- a box your partner can open

Every box contains the same key. Change your password and you rebuild one small box — the budget data isn't touched. Add a partner and you hand them a box, never your password. Lose your password and the recovery phrase box still opens.

That's the wrapped-key pattern, and it's why the whole rewrite exists.

### Why the password step is deliberately slow

If someone steals your server database, they get locked boxes and nothing else. Their only move is guessing passwords.

So turning a password into a box-key is made expensive on purpose — Argon2id, which burns 64 MB of memory and a chunk of CPU every single attempt. You pay it once at login and never notice: that's the 216 ms measured on an iPhone 11. An attacker pays it on every guess, billions of times, and that's what makes stealing the database not worth much.

---

## 1. Threat model & guarantees

What the server is allowed to see:
- Email (only for cloud-sync users), `password_verifier` (Argon2id of password — see §3.3), public keys, ciphertext blobs, opaque sync metadata (vault version, updated_at), invite tokens, household membership rows.

What the server must **never** see:
- Account password, KEK, household master key, X25519 private keys, plaintext vault, plaintext recovery phrase.

Properties we commit to:
1. **Compromise of server storage** ⇒ attacker has only ciphertext + `password_verifier`. They can offline-brute-force Argon2id against the verifier to recover the password; brute-forcing the wrapped KEK blobs directly has the same cost. No plaintext budget data is recoverable without breaking Argon2id at the chosen params.
2. **Compromise of one user's password** ⇒ attacker can read that user's household vault (intended). Cannot read other households (each has its own master key) and cannot impersonate another household member's pubkey (private key is per-user).
3. **Compromise of the recovery phrase** ⇒ attacker can decrypt any vault ciphertext they have already exfiltrated. They cannot establish a fresh server session on their own (no `password_verifier` is associated with the recovery phrase), so they cannot download fresh blobs without separately compromising the user's email/OTP path.
4. **Loss of both password and recovery phrase** ⇒ data is unrecoverable. Stated honestly on the privacy page (Phase 10).
5. **At-rest device compromise** ⇒ **no protection. This is not a guarantee we make.** IndexedDB holds plaintext on disk. Anyone who can read the browser profile can read the budget, and the account password does not change that — it wraps the keys for the cloud vault only. Full-disk encryption (FileVault, BitLocker) is the control that covers the stolen-laptop case, and it is the user's rather than ours. `auth-rewrite/10_privacy_page.md` carries the obligation to say so plainly.
6. **Compromise of the server's JWT signing key** ⇒ attacker can mint sessions for any user and download ciphertexts, but cannot derive any KEK or MasterKey. Vault contents remain confidential. Attacker can however *write* corrupted ciphertexts back to any account (DoS / integrity attack on the cloud copy; the local IndexedDB copy is unaffected until the corrupted copy is pulled).
7. **All pubkey lookups must produce an authenticated (user_id, pubkey) binding.** Every endpoint that returns a pubkey for the purpose of wrapping (handoff sweep, member directory, future cross-household flows) must be paired with out-of-band verification (§7.2). Server-side signing alone is insufficient because server compromise is already in the threat model.

What we do **not** defend against (out of scope):
- Compromise of the running browser process while the app is unlocked (master key is in memory).
- Hostile JavaScript injected by us, our CDN, or a browser extension (the local-first crypto guarantee depends on the client-side code being the code we shipped).
- Side-channel timing attacks on Web Crypto in a malicious browser.
- **MasterKey rotation is not supported in v1.** If a member's password is compromised, their recovery phrase is compromised, or their unlocked device is captured, the only remediation is account deletion. This is intentional in v1 (one household per user; no other member exists to rewrap) but it widens the blast radius of any of those compromises. Documented on the privacy page (Phase 10).

---

## 2. Key hierarchy

Per-user material:
- **Password** — user input. Never stored, never transmitted in cleartext.
- **Recovery phrase** — 12-word BIP-39 mnemonic generated at signup. Never stored server-side, never transmitted. User-managed.
- **KEK_pwd** — 256-bit AES-GCM key derived from the password (Argon2id, see §3.1).
- **KEK_rec** — 256-bit AES-GCM key derived from the recovery phrase (BIP-39 → HKDF, see §6.2).
- **PrivKey / PubKey** — X25519 keypair generated at signup. PubKey is plaintext server-side. PrivKey is wrapped under both KEK_pwd and KEK_rec. PrivKey doubles as the long-term private key for the authenticated invite handoff (§4.3).

Per-household material (one household per user in v1):
- **MasterKey** — 256-bit AES-GCM key, generated client-side at household creation. Encrypts the vault. Wrapped under each member's KEK_pwd and KEK_rec, stored server-side. Wrapped copies are independent — losing one wrapping does not affect the others.

Per-vault material:
- **Vault** — the serialised Dexie state as a whole-store snapshot (§5). Encrypted under MasterKey. Same envelope used at-rest in IndexedDB and in the cloud blob in R2.

Diagram:

```
       Password                          Recovery phrase (BIP-39)
          │                                       │
   Argon2id(salt_pwd)                  PBKDF2-HMAC-SHA512 ("mnemonic", 2048)
          │                                       │ → BIP-39 seed (64B)
          │                                  HKDF-SHA256
          │                                       │ info="safelyspend-recovery-kek-v1"
          ▼                                       ▼
       KEK_pwd                                KEK_rec
   (256-bit AES-GCM)                       (256-bit AES-GCM)
          │                                       │
   ┌──────┴────────┐                       ┌──────┴────────┐
   │               │                       │               │
   ▼               ▼                       ▼               ▼
wraps           wraps                   wraps           wraps
PrivKey         MasterKey               PrivKey         MasterKey
(per-user)      (per-household)         (per-user)      (per-household)

                              MasterKey
                                  │
                            encrypts (AES-GCM)
                                  │
                                  ▼
                  ┌───────────────┴────────────────┐
                  │                                │
              IndexedDB                       R2 cloud blob
              at-rest (§5)                    (cloud sync)
```

Invariants enforced by the data model:
- Each `(user_id, kek_kind)` row in `user_keys` stores exactly one wrapped `PrivKey` (kek_kind ∈ {pwd, rec}).
- Each `(household_id, user_id, kek_kind)` row in `household_member_keys` stores exactly one wrapped `MasterKey` (kek_kind ∈ {pwd, rec, ecies}). The `ecies` row is transient (see §7) and deleted after the member rewraps under their own KEKs.
- Pubkey-to-user-id binding is authenticated out-of-band wherever it matters (§7.2). The server-side `users.pubkey` column is treated as untrusted until verified by the consuming client.

---

## 3. KDF choice and parameters

### 3.1 Password → KEK_pwd: Argon2id

We are migrating from PBKDF2-SHA256 (600k iterations, the v0.37 status quo) to **Argon2id**. Argon2id is memory-hard, which matters for the only realistic attack here (offline brute-force of `password_verifier` or wrapped-KEK blobs after a server breach). PBKDF2-SHA256 on commodity GPUs is roughly 100× cheaper per guess than Argon2id at comparable wall-clock cost on the legitimate device.

Argon2id is not exposed by Web Crypto. We will use a WASM implementation — candidates evaluated in Phase 3:
- `hash-wasm` (Argon2id, well-maintained, small footprint).
- `@noble/hashes` does not currently ship Argon2id, but Noble is otherwise the reference library — track upstream.

**Target parameters (subject to Phase 3 benchmark — see §3.4):**

| Param | Target | Notes |
|-------|--------|-------|
| Memory (m) | 64 MiB | OWASP 2023 minimum is 19 MiB; we aim higher because we only run Argon2id on unlock, not on every keystroke. |
| Time (t) | 3 iterations | |
| Parallelism (p) | 1 | Browsers expose limited threading; p=1 is the conservative default. |
| Output length | 32 bytes | One 256-bit key. |
| Salt | 16 random bytes, per-user, stored in `user_keys.kek_salt` (for KEK_pwd) and `users.verifier_salt` (for the verifier — must be independent). |
| Associated info | none | Salt + Argon2id internal padding are sufficient domain separation. |

**Wall-clock acceptance criterion:** see §3.4.

**No migration path from PBKDF2 is needed.** No production vault was ever encrypted under the v0.37 scheme, so Argon2id is not a migration target — it is simply what the app uses. PBKDF2 survives in this doc only as the BIP-39 seed derivation (§6.2), where it is mandated by the standard.

### 3.2 KDF version byte

The envelope (see §4) carries a `KDF_KIND` byte so the wrapping algorithm is self-describing:

| KDF_KIND | Meaning | Params shape |
|----------|---------|--------------|
| 0x01 | *Reserved — was PBKDF2-SHA256. Never written; never read. Not reused.* | — |
| 0x02 | Argon2id | `m: uint32 BE`, `t: uint32 BE`, `p: uint8` (9 bytes) |
| 0x03 | BIP-39 + HKDF-SHA256 (recovery) | empty (deterministic from the phrase + the BIP-39 passphrase which we set to empty) |
| 0x04 | None — key arrives via a non-KDF mechanism (MasterKey-direct, or via §4.3 handoff) | empty |

`KDF_KIND` is only present on envelopes that *need* to derive a key on read (envelope variant B, §4.2). At-rest envelopes that re-use the in-memory MasterKey carry no KDF byte. Database rows for envelope A wraps carry `kek_kdf_kind` and `kek_kdf_params` columns; for envelope C (ecies) rows these columns are NULL because the key was not derived via a KDF.

KDF_PARAMS is length-prefixed inside envelope B (§4.2), so future Argon2id revisions can be expressed by either extending the params within KDF_KIND=0x02 (if the addition is backwards-compatible) or by introducing a new KDF_KIND.

### 3.3 Password verifier (server-side authentication)

The server needs a way to refuse session issuance unless the client knows the password, so that email/OTP compromise alone cannot grant server access (read, write, or admin operations on the account).

Construction:

```
verifier = Argon2id(salt=verifier_salt, m=64MiB, t=3, p=1)(password)
```

Stored: `users.password_verifier`, `users.verifier_salt`. **`verifier_salt` and `kek_salt` MUST be independent random values** — this is the only domain separation needed between the verifier and KEK_pwd, and it is sufficient. The two derivations share no intermediate value beyond the password itself.

Authentication flow:
1. Client completes the OTP challenge.
2. Client derives `verifier_candidate = Argon2id(password, verifier_salt, m, t, p)`.
3. Client sends `verifier_candidate` to the server.
4. Server constant-time-compares against the stored `password_verifier`; on match, attaches a session JWT.

Honest characterisation of the residual risk:
- The verifier is offline-brute-forceable at exactly the same cost as recovering KEK_pwd from a stolen wrapped blob (both are Argon2id-of-password with the same params, just different salts). The verifier does not weaken anything, nor does it strengthen anything beyond Argon2id itself. Its purpose is to prevent email/OTP compromise alone from establishing a server session.
- Wrapping the password in HMAC before Argon2id would add nothing: the brute-force adversary attacks the password, not the intermediate HMAC output.

### 3.4 Performance acceptance criterion and Argon2id upgrade path

**Resolved 2026-09-13. Params are m=64 MiB / t=3 / p=1, as targeted.**

The original criterion was 95th-percentile unlock ≤ 2 s on a mid-tier Android, benchmarked across a MacBook, that Android, and Safari iOS. That criterion was written for a public user base the app does not have. The real fleet is the maintainer's own devices, and the maintainer's stated position is that a slow unlock on an old Android is not a cost worth paying security for. The Android leg is therefore **deliberately not measured**, and the slow-path figure is unknown rather than acceptable.

Measured, `hash-wasm` 4.12.0, 20 samples, single derivation:

| Device | m=64 MiB, t=3 | m=32 MiB, t=3 |
|--------|---------------|---------------|
| Apple M1, Node 22 (20 samples) | 134 ms p95 | 64 ms p95 |
| iPhone 11 / A13, Safari (10 samples) | 216 ms p95 | 105 ms p95 |

**Revised criterion:** unlock stays imperceptible on the maintainer's own devices, and `m` is set as high as that allows. The worst measured figure is 216 ms for a single derivation and 432 ms for a full cloud login — roughly 5× inside even the old 2 s budget. 64 MiB is nowhere near a limit, so the m=32 MiB fallback is not taken. It stays documented in case the fleet assumption changes.

**On the unmeasured slow path:** a 2019 A13 came in at only 1.6× the M1, so Safari's WASM carries no special penalty and mobile silicon is not the drag it is often assumed to be. Extrapolating, an old budget Android plausibly lands somewhere near 0.7–1.1 s per derivation, or 1.4–2.2 s for a login — borderline against the old criterion rather than hopeless. That is an extrapolation from two Apple devices, not a measurement, and it is recorded as such.

If the app ever acquires users who are not the maintainer, this section is the one to revisit. Note that the upgrade path below only ever *strengthens* params: stepping 64 MiB back down to 32 MiB is not a supported move, so re-measure before that becomes someone else's problem.

#### A login pays Argon2id twice

Worth stating plainly because "unlock time" hides it. §3.3 derives `verifier_candidate` from `verifier_salt`; §3.1 derives `KEK_pwd` from `kek_salt`. The salts must be independent, so neither derivation reuses the other's work, and a cloud login runs Argon2id **twice**. Re-opening a tab against a live JWT (Q6) derives only `KEK_pwd` and pays it once.

Both derivations need only the password, so Phase 3 may run them concurrently in two Web Workers for roughly one derivation of wall clock, at the cost of holding 2 × m simultaneously — a 128 MiB spike in a phone browser tab. Not needed at current measured speeds; it is the lever to reach for if login latency ever becomes the complaint.

The envelope's KDF_PARAMS field captures the actual params used per-wrap, so future tuning does not require a format bump.

**Upgrade pattern.** When a client unlocks a wrap whose stored Argon2id params are weaker than the current target params, the client:

1. Unlocks normally with the stored params.
2. Re-derives KEK_pwd at the current target params (new salt).
3. Re-wraps PrivKey and MasterKey under the new KEK_pwd.
4. POSTs the new wrapped rows in a single server-side transaction that replaces the old rows atomically (never delete-before-insert; the old rows remain valid until the new rows are durable).
5. On success, the client moves to the new params silently. On failure, retries on next unlock; the user is unaffected.

This makes Argon2id tuning a fleet-wide rolling upgrade triggered by user logins, with no scheduled migration job needed.

### 3.5 Byte-level encoding

Pinned to avoid cross-implementation drift:

- `password` bytes for Argon2id (both the verifier and KEK_pwd derivations) = **NFKD-normalised UTF-8** of the user's typed password. No trimming, no case folding.
- `mnemonic` bytes for the BIP-39 PBKDF2 step (§6.2) = **NFKD-normalised UTF-8**, **single ASCII space (0x20) separator** between words, **no leading or trailing whitespace** — per BIP-39 §5.
- All salts are raw bytes at the crypto layer. Transport encoding (base64 for HTTP payloads, raw for IndexedDB) is Phase 2/3's responsibility.

---

## 4. Ciphertext format v2

Three envelope variants, all sharing the same `VERSION=0x02` first byte. The `KIND` byte signals the use-site so corrupt-blob misuse can be caught early.

```
KIND  | Use site
------+--------------------------------------------------
0x01  | Vault blob (R2 + IndexedDB whole-store)
0x02  | Wrapped MasterKey
0x03  | Wrapped PrivKey
0x04  | Per-record at-rest (reserved Phase 3 fallback only — see §5)
0x05  | Export file (self-contained, embeds KDF params)
0x06  | Authenticated invite-handoff blob (§4.3)
```

**AEAD associated data binding (mandatory for every AES-GCM call).** Every encrypt and decrypt passes the envelope's header bytes as associated data. Specifically:

- Envelope A (§4.1): AAD = `VERSION || KIND`.
- Envelope B (§4.2): AAD = `VERSION || KIND || KDF_KIND || SALT || KDF_PARAMS_LEN || KDF_PARAMS`.
- Envelope C (§4.3): AAD = `VERSION || KIND || SENDER_PUB || RECIPIENT_PUB || EPHEMERAL_PUB`.

Without this binding, a malicious server could swap a ciphertext between slots (e.g., move a wrapped-PrivKey blob into a wrapped-MasterKey row) and AES-GCM would still validate the tag — failing only later in parser code that may not be hardened. With the binding, any swap changes the AAD and forces an authentication failure inside Web Crypto.

### 4.1 Envelope A — symmetric, key external

For blobs where the consumer already has the key in memory (Vault under MasterKey, wrapped blobs whose KDF params live in the DB row alongside).

```
[VERSION:1=0x02] [KIND:1] [IV:12] [CIPHERTEXT:* + GCM_TAG:16]
```

AAD = `VERSION || KIND` (bytes 0–1). Used for KIND ∈ {0x01, 0x02, 0x03, 0x04}.

Why no salt in the envelope: salt belongs to the KDF that derived the *key*. For envelope-A, the key is either MasterKey (no KDF) or a KEK whose salt lives in the row metadata (`user_keys.kek_salt`, `household_member_keys.kek_salt`). Embedding the salt in the blob would be redundant and would couple the blob to the KDF version, defeating the point of having `KDF_KIND` columns.

### 4.2 Envelope B — symmetric, KDF-self-describing

For standalone blobs that must be decryptable without external metadata. Export files (`.safelyspend.bak`) and any future single-file recovery flows.

```
[VERSION:1=0x02] [KIND:1=0x05] [KDF_KIND:1] [SALT:16]
  [KDF_PARAMS_LEN:1] [KDF_PARAMS:KDF_PARAMS_LEN] [IV:12] [CIPHERTEXT:* + GCM_TAG:16]
```

AAD = all header bytes up to and including `KDF_PARAMS` (i.e., `VERSION || KIND || KDF_KIND || SALT || KDF_PARAMS_LEN || KDF_PARAMS`).

`KDF_PARAMS` is laid out per §3.2 (4 bytes for PBKDF2; 9 bytes for Argon2id; 0 bytes for BIP-39+HKDF). `KDF_PARAMS_LEN` is the on-the-wire length and lets a future Argon2id revision extend the params within `KDF_KIND=0x02` if the extension is backwards-compatible.

### 4.3 Envelope C — authenticated asymmetric handoff

For invite handoffs (§7). **Sender-authenticated** static-static + ephemeral X25519 + AES-GCM: the sender uses their long-term X25519 keypair (the same one wrapped in `user_keys`, not a fresh one) so the receiver gets cryptographic evidence that the wrap was authored by the claimed sender — not just by "anyone who knew the recipient's pubkey." The ephemeral key adds forward secrecy for the handoff.

```
[VERSION:1=0x02] [KIND:1=0x06] [SENDER_PUB:32] [EPHEMERAL_PUB:32] [IV:12] [CIPHERTEXT:* + GCM_TAG:16]
```

Construction (sender side):
1. Sender generates an ephemeral X25519 keypair `(eph_priv, eph_pub)`.
2. `shared_static    = X25519(sender_long_term_priv, recipient_pub)`.
3. `shared_ephemeral = X25519(eph_priv, recipient_pub)`.
4. `ikm = shared_static || shared_ephemeral`.
5. `sym_key = HKDF-SHA256(salt=null, ikm, info = "ss-handoff-v1" || sender_pub || recipient_pub, length=32)`.
6. `ciphertext = AES-GCM(key=sym_key, iv, plaintext=MasterKey_bytes, aad = VERSION || KIND || SENDER_PUB || RECIPIENT_PUB || EPHEMERAL_PUB)`.
7. Serialise as envelope C. Zeroise `eph_priv`, `sym_key`, `shared_static`, `shared_ephemeral` from working memory.

Receiver side:
1. `shared_static    = X25519(recipient_priv, sender_pub)`.
2. `shared_ephemeral = X25519(recipient_priv, eph_pub)`.
3. Reconstruct `ikm`, derive `sym_key` with the same HKDF input.
4. AES-GCM decrypt with the same AAD.

Why two shared secrets:
- **Static-static** (`X25519(sender_priv, recipient_pub)`): only the holder of `sender_long_term_priv` can produce a `sym_key` that decrypts under the static contribution from `recipient_priv`. This is the sender authentication.
- **Ephemeral** (`X25519(eph_priv, recipient_pub)`): forward secrecy. Compromising either long-term key *later* does not retroactively decrypt past handoffs, because `eph_priv` was discarded.

This is the libsodium `crypto_box` pattern adapted to X25519 + AES-GCM (rather than X25519 + XSalsa20-Poly1305). Web Crypto does not natively expose X25519; `@noble/curves/ed25519` provides `x25519.scalarMult` and is widely audited.

**Recipient validation rule.** The `SENDER_PUB` byte field MUST equal the sender's pubkey as known to the recipient through the authenticated channel (§7.2 safety-number verification). If it does not, the recipient refuses to decrypt — full stop. This blocks the "server lies about who sent the wrap" attack at the protocol layer; safety-number verification blocks it at the human layer. Defence in depth.

The `info` field binds the handoff to a specific sender-pubkey / recipient-pubkey pair, blocking cross-handoff replay even in the unlikely event of an ephemeral collision.

### 4.4 Version bytes & forward compatibility

`VERSION=0x02` is the only value ever written and the only value ever accepted. Any other first byte is a hard decrypt failure, not a branch into a legacy path. The client refuses it and so does the server (Phase 2 §8).

There is no anti-downgrade state, because there is no weaker format for an attacker to steer a client back onto. A flat rule needs no per-user version tracking; the tombstone-based alternative would.

**This changes if a format v3 ever ships.** At that point weak-format data exists in a live fleet for the first time, and refusing to be downgraded onto v2 becomes a real requirement that needs designing. `DECISIONS.md` records where the earlier work on this lives.

---

## 5. IndexedDB at-rest scheme — specified, not scheduled

**None of this ships.** Local data stays plaintext on disk; `HANDOVER.md` holds the reasoning and what would change it. The specification is kept so that picking it up is a matter of reading rather than redesigning. Nothing else in this doc depends on it — the envelope A / KIND=0x01 shape below is also what the cloud R2 blob uses, and that does ship.

**Default: whole-store snapshot, encrypted as a single envelope A with KIND=0x01.** Same shape as the cloud R2 blob — one ciphertext per vault version, no granularity at the storage layer. This keeps §1.5's at-rest guarantee tight ("envelopes, not plaintext") and is the simplest implementation. For a v1-sized vault (5k transactions, 200 forecast rules, 12 months of range) whole-store is also the fastest read path.

There is no Phase 3 benchmark for this. An earlier draft had one, to confirm whole-store met the perf target; since no at-rest scheme ships there is no shape to pick and nothing to measure. If the work is ever picked up, benchmark then and fall back in this order:

| Shape | When to fall back | Trade-off | Envelope KIND |
|-------|-------------------|-----------|---------------|
| Whole-store snapshot | Default | Fastest reads; some write amplification on small edits; all-or-nothing corruption. | 0x01 |
| Per-table snapshot | Whole-store misses the perf target on writes but reads are fine. | One blob per Dexie table; queries decrypt one table to memory. Cannot use IDB range queries directly. | 0x01 (per blob) |
| Per-row encrypted payload | Both above miss target. **Weakens §1.5 threat-model claim — see below.** | Smallest working set; granular updates. Index columns (id, date, categoryId, scenarioId) leak in plaintext on disk. | 0x04 |

Acceptance criterion, whenever that happens: open-app-to-dashboard time ≤ 2 s on the slow path with a vault of 5,000 transactions, 200 forecast rules, 12 months of date range. The first shape in the table above that meets the criterion wins.

**Per-row leakage caveat (only if we fall back to KIND=0x04).** Dexie indexes operate on plaintext keys. Per-row at rest means the IDB store contains plaintext `id`, `date`, `categoryId`, `scenarioId`, and any index keys needed for range queries. Transaction *amounts*, *descriptions*, and *notes* never leak. An attacker with raw disk access can infer "this user has N transactions on date D categorised under category-id X" but cannot read the amounts or descriptions.

If this fallback is taken, **§1.5 and the Phase 10 privacy page must both be updated** to reflect the weaker on-disk guarantee. Do not silently take this fallback; treat it as a deliberate, documented trade-off that gets re-approved.

The cloud R2 blob is whole-store regardless of the local shape: the server stores one ciphertext per household per version.

---

## 6. Recovery-phrase derivation

### 6.1 Mnemonic generation

- 128 bits of entropy from `crypto.getRandomValues`. **If `crypto.getRandomValues` is unavailable or throws, refuse to generate — never fall back to `Math.random` or any non-CSPRNG source.** Surface a hard error and abort signup.
- BIP-39 wordlist (English) → 12 words.
- We do **not** offer a BIP-39 passphrase ("25th word"); the recovery flow already trades convenience for security and an extra field would push UX past the breaking point.

Storage: nowhere server-side. The phrase is shown once at signup; user copies to a password manager (per Q1) and ticks the acknowledgement. Phase 4 owns the UI.

### 6.2 Mnemonic → KEK_rec

```
mnemonic = NFKD-normalised UTF-8 join of the 12 words, single ASCII space
           separator, no leading or trailing whitespace (per BIP-39 §5).
seed     = PBKDF2-HMAC-SHA512(password=mnemonic, salt="mnemonic",
                              iterations=2048, length=64).
KEK_rec  = HKDF-SHA256(salt=null, ikm=seed,
                       info="safelyspend-recovery-kek-v1", length=32).
```

- The PBKDF2 step is the BIP-39 standard derivation.
- HKDF reduces the 64-byte seed to a 32-byte AES-GCM key with a domain-separating `info` string. The `-v1` suffix lets us migrate the derivation later without invalidating existing phrases (we'd ship a v2 derivation, write a new wrapped row, retire the v1 row after re-wrap).
- `HKDF salt=null` follows RFC 5869's "salt-not-provided" default. Pin a library that handles this correctly (`@noble/hashes` does); reject any implementation that silently substitutes a non-zero default.

### 6.3 What the recovery phrase wraps

Identically to the password path:
- `user_keys` row with `kek_kind='recovery'` holds the recovery-wrapped `PrivKey` (envelope A, KIND=0x03).
- `household_member_keys` row with `kek_kind='recovery'` holds the recovery-wrapped `MasterKey` (envelope A, KIND=0x02).

Salt rules for the non-password key kinds:
- `kek_kind='recovery'` rows: `kek_salt` is NULL (BIP-39 is deterministic from the phrase); `kek_kdf_kind=0x03`; `kek_kdf_params=empty`.
- `kek_kind='ecies'` rows: `kek_salt` is NULL (the per-handoff entropy lives inside envelope C as `eph_pub`); `kek_kdf_kind` and `kek_kdf_params` are NULL because the key was not derived via a KDF.

### 6.4 Recovery flow

1. User enters email → server looks up `users` row → returns `user_id`, `verifier_salt`, and the recovery-kind `user_keys` and `household_member_keys` rows.
2. User enters recovery phrase locally → derives KEK_rec.
3. Unwraps PrivKey and MasterKey. Vault decrypts. App is functional.
4. User is **forced to set a new password** on the next screen before they can do anything else. The new password derives a fresh KEK_pwd; the client builds the new password-wrapped `user_keys` and `household_member_keys` rows and POSTs them.
5. **Atomic swap, not delete-then-insert.** The server-side handler upserts the new password-kind rows in the same transaction that retires the old password-kind rows. If the network drops between step 3 and step 4, the previous-password rows remain valid and the recovery rows are untouched — the user can re-enter the recovery phrase and try again, idempotently. Recovery-kind rows are never deleted by this flow.
6. We **do not** automatically rotate the MasterKey on recovery. Rationale: recovery doesn't imply household compromise; it implies the local password was forgotten. Rotating would force every other household member to re-derive and re-upload, which is broken in v1 (one household per user, so there is no other member except via Phase 7+).

### 6.5 Recovery phrase rotation

Out of scope for v1. If a user suspects their recovery phrase is compromised (e.g. screenshot leaked to a cloud backup), there is no in-app flow to rotate it — they must delete the account and create a fresh one. Documented limitation; revisit when leave-a-household lands (post-v1) since the mechanics overlap.

---

## 7. Invite handoff sequence (sweep on every cloud login)

Per Q2, the existing member's client performs the master-key wrap during their next cloud login. No push, no polling-from-existing-member. The invitee may poll their own wrapped-key endpoint while sitting on a "waiting for partner" screen; the existing member is the active wrapper.

### 7.1 Actors

- **A** — existing household member, logged in and holding `MasterKey_A` in memory.
- **B** — invitee, no account yet (the most complex path; paths 2 and 3 are simpler subsets).
- **Server** — D1 + Workers.

### 7.2 Sequence

Endpoint names below are **roles**, not URLs. Phase 2 owns the actual HTTP shape.

```
A                            Server                            B
│                              │                              │
│ invite-issue                 │                              │
│ (recipient_email,            │                              │
│  household_id)               │                              │
├──────────────────────────────▶                              │
│                              │ INSERT invites (token,       │
│                              │   sender=A, recipient_email, │
│                              │   household_id, status=open, │
│                              │   expires_at=now+3d)         │
│                              │ Resend → B's inbox           │
│                              ├──────────────────────────────▶
│                              │                              │
│                              │                       B clicks link
│                              │                              │
│ ── A is offline at this point ──                            │
│                              │ signup-with-invite           │
│                              │ (password_verifier, salt,    │
│                              │  pubkey, wrapped_priv_pwd,   │
│                              │  wrapped_priv_recovery,      │
│                              │  invite_token)               │
│                              ◀──────────────────────────────┤
│                              │                              │
│                              │ INSERT users, user_keys      │
│                              │ UPDATE invites SET           │
│                              │   recipient_user_id=B,       │
│                              │   status=accepted_pending_   │
│                              │   handoff                    │
│                              │                              │
│                              │ ── NO household_members      │
│                              │    row yet — B has no        │
│                              │    MasterKey, so adding the  │
│                              │    membership row would let  │
│                              │    B see vault bytes it      │
│                              │    cannot decrypt. ──        │
│                              │                              │
│                              │ session JWT                  │
│                              ├──────────────────────────────▶
│                              │                              │
│                              │                  B's app shows
│                              │                  "Waiting for partner
│                              │                   to come online"
│                              │                              │
│                              │           B's client polls (sweep-poll)
│                              │           at a Phase-5-defined cadence.
│                              │                              │
│                              │              ◀───────────────┤
│                              │              404 (not yet)   │
│                              │              ──────────────▶ │
│                              │                              │
│ ⏰ A opens the app, logs in                                  │
│                              │                              │
│ auth-with-otp                │                              │
├──────────────────────────────▶                              │
│ ◀──────────────────────────── session JWT                   │
│                              │                              │
│ sweep-pending-handoffs       │                              │
├──────────────────────────────▶                              │
│ ◀──────────────────────────── [{                            │
│                                  invitee_user_id: B,        │
│                                  invitee_pubkey: ...,       │
│                                  invitee_pubkey_fingerprint,│
│                                  invite_id: ...,            │
│                                  recipient_email: B@x.com   │
│                                }]                           │
│                              │                              │
│  A's UI shows the safety     │                              │
│   number (fingerprint of     │                              │
│   B's pubkey) + recipient    │                              │
│   email.                     │                              │
│  A confirms out-of-band      │                              │
│   (text/call/in-person) with │                              │
│   B and taps "approve".      │                              │
│                              │                              │
│  locally:                    │                              │
│   handoff-wrap(MasterKey_A,  │                              │
│                A.priv,       │                              │
│                B.pubkey)     │                              │
│   → envelope C (§4.3,        │                              │
│     authenticated)           │                              │
│                              │                              │
│ household-add-member         │                              │
│ (user_id: B,                 │                              │
│  wrapped_master_ecies,       │                              │
│  invite_id)                  │                              │
├──────────────────────────────▶                              │
│                              │ (single transaction)         │
│                              │ INSERT household_members     │
│                              │   (B, role='member')         │
│                              │ INSERT household_member_keys │
│                              │   (B, kek_kind='ecies',      │
│                              │    wrapped_master_key, ...)  │
│                              │ UPDATE invites SET           │
│                              │   status=completed           │
│ ◀────────────────────────────┤                              │
│                              │                              │
│                              │           B's next poll:     │
│                              │ sweep-poll                   │
│                              │              ◀───────────────┤
│                              │ 200 { kek_kind='ecies',      │
│                              │       wrapped_master_key,    │
│                              │       sender_pubkey,         │
│                              │       sender_user_id,        │
│                              │       sender_pubkey_         │
│                              │         fingerprint }        │
│                              │              ──────────────▶ │
│                              │                              │
│                              │            B's UI shows the  │
│                              │            sender's safety   │
│                              │            number. B confirms│
│                              │            with A out-of-    │
│                              │            band, then taps   │
│                              │            "accept".         │
│                              │                              │
│                              │            B's client checks │
│                              │            envelope's        │
│                              │            SENDER_PUB ==     │
│                              │            sender_pubkey;    │
│                              │            unwraps via §4.3; │
│                              │            re-wraps          │
│                              │            MasterKey under   │
│                              │            KEK_pwd_B and     │
│                              │            KEK_rec_B.        │
│                              │                              │
│                              │ rewrap-member-keys           │
│                              │ (wrapped_master_pwd,         │
│                              │  wrapped_master_recovery,    │
│                              │  kek_salt_pwd,               │
│                              │  kek_kdf_params_pwd)         │
│                              │              ◀───────────────┤
│                              │ (single transaction)         │
│                              │ UPSERT household_member_keys │
│                              │   (B, kek_kind='pwd', ...)   │
│                              │ UPSERT household_member_keys │
│                              │   (B, kek_kind='recovery',   │
│                              │    ...)                      │
│                              │ DELETE household_member_keys │
│                              │   WHERE B AND                │
│                              │   kek_kind='ecies'           │
│                              │              ──────────────▶ │
│                              │                              │
│                              │            B fully provisioned.
│                              │            Polling stops; vault
│                              │            sync begins.
```

**Out-of-band safety-number verification — the primary defence against a malicious server.**

Before A's client wraps the MasterKey under what the server claims is B's pubkey, A's UI displays a short, human-comparable fingerprint of `invitee_pubkey` (e.g. 6 decimal groups of 5 digits, derived by truncating SHA-256(pubkey) and chunking — Phase 4 picks the exact display format). A confirms the fingerprint with B via a side channel they already trust: text, phone call, in person. They are a couple; the side channel exists.

Symmetrically, when B's client receives the wrap, it shows B the sender's fingerprint and asks B to confirm with A out-of-band before unwrapping. Only after explicit user confirmation on both sides does the handoff complete.

A malicious or breached server that substitutes an attacker's pubkey on either side will produce a different fingerprint on the affected screen. A and B will catch this during the side-channel confirmation.

This is the same pattern as Signal/WhatsApp safety numbers. It is the only defence in our threat model that actually withstands a fully compromised server, because every server-side signing key is itself in the server's compromise blast radius.

Without out-of-band confirmation, server compromise directly compromises every new household handoff. **The Phase 4 UI cannot ship the handoff approval without the safety number on screen.**

The handoff is *also* cryptographically sender-authenticated (§4.3): even with no out-of-band step, the envelope binds `SENDER_PUB` into the AAD, so B's client refuses to decrypt unless the claimed sender pubkey matches A's pubkey-as-known-to-B. This is defence in depth, not a substitute for the out-of-band check.

### 7.3 Failure modes

- **Invite expires before A logs in:** `expires_at` is checked at invite-accept time or by a server-side sweep. If B hasn't completed signup, the invite is dropped silently. If B *has* completed signup (path 1) but A never came online, the invite row stays in `accepted_pending_handoff`. We do **not** auto-expire those — the household_members row still doesn't exist, so there's no leak. A is shown a banner on next login: "Pending invite to B — you've been offline for 7+ days." A can re-send or cancel.
- **A is compromised between issuing invite and wrapping:** Attacker holding A's keys can complete the wrap themselves, silently adding B to the household. Equivalent to A doing it. Mitigation belongs to A's account security (password strength, OTP), not this flow.
- **B's pubkey is wrong / forged (server attack):** Defended by §7.2 out-of-band safety-number verification. A's UI shows the fingerprint; A confirms with B via a side channel before wrapping. A malicious server cannot bypass this without also compromising the side channel. Server-side signing of the pubkey row is not an alternative: server compromise is in the threat model, and an HMAC key held by the compromised server defends nothing.
- **Server lies about who wrapped a key to B (sender substitution):** Defended cryptographically by §4.3 — envelope C carries `SENDER_PUB` in both the body and the AAD, so a wrap can only decrypt cleanly if `SENDER_PUB` matches the sender_pubkey the receiver is verifying against. The server cannot mint an envelope that looks like it came from A without holding A's long-term private key.
- **Mid-flow crash on B's side after ECIES unwrap but before rewrap:** B's `kek_kind='ecies'` row sits on the server indefinitely. On B's next login, the client detects "I have an ecies row but no pwd/recovery row for this household" and re-runs the rewrap. Idempotent.
- **Mid-flow crash between A's `household-add-member` and B's `rewrap-member-keys`:** The server must implement each as a single transaction (membership insert + ecies-row insert + invite status update; and separately the rewrap upsert + ecies-row delete). Phase 2 must confirm D1 supports the needed transaction semantics. If a transaction partially succeeds, operator intervention is required — we treat this as a "should not happen" path, not a flow.

### 7.4 Three acceptance paths (recap)

All three converge on the sequence in §7.2 from the point where the server has `pubkey` + `wrapped_priv_*` for B. The differences are pre-signup:

1. **No account → click link → sign up there → accept dialog.** Signup payload includes `invite_token` directly.
2. **No account → sign up from landing → in-app banner.** Server's signup handler runs `check_for_invites` (sweep pending invites by email), auto-attaches; the client shows a banner and B accepts it.
3. **Has account → click link → accept dialog.** B's signup is already done; the accept dialog hits `invite-accept` and the rest of the flow proceeds.

All three end with B in `accepted_pending_handoff` until A's next login.

---

## 8. Open issues for Phase 2+

Carried forward, not resolved here:

- ~~**Argon2id WASM library selection**~~ — **resolved 2026-09-13.** `hash-wasm` 4.12.0 is selected, on bundle size, measured speed (§3.4) and now conformance. The slow-path leg stays deliberately unmeasured. Conformance is checked in `src/__tests__/lib/argon2-conformance.test.ts` against the eight Argon2id v1.3 known-answer vectors in the reference implementation's own test suite (`P-H-C/phc-winner-argon2`, `src/test.c`) — all pass, varying password, salt, `t`, `m` and `p`. RFC 9106 §5.3's own vector is **not** used, and cannot be: it supplies 12 bytes of associated data, and `hash-wasm` hardcodes the associated-data length to zero when it computes H0. The vector is unreachable through the library's API rather than failing against it. Nothing is lost — no flow in this design passes associated data to Argon2id, and the reference vectors cover every input that does vary.
- ~~**Argon2id final params**~~ — **resolved 2026-09-13** (§3.4): m=64 MiB / t=3 / p=1. Upgrade pattern was already locked.
- **At-rest shape** (§5) — moot unless the at-rest scheme is ever picked up; no scheme ships, so there is no shape to pick. If it is, only fall back from whole-store with explicit threat-model and privacy-page updates.
- **Password policy is unspecified** — noticed in Phase 3, 2026-09-13. This doc fixes how a password is *turned into* a key (§3.1) and concedes that `password_verifier` is offline-brute-forceable after a server breach (§1, property 1), but never says what a password is allowed to be. §7.3 delegates a mitigation to "password strength, OTP" while assuming a policy exists somewhere; none does. The shipped UI enforces 8 characters, inherited from when the secret was a local vault passphrase that never left the device. Argon2id's cost is a multiplier on guessing, not a substitute for entropy in what is being guessed. Phase 4 owns the decision (`auth-rewrite/04_onboarding_rewrite.md`); it is recorded here because the gap is this doc's, not Phase 4's.
- **Safety-number fingerprint encoding** (§7.2) — exact display format (decimal groups vs base32 vs emoji-grid) is Phase 4's UX call; the *crypto* input (SHA-256 of the 32-byte pubkey, truncated to a documented length) is fixed here.
- **D1 transaction guarantees** (§7.3) — Phase 2 confirms that the membership-insert and rewrap operations can each be issued atomically on D1.
- **Sweep-poll cadence** (§7.2) — Phase 5's call. Defaults probably 10–30 s with exponential backoff after several misses.
- **Recovery phrase rotation** (§6.5) — punted to post-v1.
- **Leave-a-household crypto** (Q7) — punted to post-v1. Requires MasterKey rotation, which is a new flow not designed here.
- **MasterKey rotation in general** (§1) — not supported in v1. Any future support changes the threat model (§1) and the recovery flow (§6.4); revisit alongside Q7.

## 9. What this doc deliberately doesn't say

- No code, no API signatures, no HTTP paths — those are Phase 3 (client) and Phase 2 (server). Sequence diagrams in §7 use role names.
- No SQL — Phase 2.
- No UI copy for the recovery phrase moment or the safety-number confirmation — Phase 4.
- No exact bundle-size budget for Argon2id WASM — Phase 3.

The job here is to make every downstream phase's design call obvious. If a phase finds it needs a different envelope, KDF, or key, the change starts back here.
