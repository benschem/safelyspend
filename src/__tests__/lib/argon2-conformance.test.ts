/**
 * Argon2id conformance — the gate on `hash-wasm` described in
 * `docs/auth-rewrite/03_client_crypto_rewrite.md` step 3.
 *
 * Everything in the wrapped-key scheme hangs off this one primitive. A
 * library that is fast, small and subtly wrong derives a key that looks fine,
 * encrypts fine, and cannot be reproduced by any other Argon2 implementation
 * on earth — which is the same thing as losing the vault. Known-answer
 * vectors are the only way to tell that apart from correctness.
 *
 * These vectors come from the Argon2 reference implementation's own test
 * suite (P-H-C/phc-winner-argon2, `src/test.c`), for Argon2id version 1.3 —
 * the version RFC 9106 specifies. Each vector's raw hex tag was cross-checked
 * against the base64 tag in the PHC-encoded string printed beside it.
 *
 * RFC 9106 section 5.3's own vector is deliberately not used: it supplies 8
 * bytes of secret and 12 bytes of associated data, and `hash-wasm` hardcodes
 * the associated-data length to zero when it computes H0 (see
 * `associatedData length` in its bundle). The RFC vector is therefore
 * unreachable through the library's API rather than failing against it. That
 * costs nothing here — this app never passes associated data to Argon2id, and
 * the vectors below vary every input it does use: password, salt, time cost,
 * memory cost and parallelism.
 */

import { describe, it, expect } from 'vitest';
import { argon2id } from 'hash-wasm';

/**
 * `memoryLog2` is how the reference suite expresses memory: it passes the
 * exponent, and the harness raises 2 to it to get kibibytes. Kept in that
 * shape so each row can be diffed against `test.c` line for line.
 */
const REFERENCE_VECTORS = [
  {
    iterations: 2,
    memoryLog2: 16,
    parallelism: 1,
    password: 'password',
    salt: 'somesalt',
    tag: '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7',
  },
  {
    iterations: 2,
    memoryLog2: 18,
    parallelism: 1,
    password: 'password',
    salt: 'somesalt',
    tag: '78fe1ec91fb3aa5657d72e710854e4c3d9b9198c742f9616c2f085bed95b2e8c',
  },
  {
    iterations: 2,
    memoryLog2: 8,
    parallelism: 1,
    password: 'password',
    salt: 'somesalt',
    tag: '9dfeb910e80bad0311fee20f9c0e2b12c17987b4cac90c2ef54d5b3021c68bfe',
  },
  {
    iterations: 2,
    memoryLog2: 8,
    parallelism: 2,
    password: 'password',
    salt: 'somesalt',
    tag: '6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037',
  },
  {
    iterations: 1,
    memoryLog2: 16,
    parallelism: 1,
    password: 'password',
    salt: 'somesalt',
    tag: 'f6a5adc1ba723dddef9b5ac1d464e180fcd9dffc9d1cbf76cca2fed795d9ca98',
  },
  {
    iterations: 4,
    memoryLog2: 16,
    parallelism: 1,
    password: 'password',
    salt: 'somesalt',
    tag: '9025d48e68ef7395cca9079da4c4ec3affb3c8911fe4f86d1a2520856f63172c',
  },
  {
    iterations: 2,
    memoryLog2: 16,
    parallelism: 1,
    password: 'differentpassword',
    salt: 'somesalt',
    tag: '0b84d652cf6b0c4beaef0dfe278ba6a80df6696281d7e0d2891b817d8c458fde',
  },
  {
    iterations: 2,
    memoryLog2: 16,
    parallelism: 1,
    password: 'password',
    salt: 'diffsalt',
    tag: 'bdf32b05ccc42eb15d58fd19b1f856b113da1e9a5874fdcc544308565aa8141c',
  },
] as const;

/** The params `deriveKek` and `deriveVerifier` are locked to — design doc section 3.1. */
const LOCKED_PARAMS = {
  memorySize: 64 * 1024,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

// A 256 MiB vector on a cold WASM instance comfortably outruns vitest's 5 s
// default, and a timeout here would read as a conformance failure.
const VECTOR_TIMEOUT_MS = 30_000;

describe('argon2id conformance', () => {
  it.each(REFERENCE_VECTORS)(
    'matches the reference tag for t=$iterations, m=2^$memoryLog2 KiB, p=$parallelism, password "$password", salt "$salt"',
    async ({ iterations, memoryLog2, parallelism, password, salt, tag }) => {
      const actual = await argon2id({
        password,
        salt,
        iterations,
        memorySize: 2 ** memoryLog2,
        parallelism,
        hashLength: 32,
        outputType: 'hex',
      });

      expect(actual).toBe(tag);
    },
    VECTOR_TIMEOUT_MS,
  );
});

describe('argon2id at the params this app locks in', () => {
  it(
    'returns 32 bytes and is deterministic for a given password and salt',
    async () => {
      const salt = new Uint8Array(16).fill(0x2a);

      const first = await argon2id({
        password: 'correct horse',
        salt,
        ...LOCKED_PARAMS,
        outputType: 'binary',
      });
      const second = await argon2id({
        password: 'correct horse',
        salt,
        ...LOCKED_PARAMS,
        outputType: 'binary',
      });

      expect(first).toHaveLength(32);
      expect(Array.from(second)).toEqual(Array.from(first));
    },
    VECTOR_TIMEOUT_MS,
  );

  it(
    'separates the verifier from KEK_pwd on salt alone',
    async () => {
      // Design doc section 3.3: independent salts are the only domain
      // separation between the two derivations, and are sufficient.
      const kekSalt = new Uint8Array(16).fill(0x01);
      const verifierSalt = new Uint8Array(16).fill(0x02);

      const kek = await argon2id({
        password: 'correct horse',
        salt: kekSalt,
        ...LOCKED_PARAMS,
        outputType: 'hex',
      });
      const verifier = await argon2id({
        password: 'correct horse',
        salt: verifierSalt,
        ...LOCKED_PARAMS,
        outputType: 'hex',
      });

      expect(verifier).not.toBe(kek);
    },
    VECTOR_TIMEOUT_MS,
  );
});
