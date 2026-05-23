# Phase 1 — Crypto + storage design doc

- **Goal:** Single source-of-truth `.md` for the wrapped-key + Curve25519 + IndexedDB-at-rest design. No code yet.
- **Files:** new `docs/crypto-design.md`; eventual touch-ups to `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` once locked.
- **Gates:** Q1 (recovery phrase UX), Q2 (invite handoff choreography), Q4 (Web Crypto perf budget), Q5 (one vs many households), Q7 (leaving a household).
- **Size:** M
- **Deps:** none — foundation for everything below.

## Must specify

- Key hierarchy (passphrase-KEK → wraps personal pubkeypair-priv + wraps household master key; household master key → encrypts vault).
- KDF choice + params (PBKDF2 vs Argon2id — current code uses PBKDF2 600k, revisit).
- Exact ciphertext formats with version bytes.
- IndexedDB at-rest scheme (per-record vs whole-store, encrypted via Dexie middleware).
- Recovery-phrase derivation (BIP-39 mnemonic → backup KEK that also wraps the master key, so the phrase alone can recover without the password).
- The asymmetric handoff sequence diagram for invites.
