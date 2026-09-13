/**
 * HKDF conformance — the gate on `@noble/hashes`, alongside the Argon2id gate
 * in `argon2-conformance.test.ts`.
 *
 * Nothing here imports `src/lib`. That is deliberate: these tests pin the
 * library, not this app's use of it, and they are the reason a separate file
 * exists rather than a stray describe block in `key-management.test.ts`.
 *
 * What they guard against is narrow and specific. Both recovery-key derivation
 * (section 6.2) and the invite handoff (section 4.3) call HKDF with no salt,
 * which RFC 5869 defines as a string of zeros the length of the hash output.
 * An implementation that quietly substituted some other default would derive a
 * key that encrypts and decrypts perfectly — and that no other implementation
 * on earth could reproduce, which for a recovery path means the vault is gone.
 * Only a published vector tells that apart from correctness.
 */

import { describe, it, expect } from 'vitest';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

const SHA256_OUTPUT_LENGTH = 32;

describe('HKDF-SHA256 with no salt', () => {
  // RFC 5869 appendix A.3: SHA-256, no salt, no info, 42 bytes of output.
  const INPUT_KEY_MATERIAL = fromHex('0b'.repeat(22));
  const NO_INFO = new Uint8Array(0);
  const OUTPUT_LENGTH = 42;

  it('matches RFC 5869 test case 3', () => {
    const output = hkdf(sha256, INPUT_KEY_MATERIAL, undefined, NO_INFO, OUTPUT_LENGTH);

    expect(toHex(output)).toBe(
      '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
    );
  });

  it('treats an absent salt the same as an all-zero salt of the hash length', () => {
    const absent = hkdf(sha256, INPUT_KEY_MATERIAL, undefined, NO_INFO, OUTPUT_LENGTH);
    const zeroFilled = hkdf(
      sha256,
      INPUT_KEY_MATERIAL,
      new Uint8Array(SHA256_OUTPUT_LENGTH),
      NO_INFO,
      OUTPUT_LENGTH,
    );

    expect(toHex(absent)).toBe(toHex(zeroFilled));
  });
});
