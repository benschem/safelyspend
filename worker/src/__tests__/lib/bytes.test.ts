/** Byte plumbing: the base64url wire encoding, the D1 BLOB shapes, and the
 *  constant-time compare the verifier check depends on.
 */

import { describe, it, expect } from 'vitest';
import {
  base64urlToBytes,
  blobToBase64url,
  blobToBase64urlOrThrow,
  blobToBytes,
  bytesToBase64url,
  constantTimeEquals,
  randomToken,
} from '../../lib/bytes.js';
import { AppError } from '../../lib/errors.js';

describe('base64url encoding', () => {
  it('round-trips bytes without padding', () => {
    const bytes = new Uint8Array([0, 1, 250, 255, 128, 64]);
    const encoded = bytesToBase64url(bytes);

    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(base64urlToBytes(encoded)).toEqual(bytes);
  });

  it('accepts standard base64 on the way in', () => {
    // Phase 3 may send either spelling; the server should not care which.
    expect(base64urlToBytes('++//')).toEqual(base64urlToBytes('--__'));
  });

  it('returns null rather than throwing for undecodable input', () => {
    expect(base64urlToBytes('!!!')).toBeNull();
  });
});

describe('D1 BLOB normalisation', () => {
  it('accepts every shape the runtimes hand back for one BLOB column', () => {
    // Workers returns number[], some runtimes ArrayBuffer. Trusting either one alone
    // would work in the tests and fail in production, or the reverse.
    const expected = new Uint8Array([1, 2, 3]);

    expect(blobToBytes(new Uint8Array([1, 2, 3]))).toEqual(expected);
    expect(blobToBytes(new Uint8Array([1, 2, 3]).buffer)).toEqual(expected);
    expect(blobToBytes([1, 2, 3])).toEqual(expected);
  });

  it('preserves SQL NULL as null rather than as empty bytes', () => {
    expect(blobToBytes(null)).toBeNull();
    expect(blobToBytes(undefined)).toBeNull();
    expect(blobToBase64url(null)).toBeNull();
  });

  it('throws rather than returning a placeholder for a NOT NULL column', () => {
    // Handing the client an empty string here would surface much later as an
    // unexplained decrypt failure, a long way from the schema mismatch that caused it.
    expect(() => blobToBase64urlOrThrow(null, 'user_keys.wrapped_priv_key')).toThrow(AppError);

    try {
      blobToBase64urlOrThrow(null, 'user_keys.wrapped_priv_key');
    } catch (err) {
      expect((err as AppError).status).toBe(500);
      expect((err as AppError).message).toContain('user_keys.wrapped_priv_key');
    }
  });
});

describe('constantTimeEquals', () => {
  it('compares equal-length byte strings without early exit', () => {
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([9, 2, 3]))).toBe(false);
  });

  it('rejects a length mismatch, which is the one thing it does leak', () => {
    expect(constantTimeEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('randomToken', () => {
  it('is 32 bytes of base64url by default, and unique per call', () => {
    const token = randomToken();

    expect(base64urlToBytes(token)).toHaveLength(32);
    expect(token).not.toContain('=');
    expect(randomToken()).not.toBe(token);
  });
});
