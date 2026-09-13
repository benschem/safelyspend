/** Structurally valid key material for the endpoint tests.
 *
 *  None of this is real ciphertext — the server never decrypts any of it, and these
 *  tests are about what the server accepts and stores. The bytes are shaped to pass
 *  the structural checks in lib/key-material.ts and nothing more.
 */

import { bytesToBase64url } from '../../lib/bytes.js';
import { EnvelopeKind, FORMAT_VERSION, KdfKind } from '../../lib/key-material.js';

/** Envelope A: VERSION, KIND, 12-byte IV, then ciphertext and a 16-byte tag. */
export function envelopeA(kind: number, payloadBytes = 48): string {
  const bytes = new Uint8Array(2 + 12 + payloadBytes);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = kind;
  bytes.fill(0xab, 2);
  return bytesToBase64url(bytes);
}

/** Envelope C: VERSION, KIND, sender pubkey, ephemeral pubkey, IV, ciphertext, tag. */
export function envelopeC(payloadBytes = 48): string {
  const bytes = new Uint8Array(2 + 32 + 32 + 12 + payloadBytes);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = EnvelopeKind.Handoff;
  bytes.fill(0xcd, 2);
  return bytesToBase64url(bytes);
}

export function wrappedPrivKey(): string {
  return envelopeA(EnvelopeKind.WrappedPrivKey);
}

export function wrappedMasterKey(): string {
  return envelopeA(EnvelopeKind.WrappedMasterKey);
}

export function vaultBlob(payloadBytes = 64): Uint8Array {
  const bytes = new Uint8Array(2 + 12 + payloadBytes);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = EnvelopeKind.Vault;
  bytes.fill(0xef, 2);
  return bytes;
}

export function salt16(fill = 0x11): string {
  return bytesToBase64url(new Uint8Array(16).fill(fill));
}

/** m=64 MiB as uint32 BE, t=3 as uint32 BE, p=1 as uint8. */
export function argon2Params(): string {
  const bytes = new Uint8Array(9);
  new DataView(bytes.buffer).setUint32(0, 64 * 1024, false);
  new DataView(bytes.buffer).setUint32(4, 3, false);
  bytes[8] = 1;
  return bytesToBase64url(bytes);
}

export function verifier(fill = 0x22): string {
  return bytesToBase64url(new Uint8Array(32).fill(fill));
}

export function pubkey(fill = 0x33): string {
  return bytesToBase64url(new Uint8Array(32).fill(fill));
}

export function verifierFields(fill = 0x22): Record<string, unknown> {
  return {
    verifierCandidate: verifier(fill),
    verifierSalt: salt16(),
    verifierKdfKind: KdfKind.Argon2id,
    verifierKdfParams: argon2Params(),
  };
}

/** The mandatory {pwd, recovery} pair for user_keys. */
export function userKeys(): unknown[] {
  return [
    {
      kekKind: 'pwd',
      wrappedPrivKey: wrappedPrivKey(),
      kekSalt: salt16(0x44),
      kekKdfKind: KdfKind.Argon2id,
      kekKdfParams: argon2Params(),
    },
    {
      kekKind: 'recovery',
      wrappedPrivKey: wrappedPrivKey(),
      kekSalt: null,
      kekKdfKind: KdfKind.Bip39Hkdf,
      kekKdfParams: '',
    },
  ];
}

/** The mandatory {pwd, recovery} pair for household_member_keys. */
export function memberKeys(): unknown[] {
  return [
    {
      kekKind: 'pwd',
      wrappedMasterKey: wrappedMasterKey(),
      kekSalt: salt16(0x55),
      kekKdfKind: KdfKind.Argon2id,
      kekKdfParams: argon2Params(),
    },
    {
      kekKind: 'recovery',
      wrappedMasterKey: wrappedMasterKey(),
      kekSalt: null,
      kekKdfKind: KdfKind.Bip39Hkdf,
      kekKdfParams: '',
    },
  ];
}

export function signupBody(
  authPendingToken: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    authPendingToken,
    ...verifierFields(),
    pubkey: pubkey(),
    userKeys: userKeys(),
    household: { id: crypto.randomUUID(), name: 'Our Budget' },
    memberKeys: memberKeys(),
    ...overrides,
  };
}

export function signupWithInviteBody(
  authPendingToken: string,
  inviteToken: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    authPendingToken,
    ...verifierFields(0x66),
    pubkey: pubkey(0x77),
    userKeys: userKeys(),
    inviteToken,
    ...overrides,
  };
}
