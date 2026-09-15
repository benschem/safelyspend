import { describe, it, expect } from 'vitest';
import { base64urlToBytes, bytesToBase64url, Base64UrlError } from '@/lib/base64url';

/**
 * Literal vectors, not round-trips. A round-trip passes just as happily against
 * an encoder and decoder that agree with each other and with nothing else, and
 * the thing that has to agree here is `worker/src/lib/bytes.ts`.
 *
 * The string vectors are RFC 4648 section 10; the alphabet vectors cover the
 * two characters where base64url differs from base64, which is the only place
 * a wrong implementation actually shows up.
 */

const textEncoder = new TextEncoder();

/** RFC 4648 section 10, with base64's padding stripped as base64url writes it. */
const RFC_4648_VECTORS: ReadonlyArray<readonly [string, string]> = [
  ['', ''],
  ['f', 'Zg'],
  ['fo', 'Zm8'],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg'],
  ['fooba', 'Zm9vYmE'],
  ['foobar', 'Zm9vYmFy'],
];

describe('bytesToBase64url', () => {
  it.each(RFC_4648_VECTORS)('encodes %o as %o', (plaintext, encoded) => {
    expect(bytesToBase64url(textEncoder.encode(plaintext))).toBe(encoded);
  });

  it('emits - and _ rather than + and / for the last two alphabet positions', () => {
    // 0xfb 0xff 0xbf packs to sextets 62, 63, 62, 63.
    expect(bytesToBase64url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_');
  });

  it('emits no padding', () => {
    expect(bytesToBase64url(new Uint8Array([0x00]))).toBe('AA');
  });

  it('encodes a 16-byte salt to 22 unpadded characters', () => {
    const salt = new Uint8Array([
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
      0xff,
    ]);
    expect(bytesToBase64url(salt)).toBe('ABEiM0RVZneImaq7zN3u_w');
  });
});

describe('base64urlToBytes', () => {
  it.each(RFC_4648_VECTORS)('decodes the encoding of %o', (plaintext, encoded) => {
    expect(base64urlToBytes(encoded)).toEqual(textEncoder.encode(plaintext));
  });

  it('accepts the - and _ alphabet', () => {
    expect(base64urlToBytes('-_-_')).toEqual(new Uint8Array([0xfb, 0xff, 0xbf]));
  });

  // The server accepts both alphabets and both paddings; a decoder stricter
  // than its counterpart only invents failures.
  it('accepts the + and / alphabet', () => {
    expect(base64urlToBytes('+/+/')).toEqual(new Uint8Array([0xfb, 0xff, 0xbf]));
  });

  it('accepts padded input', () => {
    expect(base64urlToBytes('Zg==')).toEqual(textEncoder.encode('f'));
  });

  it('decodes the empty string to zero bytes', () => {
    // Not a degenerate case: a recovery-kind row's kekKdfParams is exactly this.
    expect(base64urlToBytes('')).toEqual(new Uint8Array(0));
  });

  it('throws on a character outside both alphabets', () => {
    expect(() => base64urlToBytes('Zm9v*')).toThrow(Base64UrlError);
  });

  it('throws on a length that cannot be padded to a multiple of four', () => {
    expect(() => base64urlToBytes('Z')).toThrow(Base64UrlError);
  });
});
