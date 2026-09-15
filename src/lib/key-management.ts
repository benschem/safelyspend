/**
 * Key management for the wrapped-key scheme.
 *
 * Derivation, generation, wrapping, and the vault encrypt/decrypt pair. This
 * module decides *which* key opens *what*; it never lays out bytes. All
 * framing lives in `envelope.ts`, which is also the only place associated data
 * is assembled — see the comment there for why that matters.
 *
 * Three modules, three jobs, and the names are worth keeping straight:
 * `envelope.ts` is bytes, this file is keys, `key-vault.ts` is the in-memory
 * holder for the keys a live session has already unwrapped.
 *
 * Specified by `docs/crypto-design.md`. Section references below point into it.
 */

import { argon2id } from 'hash-wasm';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

import {
  EnvelopeKind,
  openWithKey,
  sealWithKey,
  parseHandoff,
  openHandoff,
  sealHandoff,
} from './envelope';
import { concatBytes } from './bytes';
import type { BudgetBackup } from './db';
import type {
  Argon2idParams,
  Kek,
  Keypair,
  MasterKey,
  PrivateKeyBytes,
  PublicKeyBytes,
} from './types';

/**
 * Locked at m=64 MiB / t=3 / p=1 (section 3.4, benchmarked 2026-09-13).
 * The upgrade path only ever strengthens these; stepping back down is not a
 * supported move, so re-measure before anyone tries it.
 */
export const ARGON2ID_PARAMS: Argon2idParams = {
  memoryKib: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;

const BIP39_ENTROPY_BITS = 128;
const BIP39_PBKDF2_ITERATIONS = 2048;
const BIP39_SEED_LENGTH = 64;
const RECOVERY_HKDF_INFO = 'safelyspend-recovery-kek-v1';
const HANDOFF_HKDF_INFO = 'ss-handoff-v1';

/**
 * Length of the truncated pubkey digest behind a safety number (section 8).
 * 64 bits: a second-preimage search at this width is far beyond anyone who
 * would bother, and it is short enough to read aloud over the phone, which is
 * the whole point of the artefact. Phase 4 owns how it is displayed.
 */
const PUBLIC_KEY_FINGERPRINT_LENGTH = 8;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Section 3.5: NFKD-normalised UTF-8, no trimming, no case folding.
 *
 * Applied here and only here, at the single point of entry. A password that
 * round-trips through a different normalisation once is a permanently
 * unopenable vault, so no caller gets to make this decision.
 */
function passwordBytes(password: string): Uint8Array {
  return textEncoder.encode(password.normalize('NFKD'));
}

async function importAesKey(raw: Uint8Array, extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM' },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Password → KEK_pwd (section 3.1). This is the only derivation that takes a
 * password; KEK_rec comes from a recovery phrase, through
 * `deriveRecoveryKek` below.
 *
 * The returned key is non-extractable: it only ever wraps and unwraps inside
 * Web Crypto, so there is no reason for its bytes to be reachable from JS.
 */
export async function deriveKek(
  password: string,
  salt: Uint8Array,
  params: Argon2idParams = ARGON2ID_PARAMS,
): Promise<Kek> {
  const raw = await argon2id({
    password: passwordBytes(password),
    salt: salt as Uint8Array<ArrayBuffer>,
    memorySize: params.memoryKib,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: KEY_LENGTH,
    outputType: 'binary',
  });
  return importAesKey(raw, false);
}

/**
 * Password → verifier (section 3.3). The client derives this and sends it; the
 * server constant-time-compares it before issuing a session.
 *
 * Same params as `deriveKek`, different salt. `verifier_salt` and `kek_salt`
 * MUST be independent random values — that is the only domain separation
 * between the two derivations, and section 3.3 records that it is sufficient.
 * A login therefore pays Argon2id twice.
 */
export async function deriveVerifier(
  password: string,
  verifierSalt: Uint8Array,
  params: Argon2idParams = ARGON2ID_PARAMS,
): Promise<Uint8Array> {
  return argon2id({
    password: passwordBytes(password),
    salt: verifierSalt as Uint8Array<ArrayBuffer>,
    memorySize: params.memoryKib,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: KEY_LENGTH,
    outputType: 'binary',
  });
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * A fresh household MasterKey (section 2). Extractable, because wrapping it
 * means exporting its raw bytes.
 */
export async function generateMasterKey(): Promise<MasterKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Wrap a MasterKey under a KEK — envelope A, KIND=0x02. */
export async function wrapMasterKey(kek: Kek, masterKey: MasterKey): Promise<Uint8Array> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));
  try {
    return await sealWithKey(EnvelopeKind.wrappedMasterKey, kek, raw);
  } finally {
    raw.fill(0);
  }
}

/** Unwrap a MasterKey. Throws on a wrong KEK (GCM tag failure) or a mismatched KIND. */
export async function unwrapMasterKey(kek: Kek, wrapped: Uint8Array): Promise<MasterKey> {
  const raw = await openWithKey(EnvelopeKind.wrappedMasterKey, kek, wrapped);
  try {
    return await importAesKey(raw, true);
  } finally {
    raw.fill(0);
  }
}

/** Wrap an X25519 private key under a KEK — envelope A, KIND=0x03. */
export async function wrapPrivateKey(kek: Kek, privateKey: PrivateKeyBytes): Promise<Uint8Array> {
  return sealWithKey(EnvelopeKind.wrappedPrivateKey, kek, privateKey);
}

export async function unwrapPrivateKey(kek: Kek, wrapped: Uint8Array): Promise<PrivateKeyBytes> {
  return openWithKey(EnvelopeKind.wrappedPrivateKey, kek, wrapped);
}

/**
 * Encrypt the whole-store snapshot under the MasterKey — envelope A, KIND=0x01.
 * The same envelope serves the cloud blob and, if the at-rest scheme is ever
 * picked up, IndexedDB.
 */
export async function encryptVault(masterKey: MasterKey, data: BudgetBackup): Promise<Uint8Array> {
  const plaintext = textEncoder.encode(JSON.stringify(data));
  return sealWithKey(EnvelopeKind.vault, masterKey, plaintext);
}

export async function decryptVault(
  masterKey: MasterKey,
  envelope: Uint8Array,
): Promise<BudgetBackup> {
  const plaintext = await openWithKey(EnvelopeKind.vault, masterKey, envelope);
  return JSON.parse(textDecoder.decode(plaintext)) as BudgetBackup;
}

/** A long-term X25519 keypair, generated at signup and wrapped under both KEKs. */
export function generateKeypair(): Keypair {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/**
 * Section 4.3: ikm is the static-static secret concatenated with the ephemeral
 * one. The static half is the sender authentication — only the holder of the
 * sender's long-term private key can produce it. The ephemeral half is forward
 * secrecy. The `info` string binds the derived key to this specific pubkey
 * pair, so a handoff cannot be replayed across recipients.
 */
function deriveHandoffKeyBytes(
  sharedStatic: Uint8Array,
  sharedEphemeral: Uint8Array,
  senderPublicKey: PublicKeyBytes,
  recipientPublicKey: PublicKeyBytes,
): Uint8Array {
  const ikm = concatBytes(sharedStatic, sharedEphemeral);
  const info = concatBytes(
    textEncoder.encode(HANDOFF_HKDF_INFO),
    senderPublicKey,
    recipientPublicKey,
  );

  try {
    // salt=null per the spec: `undefined` is how @noble/hashes expresses
    // RFC 5869's salt-not-provided case, which zero-fills to the hash length.
    return hkdf(sha256, ikm, undefined, info, KEY_LENGTH);
  } finally {
    ikm.fill(0);
  }
}

/**
 * Wrap the MasterKey for an invitee — envelope C (section 4.3).
 *
 * `recipientPublicKey` must already have been verified out-of-band (section
 * 7.2). The server-side pubkey column is untrusted; this function cannot tell
 * the difference and does not try.
 */
export async function wrapForRecipient(
  senderPrivateKey: PrivateKeyBytes,
  recipientPublicKey: PublicKeyBytes,
  masterKey: MasterKey,
): Promise<Uint8Array> {
  const senderPublicKey = x25519.getPublicKey(senderPrivateKey);
  const ephemeralPrivateKey = x25519.utils.randomSecretKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  const sharedStatic = x25519.getSharedSecret(senderPrivateKey, recipientPublicKey);
  const sharedEphemeral = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
  const symmetricKeyBytes = deriveHandoffKeyBytes(
    sharedStatic,
    sharedEphemeral,
    senderPublicKey,
    recipientPublicKey,
  );
  const masterKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));

  try {
    const symmetricKey = await importAesKey(symmetricKeyBytes, false);
    return await sealHandoff(
      { senderPublicKey, recipientPublicKey, ephemeralPublicKey },
      symmetricKey,
      masterKeyBytes,
    );
  } finally {
    // Section 4.3 step 7. Best-effort, as in key-vault.ts.
    ephemeralPrivateKey.fill(0);
    sharedStatic.fill(0);
    sharedEphemeral.fill(0);
    symmetricKeyBytes.fill(0);
    masterKeyBytes.fill(0);
  }
}

/**
 * Open an invitee's handoff envelope.
 *
 * `expectedSenderPublicKey` is the sender's key as known through the
 * authenticated channel. The codec refuses before decrypting if the envelope
 * claims anyone else — that is section 4.3's recipient validation rule, and it
 * is what stops the server substituting its own wrap.
 */
export async function unwrapFromSender(
  recipientPrivateKey: PrivateKeyBytes,
  expectedSenderPublicKey: PublicKeyBytes,
  envelope: Uint8Array,
): Promise<MasterKey> {
  const parsed = parseHandoff(envelope);
  const recipientPublicKey = x25519.getPublicKey(recipientPrivateKey);

  const sharedStatic = x25519.getSharedSecret(recipientPrivateKey, expectedSenderPublicKey);
  const sharedEphemeral = x25519.getSharedSecret(recipientPrivateKey, parsed.ephemeralPublicKey);
  const symmetricKeyBytes = deriveHandoffKeyBytes(
    sharedStatic,
    sharedEphemeral,
    expectedSenderPublicKey,
    recipientPublicKey,
  );

  let masterKeyBytes: Uint8Array | null = null;
  try {
    const symmetricKey = await importAesKey(symmetricKeyBytes, false);
    masterKeyBytes = await openHandoff(
      parsed,
      { expectedSenderPublicKey, recipientPublicKey },
      symmetricKey,
    );
    return await importAesKey(masterKeyBytes, true);
  } finally {
    sharedStatic.fill(0);
    sharedEphemeral.fill(0);
    symmetricKeyBytes.fill(0);
    masterKeyBytes?.fill(0);
  }
}

/**
 * A fresh 12-word BIP-39 recovery phrase (section 6.1).
 *
 * Refuses to run without a CSPRNG rather than falling back. A mnemonic from
 * `Math.random` looks identical to a real one and is worth nothing, and this
 * is exactly the fallback someone adds later to make a test pass in a
 * non-secure context.
 */
export function generateRecoveryPhrase(): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Cannot generate a recovery phrase: no cryptographic random source available');
  }
  return generateMnemonic(englishWordlist, BIP39_ENTROPY_BITS);
}

export function isValidRecoveryPhrase(mnemonic: string): boolean {
  return validateMnemonic(normaliseMnemonic(mnemonic), englishWordlist);
}

/**
 * Section 3.5 / BIP-39 section 5: NFKD, single ASCII space between words, no
 * leading or trailing whitespace.
 */
function normaliseMnemonic(mnemonic: string): string {
  return mnemonic.normalize('NFKD').trim().split(/\s+/).join(' ');
}

/**
 * The BIP-39 seed derivation (section 6.2), on Web Crypto's PBKDF2.
 *
 * `passphrase` is BIP-39's optional "25th word". Section 6.1 declines to offer
 * one, so production always takes the empty default and the PBKDF2 salt is
 * exactly `"mnemonic"`. It is a parameter only so the published BIP-39 test
 * vectors — which are generated with the passphrase `"TREZOR"` — can be run
 * against this function rather than against a reimplementation of it.
 */
export async function mnemonicToSeed(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normaliseMnemonic(mnemonic)) as Uint8Array<ArrayBuffer>,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const seedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(
        `mnemonic${passphrase.normalize('NFKD')}`,
      ) as Uint8Array<ArrayBuffer>,
      iterations: BIP39_PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    BIP39_SEED_LENGTH * 8,
  );
  return new Uint8Array(seedBits);
}

/**
 * Recovery phrase → KEK_rec (section 6.2).
 *
 * The PBKDF2 step is BIP-39's own and runs on Web Crypto rather than
 * `@scure/bip39`'s `mnemonicToSeed`. Same output either way; the preference is
 * that a standards-mandated derivation runs on the platform primitive. If you
 * would rather use `mnemonicToSeed`, that is a fine call — make it
 * deliberately and update the note in the phase 3 plan.
 */
export async function deriveRecoveryKek(mnemonic: string): Promise<Kek> {
  const normalised = normaliseMnemonic(mnemonic);
  if (!validateMnemonic(normalised, englishWordlist)) {
    throw new Error('Recovery phrase is not a valid BIP-39 mnemonic');
  }

  const seed = await mnemonicToSeed(normalised);

  try {
    const raw = hkdf(sha256, seed, undefined, textEncoder.encode(RECOVERY_HKDF_INFO), KEY_LENGTH);
    try {
      return await importAesKey(raw, false);
    } finally {
      raw.fill(0);
    }
  } finally {
    seed.fill(0);
  }
}

/**
 * Safety-number input (section 8): SHA-256 of the 32-byte pubkey, truncated.
 * The crypto is fixed here; Phase 4 chooses how to render these bytes.
 *
 * Named in full because `fingerprint` already means something else in this
 * codebase — `importFingerprint` and friends are the transaction dedup hash,
 * an unrelated concept that happens to share the metaphor.
 */
export async function publicKeyFingerprint(publicKey: PublicKeyBytes): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', publicKey as Uint8Array<ArrayBuffer>);
  return new Uint8Array(digest).slice(0, PUBLIC_KEY_FINGERPRINT_LENGTH);
}

/**
 * Distinguishes a wrong key from a malformed blob, for callers that show
 * different copy.
 *
 * Matched on `name` alone. A browser's Web Crypto rejects with a real
 * `DOMException`, but Node's does not — it throws its own `OperationError`
 * class — so an `instanceof DOMException` guard quietly returns false under
 * the test environment and true in production. A predicate that answers
 * differently depending on the realm is worse than a loose one, particularly
 * now that user-facing copy hangs off the answer.
 */
export function isWrongKey(error: unknown): boolean {
  return error instanceof Error && error.name === 'OperationError';
}
