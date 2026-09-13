/** Byte plumbing shared by the wrapped-key endpoints.
 *
 *  Wire encoding is base64url throughout (Phase 2 design section 11). D1 hands BLOB
 *  columns back as number[] in the Workers runtime and as ArrayBuffer in some others,
 *  so every read goes through blobToBytes rather than trusting one shape.
 */

import { internal } from './errors.js';

/** Decode base64url (or padded standard base64) to raw bytes. Returns null if the
 *  input is not valid base64 at all — callers turn that into INVALID_BLOB. */
export function base64urlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_\-+/]*={0,2}$/.test(value)) {
    return null;
  }

  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Normalise whatever D1 returns for a BLOB column into bytes. */
export function blobToBytes(value: unknown): Uint8Array | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value as number[]);
  }
  return null;
}

/** Base64url-encode a BLOB column read from D1, preserving SQL NULL as JSON null. */
export function blobToBase64url(value: unknown): string | null {
  const bytes = blobToBytes(value);
  return bytes ? bytesToBase64url(bytes) : null;
}

/** Base64url-encode a BLOB column declared NOT NULL in the schema.
 *
 *  Reaching the throw means the schema and the code disagree. Failing here is the
 *  point: the alternative is handing the client an empty string, which surfaces much
 *  later as an unexplained decrypt failure a long way from the real cause. */
export function blobToBase64urlOrThrow(value: unknown, column: string): string {
  const encoded = blobToBase64url(value);
  if (encoded === null) {
    throw internal(`${column} is NOT NULL in the schema but read back as null`);
  }
  return encoded;
}

/** Constant-time only when both inputs are the same length, which is the case for
 *  every comparison here (both are 32-byte Argon2id outputs). A length mismatch
 *  returns early and so leaks the length, and nothing beyond it. */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= (a[i] as number) ^ (b[i] as number);
  }
  return difference === 0;
}

/** Cryptographically random token, base64url-encoded. Used for invite tokens and
 *  auth_pending bearer tokens. */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}
