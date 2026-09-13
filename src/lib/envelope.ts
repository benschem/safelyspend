/**
 * Format-v2 ciphertext envelopes.
 *
 * A pure byte codec: it lays out headers, calls AES-GCM, and parses headers
 * back. It never derives a key, never touches storage, and never decides
 * policy. See `docs/crypto-design.md` section 4 for the specification.
 *
 * Three variants, named for what you reach for rather than for the mechanism:
 *
 * - `sealWithKey` / `openWithKey` — envelope A. You already hold the key; you
 *   pass the KIND, because A carries several.
 * - `sealExportFile` / `parseExportFile` / `openExportFile` — envelope B. The
 *   header names the KDF and its parameters, so the file opens standalone.
 * - `sealHandoff` / `parseHandoff` / `openHandoff` — envelope C. Authenticated
 *   asymmetric handoff of the MasterKey to an invitee.
 *
 * The parse functions copy every small header field, so a parsed envelope is
 * yours to keep. The one exception is `ciphertext`, which stays a `subarray`
 * view into the buffer you handed in — copying a multi-megabyte vault to
 * decrypt it once is not worth the peace of mind. Do not mutate the source
 * buffer between parsing and opening.
 *
 * Every AES-GCM call in the app passes associated data built from the
 * envelope header. That binding is what stops a malicious server moving a
 * blob between slots — swapping a wrapped-PrivKey ciphertext into a
 * wrapped-MasterKey row changes the KIND byte, which changes the AAD, which
 * fails authentication inside Web Crypto rather than somewhere later in
 * parser code. The binding only works if it is assembled in exactly one
 * place, so it is assembled here and nowhere else.
 */

export const FORMAT_VERSION = 0x02;

/** Identifies the use site, so a blob in the wrong slot is caught early. */
export const EnvelopeKind = {
  vault: 0x01,
  wrappedMasterKey: 0x02,
  wrappedPrivateKey: 0x03,
  perRecordAtRest: 0x04,
  exportFile: 0x05,
  inviteHandoff: 0x06,
} as const;

export type EnvelopeKindValue = (typeof EnvelopeKind)[keyof typeof EnvelopeKind];

/** Identifies how the key was derived, for envelopes that must say so. */
export const KdfKind = {
  reservedPbkdf2: 0x01,
  argon2id: 0x02,
  bip39Hkdf: 0x03,
  none: 0x04,
} as const;

export type KdfKindValue = (typeof KdfKind)[keyof typeof KdfKind];

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const PUBLIC_KEY_LENGTH = 32;
const ARGON2ID_PARAMS_LENGTH = 9;

/** Every envelope opens with the same two bytes: VERSION then KIND. */
const VERSION_AND_KIND_LENGTH = 2;
const MAX_KDF_PARAMS_LENGTH = 0xff;

/** Envelope A carries no KDF descriptor; these kinds are the ones that use it. */
const KEYED_KINDS: readonly EnvelopeKindValue[] = [
  EnvelopeKind.vault,
  EnvelopeKind.wrappedMasterKey,
  EnvelopeKind.wrappedPrivateKey,
  EnvelopeKind.perRecordAtRest,
];

const KNOWN_KDF_KINDS: readonly number[] = Object.values(KdfKind);

/** Envelope B must name a KDF that can actually derive a key. */
const DERIVABLE_KDF_KINDS: readonly number[] = [KdfKind.argon2id, KdfKind.bip39Hkdf];

/**
 * How many parameter bytes each derivable KDF is defined to carry (section
 * 3.2). Checked on seal so a malformed block fails on the side of the wire
 * that can still do something about it.
 */
const KDF_PARAMS_LENGTHS: Readonly<Record<number, number>> = {
  [KdfKind.argon2id]: ARGON2ID_PARAMS_LENGTH,
  [KdfKind.bip39Hkdf]: 0,
};

const MAX_UINT32 = 0xffffffff;
const MAX_UINT8 = 0xff;

function assertFitsIn(label: string, value: number, maximum: number): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new EnvelopeFormatError(
      `${label} must be an integer between 0 and ${maximum}, found ${value}`,
    );
  }
}

export class EnvelopeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeFormatError';
  }
}

function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

function readByte(envelope: Uint8Array, offset: number, description: string): number {
  const value = envelope[offset];
  if (value === undefined) {
    throw new EnvelopeFormatError(`Envelope is too short to carry ${description}`);
  }
  return value;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function assertVersion(envelope: Uint8Array): void {
  // Section 4.4: 0x02 is the only value ever written and the only value ever
  // accepted. A different byte is a hard failure, never a legacy branch.
  const version = readByte(envelope, 0, 'a version byte');
  if (version !== FORMAT_VERSION) {
    throw new EnvelopeFormatError(`Unsupported envelope version: 0x${toHex(version)}`);
  }
}

function assertKind(envelope: Uint8Array, expected: EnvelopeKindValue): void {
  const kind = readByte(envelope, 1, 'a kind byte');
  if (kind !== expected) {
    throw new EnvelopeFormatError(
      `Envelope kind mismatch: expected 0x${toHex(expected)}, found 0x${toHex(kind)}`,
    );
  }
}

function assertKeyedKind(kind: EnvelopeKindValue): void {
  if (!KEYED_KINDS.includes(kind)) {
    throw new EnvelopeFormatError(`Envelope A cannot carry kind 0x${toHex(kind)}`);
  }
}

/**
 * Reject any KDF kind that envelope B must not name: unknown values, and the
 * two known values (reserved PBKDF2, and "none") that cannot derive a key at
 * all — an export file whose header names those is not openable standalone.
 */
function assertDerivableKdfKind(value: number): asserts value is KdfKindValue {
  if (!KNOWN_KDF_KINDS.includes(value)) {
    throw new EnvelopeFormatError(`Unknown KDF kind: 0x${toHex(value)}`);
  }
  if (!DERIVABLE_KDF_KINDS.includes(value)) {
    throw new EnvelopeFormatError(
      `KDF kind 0x${toHex(value)} cannot derive a key and must not appear in an export file`,
    );
  }
}

async function encryptWithAad(
  key: CryptoKey,
  iv: Uint8Array,
  associatedData: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as Uint8Array<ArrayBuffer>,
      additionalData: associatedData as Uint8Array<ArrayBuffer>,
    },
    key,
    plaintext as Uint8Array<ArrayBuffer>,
  );
  return new Uint8Array(ciphertext);
}

async function decryptWithAad(
  key: CryptoKey,
  iv: Uint8Array,
  associatedData: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as Uint8Array<ArrayBuffer>,
      additionalData: associatedData as Uint8Array<ArrayBuffer>,
    },
    key,
    ciphertext as Uint8Array<ArrayBuffer>,
  );
  return new Uint8Array(plaintext);
}

/**
 * Encode the KDF parameter block for a given KDF kind (section 3.2).
 * Argon2id is 9 bytes; the deterministic and non-KDF kinds carry none.
 */
export function encodeArgon2idParams(
  memoryKib: number,
  iterations: number,
  parallelism: number,
): Uint8Array {
  assertFitsIn('Argon2id memory', memoryKib, MAX_UINT32);
  assertFitsIn('Argon2id iterations', iterations, MAX_UINT32);
  assertFitsIn('Argon2id parallelism', parallelism, MAX_UINT8);

  const params = new Uint8Array(ARGON2ID_PARAMS_LENGTH);
  const view = new DataView(params.buffer, params.byteOffset, params.byteLength);
  view.setUint32(0, memoryKib, false);
  view.setUint32(4, iterations, false);
  view.setUint8(8, parallelism);
  return params;
}

export function decodeArgon2idParams(params: Uint8Array): {
  memoryKib: number;
  iterations: number;
  parallelism: number;
} {
  if (params.length !== ARGON2ID_PARAMS_LENGTH) {
    throw new EnvelopeFormatError(
      `Argon2id parameters must be ${ARGON2ID_PARAMS_LENGTH} bytes, found ${params.length}`,
    );
  }
  const view = new DataView(params.buffer, params.byteOffset, params.byteLength);
  return {
    memoryKib: view.getUint32(0, false),
    iterations: view.getUint32(4, false),
    parallelism: view.getUint8(8),
  };
}

/* -------------------------------------------------------------------------
 * Envelope A — symmetric, key supplied by the caller.
 * [VERSION:1] [KIND:1] [IV:12] [CIPHERTEXT + TAG]
 * AAD = VERSION || KIND
 * ---------------------------------------------------------------------- */

const KEYED_IV_OFFSET = VERSION_AND_KIND_LENGTH;
const KEYED_MINIMUM_LENGTH = VERSION_AND_KIND_LENGTH + IV_LENGTH + TAG_LENGTH;

export async function sealWithKey(
  kind: EnvelopeKindValue,
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  assertKeyedKind(kind);

  const header = new Uint8Array([FORMAT_VERSION, kind]);
  const iv = randomIv();
  const ciphertext = await encryptWithAad(key, iv, header, plaintext);
  return concatBytes(header, iv, ciphertext);
}

export async function openWithKey(
  kind: EnvelopeKindValue,
  key: CryptoKey,
  envelope: Uint8Array,
): Promise<Uint8Array> {
  assertKeyedKind(kind);
  assertVersion(envelope);
  assertKind(envelope, kind);
  if (envelope.length < KEYED_MINIMUM_LENGTH) {
    throw new EnvelopeFormatError('Envelope A is too short to carry a ciphertext');
  }

  const header = envelope.subarray(0, VERSION_AND_KIND_LENGTH);
  const iv = envelope.subarray(KEYED_IV_OFFSET, KEYED_IV_OFFSET + IV_LENGTH);
  const ciphertext = envelope.subarray(KEYED_IV_OFFSET + IV_LENGTH);
  return decryptWithAad(key, iv, header, ciphertext);
}

/* -------------------------------------------------------------------------
 * Envelope B — export file, self-describing KDF.
 * [VERSION:1] [KIND:1=0x05] [KDF_KIND:1] [SALT:16]
 *   [KDF_PARAMS_LEN:1] [KDF_PARAMS:n] [IV:12] [CIPHERTEXT + TAG]
 * AAD = every header byte up to and including KDF_PARAMS.
 *
 * Parsing and opening are separate on purpose: the whole point of this
 * variant is that the reader must parse the header to learn which KDF and
 * which parameters to derive the key with, before it has a key to open with.
 * ---------------------------------------------------------------------- */

const EXPORT_FILE_KDF_KIND_OFFSET = VERSION_AND_KIND_LENGTH;
const EXPORT_FILE_SALT_OFFSET = EXPORT_FILE_KDF_KIND_OFFSET + 1;
const EXPORT_FILE_PARAMS_LENGTH_OFFSET = EXPORT_FILE_SALT_OFFSET + SALT_LENGTH;
const EXPORT_FILE_PARAMS_OFFSET = EXPORT_FILE_PARAMS_LENGTH_OFFSET + 1;

export interface ParsedExportFileEnvelope {
  kdfKind: KdfKindValue;
  salt: Uint8Array;
  kdfParams: Uint8Array;
  /** Header bytes through KDF_PARAMS — the associated data for this envelope. */
  associatedData: Uint8Array;
  iv: Uint8Array;
  /** A view into the envelope buffer, not a copy. See the module comment. */
  ciphertext: Uint8Array;
}

export async function sealExportFile(
  kdfKind: KdfKindValue,
  salt: Uint8Array,
  kdfParams: Uint8Array,
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  assertDerivableKdfKind(kdfKind);
  if (salt.length !== SALT_LENGTH) {
    throw new EnvelopeFormatError(`Salt must be ${SALT_LENGTH} bytes, found ${salt.length}`);
  }
  if (kdfParams.length > MAX_KDF_PARAMS_LENGTH) {
    throw new EnvelopeFormatError('KDF parameters exceed the single-byte length prefix');
  }

  const expectedParamsLength = KDF_PARAMS_LENGTHS[kdfKind];
  if (expectedParamsLength !== undefined && kdfParams.length !== expectedParamsLength) {
    throw new EnvelopeFormatError(
      `KDF kind 0x${toHex(kdfKind)} takes ${expectedParamsLength} parameter bytes, found ${kdfParams.length}`,
    );
  }

  const associatedData = concatBytes(
    new Uint8Array([FORMAT_VERSION, EnvelopeKind.exportFile, kdfKind]),
    salt,
    new Uint8Array([kdfParams.length]),
    kdfParams,
  );
  const iv = randomIv();
  const ciphertext = await encryptWithAad(key, iv, associatedData, plaintext);
  return concatBytes(associatedData, iv, ciphertext);
}

export function parseExportFile(envelope: Uint8Array): ParsedExportFileEnvelope {
  assertVersion(envelope);
  assertKind(envelope, EnvelopeKind.exportFile);

  const kdfKind = readByte(envelope, EXPORT_FILE_KDF_KIND_OFFSET, 'a KDF kind');
  assertDerivableKdfKind(kdfKind);

  const kdfParamsLength = readByte(
    envelope,
    EXPORT_FILE_PARAMS_LENGTH_OFFSET,
    'a KDF parameter length',
  );
  const ivOffset = EXPORT_FILE_PARAMS_OFFSET + kdfParamsLength;
  if (envelope.length < ivOffset + IV_LENGTH + TAG_LENGTH) {
    throw new EnvelopeFormatError('Envelope B is too short to carry a ciphertext');
  }

  return {
    kdfKind,
    salt: envelope.slice(EXPORT_FILE_SALT_OFFSET, EXPORT_FILE_SALT_OFFSET + SALT_LENGTH),
    kdfParams: envelope.slice(EXPORT_FILE_PARAMS_OFFSET, ivOffset),
    associatedData: envelope.slice(0, ivOffset),
    iv: envelope.slice(ivOffset, ivOffset + IV_LENGTH),
    ciphertext: envelope.subarray(ivOffset + IV_LENGTH),
  };
}

export async function openExportFile(
  parsed: ParsedExportFileEnvelope,
  key: CryptoKey,
): Promise<Uint8Array> {
  return decryptWithAad(key, parsed.iv, parsed.associatedData, parsed.ciphertext);
}

/* -------------------------------------------------------------------------
 * Envelope C — authenticated asymmetric handoff.
 * [VERSION:1] [KIND:1=0x06] [SENDER_PUB:32] [EPHEMERAL_PUB:32]
 *   [IV:12] [CIPHERTEXT + TAG]
 * AAD = VERSION || KIND || SENDER_PUB || RECIPIENT_PUB || EPHEMERAL_PUB
 *
 * The recipient's public key is bound into the associated data but is NOT
 * transmitted — both sides already know it. This is the one place where the
 * AAD is not simply the header bytes, and assuming otherwise is the easy
 * mistake to make here.
 *
 * The three public keys are passed as a named object rather than positionally:
 * they are all 32-byte arrays, so a transposed sender and recipient would
 * type-check and then fail to open with no useful message.
 * ---------------------------------------------------------------------- */

const HANDOFF_SENDER_OFFSET = VERSION_AND_KIND_LENGTH;
const HANDOFF_EPHEMERAL_OFFSET = HANDOFF_SENDER_OFFSET + PUBLIC_KEY_LENGTH;
const HANDOFF_IV_OFFSET = HANDOFF_EPHEMERAL_OFFSET + PUBLIC_KEY_LENGTH;

export interface HandoffSealKeys {
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

export interface HandoffOpenKeys {
  /** The sender's key as known to the recipient through the authenticated channel. */
  expectedSenderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
}

function handoffAssociatedData(keys: HandoffSealKeys): Uint8Array {
  return concatBytes(
    new Uint8Array([FORMAT_VERSION, EnvelopeKind.inviteHandoff]),
    keys.senderPublicKey,
    keys.recipientPublicKey,
    keys.ephemeralPublicKey,
  );
}

function assertPublicKeyLength(label: string, publicKey: Uint8Array): void {
  if (publicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new EnvelopeFormatError(
      `${label} must be ${PUBLIC_KEY_LENGTH} bytes, found ${publicKey.length}`,
    );
  }
}

export async function sealHandoff(
  keys: HandoffSealKeys,
  symmetricKey: CryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  assertPublicKeyLength('Sender public key', keys.senderPublicKey);
  assertPublicKeyLength('Recipient public key', keys.recipientPublicKey);
  assertPublicKeyLength('Ephemeral public key', keys.ephemeralPublicKey);

  const associatedData = handoffAssociatedData(keys);
  const iv = randomIv();
  const ciphertext = await encryptWithAad(symmetricKey, iv, associatedData, plaintext);

  return concatBytes(
    new Uint8Array([FORMAT_VERSION, EnvelopeKind.inviteHandoff]),
    keys.senderPublicKey,
    keys.ephemeralPublicKey,
    iv,
    ciphertext,
  );
}

export interface ParsedHandoffEnvelope {
  senderPublicKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  iv: Uint8Array;
  /** A view into the envelope buffer, not a copy. See the module comment. */
  ciphertext: Uint8Array;
}

export function parseHandoff(envelope: Uint8Array): ParsedHandoffEnvelope {
  assertVersion(envelope);
  assertKind(envelope, EnvelopeKind.inviteHandoff);

  if (envelope.length < HANDOFF_IV_OFFSET + IV_LENGTH + TAG_LENGTH) {
    throw new EnvelopeFormatError('Envelope C is too short to carry a ciphertext');
  }

  return {
    senderPublicKey: envelope.slice(HANDOFF_SENDER_OFFSET, HANDOFF_EPHEMERAL_OFFSET),
    ephemeralPublicKey: envelope.slice(HANDOFF_EPHEMERAL_OFFSET, HANDOFF_IV_OFFSET),
    iv: envelope.slice(HANDOFF_IV_OFFSET, HANDOFF_IV_OFFSET + IV_LENGTH),
    ciphertext: envelope.subarray(HANDOFF_IV_OFFSET + IV_LENGTH),
  };
}

function publicKeysMatch(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  // Compare every byte rather than stopping at the first mismatch, so the
  // timing carries no information. Not needed for public keys, but this is
  // a crypto module and the next caller may pass something secret.
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= (first[index] ?? 0) ^ (second[index] ?? 0);
  }
  return difference === 0;
}

/**
 * Open a handoff envelope.
 *
 * Section 4.3 makes the sender match mandatory: if the envelope claims a
 * different sender than the one the recipient knows, refuse before attempting
 * to decrypt. This blocks a server substituting its own wrap for the sender's.
 */
export async function openHandoff(
  parsed: ParsedHandoffEnvelope,
  keys: HandoffOpenKeys,
  symmetricKey: CryptoKey,
): Promise<Uint8Array> {
  assertPublicKeyLength('Expected sender public key', keys.expectedSenderPublicKey);
  assertPublicKeyLength('Recipient public key', keys.recipientPublicKey);

  if (!publicKeysMatch(parsed.senderPublicKey, keys.expectedSenderPublicKey)) {
    throw new EnvelopeFormatError('Handoff sender does not match the expected sender public key');
  }

  const associatedData = handoffAssociatedData({
    senderPublicKey: parsed.senderPublicKey,
    recipientPublicKey: keys.recipientPublicKey,
    ephemeralPublicKey: parsed.ephemeralPublicKey,
  });
  return decryptWithAad(symmetricKey, parsed.iv, associatedData, parsed.ciphertext);
}
