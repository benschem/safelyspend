import { describe, it, expect } from 'vitest';
import {
  EnvelopeKind,
  EnvelopeFormatError,
  FORMAT_VERSION,
  KdfKind,
  decodeArgon2idParams,
  encodeArgon2idParams,
  openExportFile,
  openHandoff,
  openWithKey,
  parseExportFile,
  parseHandoff,
  sealExportFile,
  sealHandoff,
  sealWithKey,
} from '@/lib/envelope';

async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function filledBytes(length: number, value: number): Uint8Array {
  return new Uint8Array(length).fill(value);
}

const SENDER_PUBLIC_KEY = filledBytes(32, 0xa1);
const RECIPIENT_PUBLIC_KEY = filledBytes(32, 0xb2);
const EPHEMERAL_PUBLIC_KEY = filledBytes(32, 0xc3);

const HANDOFF_KEYS = {
  senderPublicKey: SENDER_PUBLIC_KEY,
  recipientPublicKey: RECIPIENT_PUBLIC_KEY,
  ephemeralPublicKey: EPHEMERAL_PUBLIC_KEY,
};

const EXPECTED_HANDOFF_SENDER = {
  expectedSenderPublicKey: SENDER_PUBLIC_KEY,
  recipientPublicKey: RECIPIENT_PUBLIC_KEY,
};

// Every other test in this file asserts on the message, because the message is
// what tells you which rule fired. This one pins the type, once, so a caller
// can still catch format rejections as a class.
describe('EnvelopeFormatError', () => {
  it('is the error type that every envelope rejects with', async () => {
    const key = await generateAesKey();

    await expect(sealWithKey(EnvelopeKind.inviteHandoff, key, bytes(1))).rejects.toBeInstanceOf(
      EnvelopeFormatError,
    );
    await expect(
      sealExportFile(
        KdfKind.argon2id,
        filledBytes(8, 0),
        encodeArgon2idParams(1, 1, 1),
        key,
        bytes(1),
      ),
    ).rejects.toBeInstanceOf(EnvelopeFormatError);
    await expect(
      sealHandoff({ ...HANDOFF_KEYS, senderPublicKey: filledBytes(31, 0) }, key, bytes(1)),
    ).rejects.toBeInstanceOf(EnvelopeFormatError);
    expect(() => decodeArgon2idParams(filledBytes(8, 0))).toThrow(EnvelopeFormatError);
  });
});

describe('sealWithKey / openWithKey — envelope A', () => {
  it('round-trips a payload', async () => {
    const key = await generateAesKey();
    const plaintext = new TextEncoder().encode('household master key material');

    const sealed = await sealWithKey(EnvelopeKind.wrappedMasterKey, key, plaintext);
    const opened = await openWithKey(EnvelopeKind.wrappedMasterKey, key, sealed);

    expect(opened).toEqual(plaintext);
  });

  it('round-trips an empty payload', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, new Uint8Array(0));
    const opened = await openWithKey(EnvelopeKind.vault, key, sealed);

    expect(opened.length).toBe(0);
  });

  it('round-trips a multi-megabyte payload', async () => {
    const key = await generateAesKey();
    const plaintext = filledBytes(2 * 1024 * 1024, 0x5a);

    const sealed = await sealWithKey(EnvelopeKind.vault, key, plaintext);
    const opened = await openWithKey(EnvelopeKind.vault, key, sealed);

    expect(opened.length).toBe(plaintext.length);
    expect(opened[0]).toBe(0x5a);
    expect(opened[opened.length - 1]).toBe(0x5a);
  });

  it('writes the version and kind bytes in the header', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.wrappedPrivateKey, key, bytes(1, 2, 3));

    expect(sealed[0]).toBe(FORMAT_VERSION);
    expect(sealed[1]).toBe(EnvelopeKind.wrappedPrivateKey);
  });

  it('refuses to seal a kind that envelope A does not carry', async () => {
    const key = await generateAesKey();

    await expect(sealWithKey(EnvelopeKind.inviteHandoff, key, bytes(1))).rejects.toThrow(
      /cannot carry kind 0x06/,
    );
  });

  it('refuses to open a kind that envelope A does not carry', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, bytes(1));

    await expect(openWithKey(EnvelopeKind.exportFile, key, sealed)).rejects.toThrow(
      /cannot carry kind 0x05/,
    );
  });

  // The attack section 4 exists to block: a server moving a blob between slots.
  it('rejects a blob whose kind byte was rewritten', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.wrappedPrivateKey, key, bytes(9, 8, 7));

    const tampered = Uint8Array.from(sealed);
    tampered[1] = EnvelopeKind.wrappedMasterKey;

    // The caller now asks for the kind the attacker claims, so the kind check
    // passes and only the AAD binding stands between us and a silent swap.
    await expect(openWithKey(EnvelopeKind.wrappedMasterKey, key, tampered)).rejects.toThrow();
  });

  it('rejects opening under a kind the caller did not seal with', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.wrappedPrivateKey, key, bytes(4, 5, 6));

    await expect(openWithKey(EnvelopeKind.wrappedMasterKey, key, sealed)).rejects.toThrow(
      /kind mismatch/,
    );
  });

  it('rejects a payload opened under a different key', async () => {
    const sealingKey = await generateAesKey();
    const otherKey = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, sealingKey, bytes(1, 2, 3));

    await expect(openWithKey(EnvelopeKind.vault, otherKey, sealed)).rejects.toThrow();
  });

  it('rejects any version byte that is not 0x02', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, bytes(1, 2, 3));

    for (const version of [0x00, 0x01, 0x03, 0xff]) {
      const tampered = Uint8Array.from(sealed);
      tampered[0] = version;
      await expect(openWithKey(EnvelopeKind.vault, key, tampered)).rejects.toThrow(
        /Unsupported envelope version/,
      );
    }
  });

  // Nonce reuse under a fixed key is the one AES-GCM mistake that is
  // catastrophic rather than merely wrong, and randomIv is the only thing
  // standing between us and it.
  it('uses a fresh IV for every seal', async () => {
    const key = await generateAesKey();
    const plaintext = bytes(1, 2, 3);

    const first = await sealWithKey(EnvelopeKind.vault, key, plaintext);
    const second = await sealWithKey(EnvelopeKind.vault, key, plaintext);

    expect(first.subarray(2, 14)).not.toEqual(second.subarray(2, 14));
  });

  it('rejects an envelope too short to hold a GCM tag', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, bytes(1, 2, 3));

    // Past the header and IV, but with fewer than 16 bytes of tag left: this
    // band used to slip through and fail opaquely inside Web Crypto.
    await expect(openWithKey(EnvelopeKind.vault, key, sealed.subarray(0, 20))).rejects.toThrow(
      /too short to carry a ciphertext/,
    );
  });

  it('accepts the shortest legal envelope A', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, new Uint8Array(0));

    expect(sealed.length).toBe(2 + 12 + 16);
    await expect(openWithKey(EnvelopeKind.vault, key, sealed)).resolves.toHaveLength(0);
  });

  it('rejects a truncated envelope rather than reading past the end', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, bytes(1, 2, 3));

    await expect(openWithKey(EnvelopeKind.vault, key, sealed.subarray(0, 10))).rejects.toThrow(
      /too short to carry a ciphertext/,
    );
  });
});

describe('sealExportFile / parseExportFile / openExportFile — envelope B', () => {
  const salt = filledBytes(16, 0x11);
  const params = encodeArgon2idParams(64 * 1024, 3, 1);

  it('round-trips through parse then open', async () => {
    const key = await generateAesKey();
    const plaintext = new TextEncoder().encode('{"transactions":[]}');

    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, plaintext);
    const opened = await openExportFile(parseExportFile(sealed), key);

    expect(opened).toEqual(plaintext);
  });

  it('exposes the KDF descriptor before a key is needed', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1));

    const parsed = parseExportFile(sealed);

    expect(parsed.kdfKind).toBe(KdfKind.argon2id);
    expect(parsed.salt).toEqual(salt);
    expect(decodeArgon2idParams(parsed.kdfParams)).toEqual({
      memoryKib: 64 * 1024,
      iterations: 3,
      parallelism: 1,
    });
  });

  it('carries an empty parameter block for deterministic KDFs', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.bip39Hkdf, salt, new Uint8Array(0), key, bytes(7));

    const parsed = parseExportFile(sealed);

    expect(parsed.kdfKind).toBe(KdfKind.bip39Hkdf);
    expect(parsed.kdfParams.length).toBe(0);
    expect(await openExportFile(parsed, key)).toEqual(bytes(7));
  });

  it('rejects a KDF kind that is not a known value', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1));

    const tampered = Uint8Array.from(sealed);
    tampered[2] = 0x7f;

    expect(() => parseExportFile(tampered)).toThrow(/Unknown KDF kind: 0x7f/);
  });

  // 0x01 is reserved and 0x04 means "no KDF" — neither can derive a key, so
  // neither is meaningful on an export file that must be openable standalone.
  it('rejects KDF kinds that cannot derive a key', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1));

    for (const kdfKind of [KdfKind.reservedPbkdf2, KdfKind.none]) {
      const tampered = Uint8Array.from(sealed);
      tampered[2] = kdfKind;
      expect(() => parseExportFile(tampered)).toThrow(/cannot derive a key/);

      await expect(sealExportFile(kdfKind, salt, params, key, bytes(1))).rejects.toThrow(
        /cannot derive a key/,
      );
    }
  });

  it('rejects a salt that is not 16 bytes', async () => {
    const key = await generateAesKey();

    await expect(
      sealExportFile(KdfKind.argon2id, filledBytes(8, 0), params, key, bytes(1)),
    ).rejects.toThrow(/Salt must be 16 bytes, found 8/);
  });

  // Catching this on seal means a malformed block fails on the side of the
  // wire that can still do something about it, rather than on read.
  it('rejects a parameter block the KDF kind does not take', async () => {
    const key = await generateAesKey();

    await expect(
      sealExportFile(KdfKind.argon2id, salt, filledBytes(3, 0), key, bytes(1)),
    ).rejects.toThrow(/takes 9 parameter bytes, found 3/);

    await expect(sealExportFile(KdfKind.bip39Hkdf, salt, params, key, bytes(1))).rejects.toThrow(
      /takes 0 parameter bytes, found 9/,
    );
  });

  it('rejects a parameter block too long for the single-byte length prefix', async () => {
    const key = await generateAesKey();

    await expect(
      sealExportFile(KdfKind.argon2id, salt, filledBytes(256, 0), key, bytes(1)),
    ).rejects.toThrow(/single-byte length prefix/);
  });

  // The KDF descriptor is inside the AAD, so downgrading it must not decrypt.
  it('rejects a rewritten KDF kind', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1, 2));

    const tampered = Uint8Array.from(sealed);
    // A kind that parses cleanly, so only the AAD binding can reject it.
    tampered[2] = KdfKind.bip39Hkdf;

    await expect(openExportFile(parseExportFile(tampered), key)).rejects.toThrow();
  });

  it('rejects rewritten KDF parameters', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1, 2));

    // Header is version, kind, kdfKind, 16-byte salt, params length, params.
    const paramsOffset = 3 + 16 + 1;
    const tampered = Uint8Array.from(sealed);
    // Flip bits rather than assign: 64 MiB encodes as 0x00010000, so writing
    // 0x00 over its leading byte changes nothing and tests nothing.
    tampered[paramsOffset + 1] = (tampered[paramsOffset + 1] ?? 0) ^ 0xff;

    await expect(openExportFile(parseExportFile(tampered), key)).rejects.toThrow();
  });

  it('rejects a truncated envelope rather than reading past the end', async () => {
    const key = await generateAesKey();
    // An empty payload is the shortest legal envelope, so dropping a byte
    // from it lands just under the minimum.
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, new Uint8Array(0));

    expect(() => parseExportFile(sealed.subarray(0, sealed.length - 1))).toThrow(
      /too short to carry a ciphertext/,
    );
  });

  it('survives the source header being overwritten after parsing', async () => {
    const key = await generateAesKey();
    const sealed = await sealExportFile(KdfKind.argon2id, salt, params, key, bytes(1, 2, 3));

    const parsed = parseExportFile(sealed);
    // Every header field is copied on parse, so scribbling on the header here
    // must not disturb the associated data the open call authenticates with.
    sealed.fill(0, 0, 3 + 16 + 1);

    expect(await openExportFile(parsed, key)).toEqual(bytes(1, 2, 3));
  });
});

describe('sealHandoff / parseHandoff / openHandoff — envelope C', () => {
  it('round-trips a master key to the expected recipient', async () => {
    const key = await generateAesKey();
    const masterKeyBytes = filledBytes(32, 0x7e);

    const sealed = await sealHandoff(HANDOFF_KEYS, key, masterKeyBytes);
    const opened = await openHandoff(parseHandoff(sealed), EXPECTED_HANDOFF_SENDER, key);

    expect(opened).toEqual(masterKeyBytes);
  });

  it('does not transmit the recipient public key', async () => {
    const key = await generateAesKey();
    const sealed = await sealHandoff(HANDOFF_KEYS, key, bytes(1));

    const parsed = parseHandoff(sealed);

    expect(parsed.senderPublicKey).toEqual(SENDER_PUBLIC_KEY);
    expect(parsed.ephemeralPublicKey).toEqual(EPHEMERAL_PUBLIC_KEY);
    // Header is version + kind + two 32-byte keys; the recipient's is absent.
    expect(sealed.length).toBe(2 + 32 + 32 + 12 + 1 + 16);
  });

  // Section 4.3's recipient validation rule: refuse before decrypting.
  it('refuses an envelope claiming an unexpected sender', async () => {
    const key = await generateAesKey();
    const sealed = await sealHandoff(HANDOFF_KEYS, key, bytes(1));

    await expect(
      openHandoff(
        parseHandoff(sealed),
        {
          expectedSenderPublicKey: filledBytes(32, 0xff),
          recipientPublicKey: RECIPIENT_PUBLIC_KEY,
        },
        key,
      ),
    ).rejects.toThrow(/does not match the expected sender/);
  });

  it('fails when the recipient key differs, even though it is not on the wire', async () => {
    const key = await generateAesKey();
    const sealed = await sealHandoff(HANDOFF_KEYS, key, bytes(1));

    await expect(
      openHandoff(
        parseHandoff(sealed),
        { expectedSenderPublicKey: SENDER_PUBLIC_KEY, recipientPublicKey: filledBytes(32, 0x00) },
        key,
      ),
    ).rejects.toThrow();
  });

  it('rejects a sender public key that is not 32 bytes', async () => {
    const key = await generateAesKey();

    await expect(
      sealHandoff({ ...HANDOFF_KEYS, senderPublicKey: filledBytes(31, 0xa1) }, key, bytes(1)),
    ).rejects.toThrow(/Sender public key must be 32 bytes, found 31/);
  });

  it('rejects an ephemeral public key that is not 32 bytes', async () => {
    const key = await generateAesKey();

    await expect(
      sealHandoff({ ...HANDOFF_KEYS, ephemeralPublicKey: filledBytes(33, 0xc3) }, key, bytes(1)),
    ).rejects.toThrow(/Ephemeral public key must be 32 bytes, found 33/);
  });

  it('rejects a blob sealed as some other envelope kind', async () => {
    const key = await generateAesKey();
    const sealed = await sealWithKey(EnvelopeKind.vault, key, filledBytes(80, 0x01));

    expect(() => parseHandoff(sealed)).toThrow(/kind mismatch/);
  });

  it('rejects a truncated envelope rather than reading past the end', async () => {
    const key = await generateAesKey();
    // An empty payload is the shortest legal envelope, so dropping a byte
    // from it lands just under the minimum.
    const sealed = await sealHandoff(HANDOFF_KEYS, key, new Uint8Array(0));

    expect(() => parseHandoff(sealed.subarray(0, sealed.length - 1))).toThrow(
      /too short to carry a ciphertext/,
    );
  });
});

describe('argon2id parameter block', () => {
  it('round-trips the target parameters', () => {
    const encoded = encodeArgon2idParams(64 * 1024, 3, 1);

    expect(encoded.length).toBe(9);
    expect(decodeArgon2idParams(encoded)).toEqual({
      memoryKib: 64 * 1024,
      iterations: 3,
      parallelism: 1,
    });
  });

  it('encodes the two counters big-endian', () => {
    const encoded = encodeArgon2idParams(0x01020304, 0x05060708, 0x09);

    expect(Array.from(encoded)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  // A caller passing memory in MiB instead of KiB, or a parallelism read from
  // config, would otherwise encode a wrapped value and derive the wrong key.
  it('rejects a counter too large for its field', () => {
    expect(() => encodeArgon2idParams(0x1_0000_0000, 3, 1)).toThrow(EnvelopeFormatError);
    expect(() => encodeArgon2idParams(64 * 1024, 0x1_0000_0000, 1)).toThrow(EnvelopeFormatError);
    expect(() => encodeArgon2idParams(64 * 1024, 3, 256)).toThrow(EnvelopeFormatError);
  });

  it('rejects a negative or fractional parameter', () => {
    expect(() => encodeArgon2idParams(-1, 3, 1)).toThrow(EnvelopeFormatError);
    expect(() => encodeArgon2idParams(64 * 1024, 2.5, 1)).toThrow(EnvelopeFormatError);
  });

  it('accepts the largest legal values', () => {
    const encoded = encodeArgon2idParams(0xffffffff, 0xffffffff, 0xff);

    expect(decodeArgon2idParams(encoded)).toEqual({
      memoryKib: 0xffffffff,
      iterations: 0xffffffff,
      parallelism: 0xff,
    });
  });

  it('rejects a parameter block of the wrong length', () => {
    expect(() => decodeArgon2idParams(filledBytes(8, 0))).toThrow(/must be 9 bytes, found 8/);
  });
});
