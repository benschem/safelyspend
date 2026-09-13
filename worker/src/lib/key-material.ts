/** Server-side structural validation of the wrapped-key material clients upload.
 *
 *  The server never decrypts any of this. It validates shape only, so that obviously
 *  wrong bytes are rejected at the door rather than latching into the database.
 *  Malicious-but-well-formed input is caught client-side at decrypt time by the AAD
 *  binding (crypto-design section 4), not here.
 *
 *  Rules come from 02_backend_schema_endpoints_design.md section 8 and
 *  crypto-design.md sections 3.2, 4 and 6.3.
 */

import { base64urlToBytes } from './bytes.js';
import { invalidBlob } from './errors.js';

/** The only ciphertext format version ever written or accepted. Any other leading
 *  byte is a hard rejection — there is no legacy branch to take. */
export const FORMAT_VERSION = 0x02;

export const EnvelopeKind = {
  Vault: 0x01,
  WrappedMasterKey: 0x02,
  WrappedPrivKey: 0x03,
  Handoff: 0x06,
} as const;
export type EnvelopeKindValue = (typeof EnvelopeKind)[keyof typeof EnvelopeKind];

export const KdfKind = {
  /** Reserved. Was PBKDF2-SHA256 in v1; never written, never read, never reused. */
  Pbkdf2Reserved: 0x01,
  Argon2id: 0x02,
  Bip39Hkdf: 0x03,
} as const;

export const KEK_KINDS = ['pwd', 'recovery', 'ecies'] as const;
export type KekKind = (typeof KEK_KINDS)[number];

/** VERSION + KIND + IV(12) + GCM tag(16). */
const ENVELOPE_A_MIN_BYTES = 30;
/** VERSION + KIND + SENDER_PUB(32) + EPHEMERAL_PUB(32) + IV(12) + GCM tag(16). */
const ENVELOPE_C_MIN_BYTES = 110;
/** A wrapped 32-byte key cannot plausibly exceed this. */
const WRAPPED_KEY_MAX_BYTES = 1024;

const SALT_BYTES = 16;
const PUBKEY_BYTES = 32;
const VERIFIER_BYTES = 32;
/** Argon2id params: m uint32 BE, t uint32 BE, p uint8. */
const ARGON2ID_PARAMS_BYTES = 9;

/** Decode a required base64url field, or reject. */
export function decodeRequired(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidBlob();
  }
  const bytes = base64urlToBytes(value);
  if (!bytes) {
    throw invalidBlob();
  }
  return bytes;
}

/** Decode a field that may legitimately be absent, null, or the empty string.
 *  An empty string decodes to a zero-length array, which is what a recovery row's
 *  kek_kdf_params is meant to be — that is distinct from SQL NULL. */
export function decodeOptional(value: unknown): Uint8Array | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidBlob();
  }
  const bytes = base64urlToBytes(value);
  if (!bytes) {
    throw invalidBlob();
  }
  return bytes;
}

function assertEnvelope(bytes: Uint8Array, kind: EnvelopeKindValue, minBytes: number): void {
  if (bytes.length < minBytes || bytes.length > WRAPPED_KEY_MAX_BYTES) {
    throw invalidBlob();
  }
  if (bytes[0] !== FORMAT_VERSION || bytes[1] !== kind) {
    throw invalidBlob();
  }
}

/** Envelope A, KIND=0x02 — a MasterKey wrapped under a KEK. */
export function assertWrappedMasterKey(bytes: Uint8Array): void {
  assertEnvelope(bytes, EnvelopeKind.WrappedMasterKey, ENVELOPE_A_MIN_BYTES);
}

/** Envelope A, KIND=0x03 — a PrivKey wrapped under a KEK. */
export function assertWrappedPrivKey(bytes: Uint8Array): void {
  assertEnvelope(bytes, EnvelopeKind.WrappedPrivKey, ENVELOPE_A_MIN_BYTES);
}

/** Envelope C, KIND=0x06 — the authenticated invite handoff. */
export function assertHandoffEnvelope(bytes: Uint8Array): void {
  assertEnvelope(bytes, EnvelopeKind.Handoff, ENVELOPE_C_MIN_BYTES);
}

/** Vault blobs are only checked for their leading version and kind bytes; their
 *  length is bounded by the upload size limit rather than by a key-sized cap. */
export function assertVaultBlob(bytes: Uint8Array): void {
  if (bytes.length < ENVELOPE_A_MIN_BYTES) {
    throw invalidBlob();
  }
  if (bytes[0] !== FORMAT_VERSION || bytes[1] !== EnvelopeKind.Vault) {
    throw invalidBlob();
  }
}

/** The KDF metadata columns that travel alongside a wrapped blob. */
export interface KekMetadata {
  kekKind: KekKind;
  kekSalt: Uint8Array | null;
  kekKdfKind: number | null;
  kekKdfParams: Uint8Array | null;
}

/** Cross-column consistency for a kek_kind row (design section 8.2).
 *
 *  Note this rejects kek_kdf_kind=0x01. Phase 2's table admits {0x01, 0x02} for 'pwd',
 *  but Phase 1 section 3.2 reserves 0x01 as never-written, and v2 clients only derive
 *  Argon2id. Accepting a PBKDF2 row would let a client downgrade its own KEK.
 */
export function assertKekMetadata(metadata: KekMetadata): void {
  const { kekKind, kekSalt, kekKdfKind, kekKdfParams } = metadata;

  if (kekKind === 'pwd') {
    if (!kekSalt || kekSalt.length !== SALT_BYTES) throw invalidBlob();
    if (kekKdfKind !== KdfKind.Argon2id) throw invalidBlob();
    if (!kekKdfParams || kekKdfParams.length !== ARGON2ID_PARAMS_BYTES) throw invalidBlob();
    return;
  }

  if (kekKind === 'recovery') {
    if (kekSalt !== null) throw invalidBlob();
    if (kekKdfKind !== KdfKind.Bip39Hkdf) throw invalidBlob();
    if (!kekKdfParams || kekKdfParams.length !== 0) throw invalidBlob();
    return;
  }

  // 'ecies': the per-handoff entropy lives inside envelope C, so every KDF column
  // is NULL. This kind is never accepted from a client on the key-upload paths.
  if (kekSalt !== null || kekKdfKind !== null || kekKdfParams !== null) {
    throw invalidBlob();
  }
}

export function assertPubkey(bytes: Uint8Array): void {
  if (bytes.length !== PUBKEY_BYTES) {
    throw invalidBlob();
  }
}

export function assertVerifier(bytes: Uint8Array): void {
  if (bytes.length !== VERIFIER_BYTES) {
    throw invalidBlob();
  }
}

/** The KDF metadata columns that travel alongside users.password_verifier. */
export interface VerifierMetadata {
  verifierSalt: Uint8Array;
  verifierKdfKind: unknown;
  verifierKdfParams: Uint8Array;
}

/** users.verifier_* columns. Argon2id only; PBKDF2 verifiers are v1-legacy.
 *
 *  Takes an object rather than positional arguments so that the two same-typed byte
 *  fields cannot be transposed silently — a swap would type-check and then surface as
 *  an unexplained INVALID_BLOB. */
export function assertVerifierMetadata(metadata: VerifierMetadata): void {
  const { verifierSalt, verifierKdfKind, verifierKdfParams } = metadata;

  if (verifierSalt.length !== SALT_BYTES) throw invalidBlob();
  if (verifierKdfKind !== KdfKind.Argon2id) throw invalidBlob();
  if (verifierKdfParams.length !== ARGON2ID_PARAMS_BYTES) throw invalidBlob();
}

/** One wrapped-key row as it arrives on the wire. */
export interface WrappedKeyInput extends KekMetadata {
  wrapped: Uint8Array;
}

/** Which blob column the entry carries, which in turn picks the envelope kind it has
 *  to match: user_keys rows wrap a PrivKey, household_member_keys rows a MasterKey. */
export type WrappedKeyField = 'wrappedPrivKey' | 'wrappedMasterKey';

interface RawKeyEntry {
  kekKind?: unknown;
  kekSalt?: unknown;
  kekKdfKind?: unknown;
  kekKdfParams?: unknown;
  wrappedPrivKey?: unknown;
  wrappedMasterKey?: unknown;
}

/** Validate one wrapped-key row against a KEK kind the caller has already settled.
 *  Every upload path funnels through here, so the envelope check and the cross-column
 *  metadata check can never drift apart between endpoints. */
function parseWrappedKey<Kind extends KekKind>(
  entry: unknown,
  blobField: WrappedKeyField,
  kekKind: Kind,
): WrappedKeyInput & { kekKind: Kind } {
  if (typeof entry !== 'object' || entry === null) {
    throw invalidBlob();
  }
  const raw = entry as RawKeyEntry;

  const wrapped = decodeRequired(raw[blobField]);
  if (blobField === 'wrappedPrivKey') {
    assertWrappedPrivKey(wrapped);
  } else {
    assertWrappedMasterKey(wrapped);
  }

  const metadata = {
    kekKind,
    kekSalt: decodeOptional(raw.kekSalt),
    kekKdfKind: typeof raw.kekKdfKind === 'number' ? raw.kekKdfKind : null,
    kekKdfParams: decodeOptional(raw.kekKdfParams),
  };
  assertKekMetadata(metadata);

  return { ...metadata, wrapped };
}

function parseKeyEntry(entry: unknown, blobField: WrappedKeyField): WrappedKeyInput {
  if (typeof entry !== 'object' || entry === null) {
    throw invalidBlob();
  }
  const { kekKind } = entry as RawKeyEntry;

  // 'ecies' is deliberately absent: that row is minted server-side during a handoff
  // and is never something a client uploads.
  if (kekKind !== 'pwd' && kekKind !== 'recovery') {
    throw invalidBlob();
  }
  return parseWrappedKey(entry, blobField, kekKind);
}

/** Parse the lone password-wrapped row that the recovery reset replaces.
 *
 *  The kind is imposed rather than read: this endpoint swaps the password path only,
 *  and the recovery rows have to survive it untouched — they are what the caller just
 *  used to get here. A client that labelled the row 'recovery' would otherwise be
 *  asking to overwrite its own way back in. */
export function parsePasswordKey(
  value: unknown,
  blobField: WrappedKeyField,
): WrappedKeyInput & { kekKind: 'pwd' } {
  return parseWrappedKey(value, blobField, 'pwd');
}

/** Parse and validate the mandatory {pwd, recovery} pair the key-upload endpoints
 *  require. Partial uploads are rejected: a client that writes one row and not the
 *  other leaves an account that can be unlocked only one way, silently. */
export function parseKeyPair(
  value: unknown,
  blobField: WrappedKeyField,
): { pwd: WrappedKeyInput; recovery: WrappedKeyInput } {
  if (!Array.isArray(value) || value.length !== 2) {
    throw invalidBlob();
  }

  const entries = value.map((entry) => parseKeyEntry(entry, blobField));
  const pwd = entries.find((entry) => entry.kekKind === 'pwd');
  const recovery = entries.find((entry) => entry.kekKind === 'recovery');

  if (!pwd || !recovery) {
    throw invalidBlob();
  }
  return { pwd, recovery };
}
