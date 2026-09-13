/** Structural validation tests.
 *
 *  Every byte value below is written as a literal rather than read from the module's
 *  own constants. A test that says `bytes[0] = FORMAT_VERSION` passes no matter what
 *  FORMAT_VERSION becomes; a test that says `bytes[0] = 0x02` is the thing that
 *  actually pins the format. The same applies to the KDF kind numbers and lengths.
 */

import { describe, it, expect } from 'vitest';
import {
  assertHandoffEnvelope,
  assertKekMetadata,
  assertPubkey,
  assertVaultBlob,
  assertVerifier,
  assertVerifierMetadata,
  assertWrappedMasterKey,
  assertWrappedPrivKey,
  decodeOptional,
  decodeRequired,
  parseKeyPair,
  parsePasswordKey,
} from '../../lib/key-material.js';
import { bytesToBase64url } from '../../lib/bytes.js';
import { AppError } from '../../lib/errors.js';

/** VERSION, KIND, then enough bytes for a 12-byte IV and a 16-byte tag. */
function envelope(kind: number, totalBytes = 48): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  bytes[0] = 0x02;
  bytes[1] = kind;
  return bytes;
}

function expectInvalidBlob(run: () => void): void {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INVALID_BLOB');
    expect((err as AppError).status).toBe(400);
    // Generic on purpose: the server is a parser, not a debugger.
    expect((err as AppError).message).toBe('Invalid key material');
    return;
  }
  throw new Error('expected an INVALID_BLOB rejection, but nothing was thrown');
}

describe('envelope version', () => {
  it('accepts 0x02 as the leading byte', () => {
    expect(() => assertWrappedPrivKey(envelope(0x03))).not.toThrow();
  });

  it.each([0x00, 0x01, 0x03, 0xff])('rejects leading byte %i', (version) => {
    const bytes = envelope(0x03);
    bytes[0] = version;
    expectInvalidBlob(() => assertWrappedPrivKey(bytes));
  });
});

describe('envelope kind', () => {
  it('pins each wrapped-key slot to its own kind byte', () => {
    expect(() => assertWrappedMasterKey(envelope(0x02))).not.toThrow();
    expect(() => assertWrappedPrivKey(envelope(0x03))).not.toThrow();
    expect(() => assertVaultBlob(envelope(0x01))).not.toThrow();
    expect(() => assertHandoffEnvelope(envelope(0x06, 110))).not.toThrow();
  });

  it('refuses a wrapped PrivKey in the MasterKey slot and vice versa', () => {
    // This is the swap the AAD binding also catches at decrypt time. Rejecting it
    // here stops the wrong blob ever reaching the row.
    expectInvalidBlob(() => assertWrappedMasterKey(envelope(0x03)));
    expectInvalidBlob(() => assertWrappedPrivKey(envelope(0x02)));
  });

  it('refuses a vault blob in a key slot', () => {
    expectInvalidBlob(() => assertWrappedMasterKey(envelope(0x01)));
  });
});

describe('envelope length', () => {
  it('requires 30 bytes for envelope A: version, kind, 12-byte IV, 16-byte tag', () => {
    expect(() => assertWrappedPrivKey(envelope(0x03, 30))).not.toThrow();
    expectInvalidBlob(() => assertWrappedPrivKey(envelope(0x03, 29)));
  });

  it('requires 110 bytes for envelope C: two pubkeys on top of that', () => {
    expect(() => assertHandoffEnvelope(envelope(0x06, 110))).not.toThrow();
    expectInvalidBlob(() => assertHandoffEnvelope(envelope(0x06, 109)));
  });

  it('caps a wrapped key at 1024 bytes', () => {
    expect(() => assertWrappedPrivKey(envelope(0x03, 1024))).not.toThrow();
    expectInvalidBlob(() => assertWrappedPrivKey(envelope(0x03, 1025)));
  });

  it('does not cap a vault blob, which the upload size limit bounds instead', () => {
    expect(() => assertVaultBlob(envelope(0x01, 100_000))).not.toThrow();
  });
});

describe('KEK metadata consistency', () => {
  const argon2Params = new Uint8Array(9);
  const salt = new Uint8Array(16);

  it('accepts a password row with a 16-byte salt and Argon2id', () => {
    expect(() =>
      assertKekMetadata({
        kekKind: 'pwd',
        kekSalt: salt,
        kekKdfKind: 0x02,
        kekKdfParams: argon2Params,
      }),
    ).not.toThrow();
  });

  it('accepts a recovery row with a null salt and zero-length params', () => {
    // A NULL salt here is correct, not corruption: BIP-39 is deterministic from the
    // phrase, so there is nothing to salt.
    expect(() =>
      assertKekMetadata({
        kekKind: 'recovery',
        kekSalt: null,
        kekKdfKind: 0x03,
        kekKdfParams: new Uint8Array(0),
      }),
    ).not.toThrow();
  });

  it('accepts an ecies row with every KDF column null', () => {
    expect(() =>
      assertKekMetadata({
        kekKind: 'ecies',
        kekSalt: null,
        kekKdfKind: null,
        kekKdfParams: null,
      }),
    ).not.toThrow();
  });

  it('rejects PBKDF2, which is reserved and never written', () => {
    // Phase 1 section 3.2 reserves 0x01. Accepting it would let a client downgrade
    // its own key derivation to the algorithm this rewrite exists to leave behind.
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'pwd',
        kekSalt: salt,
        kekKdfKind: 0x01,
        kekKdfParams: new Uint8Array(4),
      }),
    );
  });

  it('rejects a password row with no salt', () => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'pwd',
        kekSalt: null,
        kekKdfKind: 0x02,
        kekKdfParams: argon2Params,
      }),
    );
  });

  it.each([15, 17, 32])('rejects a %i-byte password salt', (length) => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'pwd',
        kekSalt: new Uint8Array(length),
        kekKdfKind: 0x02,
        kekKdfParams: argon2Params,
      }),
    );
  });

  it.each([4, 8, 10])('rejects %i-byte Argon2id params', (length) => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'pwd',
        kekSalt: salt,
        kekKdfKind: 0x02,
        kekKdfParams: new Uint8Array(length),
      }),
    );
  });

  it('rejects a recovery row carrying a salt', () => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'recovery',
        kekSalt: salt,
        kekKdfKind: 0x03,
        kekKdfParams: new Uint8Array(0),
      }),
    );
  });

  it('rejects a recovery row claiming Argon2id', () => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'recovery',
        kekSalt: null,
        kekKdfKind: 0x02,
        kekKdfParams: new Uint8Array(0),
      }),
    );
  });

  it('rejects an ecies row carrying KDF metadata', () => {
    expectInvalidBlob(() =>
      assertKekMetadata({
        kekKind: 'ecies',
        kekSalt: null,
        kekKdfKind: 0x02,
        kekKdfParams: argon2Params,
      }),
    );
  });
});

describe('fixed-length fields', () => {
  it('requires a 32-byte pubkey', () => {
    expect(() => assertPubkey(new Uint8Array(32))).not.toThrow();
    expectInvalidBlob(() => assertPubkey(new Uint8Array(31)));
    expectInvalidBlob(() => assertPubkey(new Uint8Array(33)));
  });

  it('requires a 32-byte verifier, the Argon2id output length', () => {
    expect(() => assertVerifier(new Uint8Array(32))).not.toThrow();
    expectInvalidBlob(() => assertVerifier(new Uint8Array(16)));
  });

  it('requires Argon2id for the verifier and 9 bytes of params', () => {
    expect(() =>
      assertVerifierMetadata({
        verifierSalt: new Uint8Array(16),
        verifierKdfKind: 0x02,
        verifierKdfParams: new Uint8Array(9),
      }),
    ).not.toThrow();

    // PBKDF2 is reserved and never written.
    expectInvalidBlob(() =>
      assertVerifierMetadata({
        verifierSalt: new Uint8Array(16),
        verifierKdfKind: 0x01,
        verifierKdfParams: new Uint8Array(4),
      }),
    );
    expectInvalidBlob(() =>
      assertVerifierMetadata({
        verifierSalt: new Uint8Array(16),
        verifierKdfKind: 0x02,
        verifierKdfParams: new Uint8Array(8),
      }),
    );
    expectInvalidBlob(() =>
      assertVerifierMetadata({
        verifierSalt: new Uint8Array(8),
        verifierKdfKind: 0x02,
        verifierKdfParams: new Uint8Array(9),
      }),
    );
  });
});

describe('decoding', () => {
  it('rejects a missing required field', () => {
    expectInvalidBlob(() => decodeRequired(undefined));
    expectInvalidBlob(() => decodeRequired(null));
    expectInvalidBlob(() => decodeRequired(''));
    expectInvalidBlob(() => decodeRequired(42));
  });

  it('rejects characters that are not base64', () => {
    expectInvalidBlob(() => decodeRequired('not base64!'));
  });

  it('distinguishes an absent optional field from an empty one', () => {
    // A recovery row's kek_kdf_params is empty, not NULL, and a NULL salt is not the
    // same as a zero-length one. Collapsing the two would corrupt both row kinds.
    expect(decodeOptional(null)).toBeNull();
    expect(decodeOptional(undefined)).toBeNull();
    expect(decodeOptional('')).toEqual(new Uint8Array(0));
  });
});

describe('the mandatory pwd and recovery pair', () => {
  const pwdEntry = {
    kekKind: 'pwd',
    wrappedPrivKey: bytesToBase64url(envelope(0x03)),
    kekSalt: bytesToBase64url(new Uint8Array(16)),
    kekKdfKind: 0x02,
    kekKdfParams: bytesToBase64url(new Uint8Array(9)),
  };
  const recoveryEntry = {
    kekKind: 'recovery',
    wrappedPrivKey: bytesToBase64url(envelope(0x03)),
    kekSalt: null,
    kekKdfKind: 0x03,
    kekKdfParams: '',
  };

  it('accepts the pwd and recovery pair in either order', () => {
    expect(() => parseKeyPair([pwdEntry, recoveryEntry], 'wrappedPrivKey')).not.toThrow();
    expect(() => parseKeyPair([recoveryEntry, pwdEntry], 'wrappedPrivKey')).not.toThrow();
  });

  it('rejects a lone password row', () => {
    // Half an upload leaves an account unlockable only one way, silently.
    expectInvalidBlob(() => parseKeyPair([pwdEntry], 'wrappedPrivKey'));
  });

  it('rejects two rows of the same kind', () => {
    expectInvalidBlob(() => parseKeyPair([pwdEntry, pwdEntry], 'wrappedPrivKey'));
  });

  it('rejects an ecies row, which a client never uploads here', () => {
    expectInvalidBlob(() =>
      parseKeyPair([{ ...pwdEntry, kekKind: 'ecies' }, recoveryEntry], 'wrappedPrivKey'),
    );
  });

  it('rejects anything that is not a two-element array', () => {
    expectInvalidBlob(() => parseKeyPair(null, 'wrappedPrivKey'));
    expectInvalidBlob(() => parseKeyPair({}, 'wrappedPrivKey'));
    expectInvalidBlob(() => parseKeyPair([], 'wrappedPrivKey'));
  });
});

describe('the lone password row a recovery reset replaces', () => {
  const pwdEntry = {
    wrappedPrivKey: bytesToBase64url(envelope(0x03)),
    kekSalt: bytesToBase64url(new Uint8Array(16)),
    kekKdfKind: 0x02,
    kekKdfParams: bytesToBase64url(new Uint8Array(9)),
  };

  it('accepts a password row with no kekKind of its own', () => {
    // The kind is imposed by the endpoint, not read from the body.
    expect(() => parsePasswordKey(pwdEntry, 'wrappedPrivKey')).not.toThrow();
    expect(parsePasswordKey(pwdEntry, 'wrappedPrivKey').kekKind).toBe('pwd');
  });

  it('ignores a kekKind the client supplies, rather than honouring it', () => {
    // A client asking to overwrite its recovery row here would be asking to destroy
    // the very path it just used to get in.
    const relabelled = { ...pwdEntry, kekKind: 'recovery', kekSalt: null, kekKdfKind: 0x03 };
    expectInvalidBlob(() => parsePasswordKey(relabelled, 'wrappedPrivKey'));
  });

  it('still enforces the envelope kind for the slot', () => {
    const wrongKind = { ...pwdEntry, wrappedPrivKey: bytesToBase64url(envelope(0x02)) };
    expectInvalidBlob(() => parsePasswordKey(wrongKind, 'wrappedPrivKey'));
  });

  it('rejects anything that is not an object', () => {
    expectInvalidBlob(() => parsePasswordKey(null, 'wrappedPrivKey'));
    expectInvalidBlob(() => parsePasswordKey('pwd', 'wrappedPrivKey'));
  });
});
