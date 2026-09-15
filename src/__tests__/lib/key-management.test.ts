/**
 * Key-management tests. The byte-level framing is covered by
 * `envelope.test.ts`; this file covers derivation, generation and wrapping.
 *
 * The published-vector tests here exist for one reason: every derivation below
 * produces a key that looks perfectly valid whether or not it is the specified
 * one. Nothing round-trips its way to catching a wrong HKDF salt or a wrong
 * PBKDF2 salt — the app would encrypt and decrypt happily against its own
 * mistake, and only a second implementation would ever disagree. The vectors
 * are that second implementation.
 *
 * The vectors that pin the *libraries* rather than this module live beside
 * them: `argon2-conformance.test.ts` and `hkdf-conformance.test.ts`.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { hkdf } from '@noble/hashes/hkdf.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';

import {
  ARGON2ID_PARAMS,
  decryptVault,
  deriveKek,
  deriveRecoveryKek,
  deriveVerifier,
  encryptVault,
  generateKeypair,
  generateMasterKey,
  generateRecoveryPhrase,
  generateSalt,
  isValidRecoveryPhrase,
  isWrongKey,
  mnemonicToSeed,
  publicKeyFingerprint,
  unwrapFromSender,
  unwrapMasterKey,
  unwrapPrivateKey,
  wrapForRecipient,
  wrapMasterKey,
  wrapPrivateKey,
} from '@/lib/key-management';
import { openHandoff, parseHandoff } from '@/lib/envelope';
import type { BudgetBackup } from '@/lib/db';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

/**
 * Argon2id at the locked parameters costs roughly 200 ms a call, and the tests
 * that exercise the real derivation path make several. Applied only to those.
 */
const DERIVATION_TIMEOUT_MS = 30_000;

/** Cheap Argon2id params. Only for tests that care about a property, not a value. */
const FAST_PARAMS = { memoryKib: 256, iterations: 1, parallelism: 1 };

/** The two ways to type "ö", for the NFKD normalisation test below. */
const LATIN_SMALL_O_WITH_DIAERESIS = 0x00f6;
const COMBINING_DIAERESIS = 0x0308;

/**
 * The all-`abandon` mnemonic is BIP-39's own first published test vector, so it
 * is a valid phrase with a valid checksum and needs no explanation when it
 * turns up in an assertion.
 */
const TEST_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const EMPTY_BACKUP: BudgetBackup = {
  version: 1,
  exportedAt: '2026-09-13T00:00:00.000Z',
  activeScenarioId: null,
  scenarios: [],
  categories: [],
  budgetRules: [],
  forecastRules: [],
  transactions: [],
  savingsGoals: [],
  balanceAnchors: [],
  savingsAnchors: [],
  categoryRules: [],
};

describe('mnemonicToSeed', () => {
  // The canonical BIP-39 vectors (trezor/python-mnemonic vectors.json) are
  // generated with the passphrase "TREZOR", so they are run with it here. A
  // wrong seed derivation would lock every recovery phrase out permanently.
  const BIP39_VECTORS = [
    {
      mnemonic: TEST_PHRASE,
      seed: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    },
    {
      mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow',
      seed: '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
    },
  ];

  it.each(BIP39_VECTORS)(
    'matches the reference seed for "$mnemonic"',
    async ({ mnemonic, seed }) => {
      expect(toHex(await mnemonicToSeed(mnemonic, 'TREZOR'))).toBe(seed);
    },
  );

  it('salts with exactly "mnemonic" when no passphrase is given', async () => {
    // Section 6.1 declines to offer a BIP-39 passphrase, so production always
    // takes this path. Pinned against the empty-string passphrase explicitly,
    // because "mnemonic" + "" and "mnemonic" must stay the same salt.
    const defaulted = await mnemonicToSeed(TEST_PHRASE);
    const explicitlyEmpty = await mnemonicToSeed(TEST_PHRASE, '');

    expect(toHex(defaulted)).toBe(toHex(explicitlyEmpty));
    expect(toHex(defaulted)).not.toBe(toHex(await mnemonicToSeed(TEST_PHRASE, 'TREZOR')));
  });
});

describe('generateRecoveryPhrase', () => {
  const realGetRandomValues = crypto.getRandomValues;

  afterEach(() => {
    Object.defineProperty(crypto, 'getRandomValues', {
      value: realGetRandomValues,
      configurable: true,
    });
  });

  it('produces a valid 12-word phrase', () => {
    const phrase = generateRecoveryPhrase();

    expect(phrase.split(' ')).toHaveLength(12);
    expect(isValidRecoveryPhrase(phrase)).toBe(true);
  });

  it('produces a different phrase each time', () => {
    expect(generateRecoveryPhrase()).not.toBe(generateRecoveryPhrase());
  });

  it('refuses to run without a CSPRNG rather than falling back', () => {
    // Section 6.1. A mnemonic from Math.random is indistinguishable from a
    // real one and worth nothing, and this is precisely the fallback someone
    // adds later to make a test pass in a non-secure context.
    Object.defineProperty(crypto, 'getRandomValues', { value: undefined, configurable: true });

    expect(() => generateRecoveryPhrase()).toThrow(/no cryptographic random source/i);
  });
});

describe('deriveRecoveryKek', () => {
  it('is deterministic from the phrase alone', async () => {
    const masterKey = await generateMasterKey();
    const wrapped = await wrapMasterKey(await deriveRecoveryKek(TEST_PHRASE), masterKey);

    // A separate derivation from the same words has to open it — there is no
    // salt stored anywhere for the recovery path (section 6.3).
    const reopened = await unwrapMasterKey(await deriveRecoveryKek(TEST_PHRASE), wrapped);

    expect(await exportRawKey(reopened)).toEqual(await exportRawKey(masterKey));
  });

  it('ignores surrounding and repeated whitespace', async () => {
    const masterKey = await generateMasterKey();
    const wrapped = await wrapMasterKey(await deriveRecoveryKek(TEST_PHRASE), masterKey);

    const untidy = `  ${TEST_PHRASE.split(' ').join('   ')}\n`;
    await expect(unwrapMasterKey(await deriveRecoveryKek(untidy), wrapped)).resolves.toBeDefined();
  });

  it('refuses a phrase that fails the BIP-39 checksum', async () => {
    const wrongChecksum = TEST_PHRASE.replace(/about$/, 'zoo');

    await expect(deriveRecoveryKek(wrongChecksum)).rejects.toThrow(/valid BIP-39/i);
  });
});

describe('deriveKek', () => {
  it(
    'normalises the password to NFKD before deriving',
    async () => {
      // Section 3.5. The same character typed as a precomposed "ö" and as "o"
      // plus a combining diaeresis must reach Argon2id as the same bytes; if it
      // does not, one of the two forms produces a permanently unopenable vault.
      //
      // Built from code points rather than written out: as literals the two
      // passwords are indistinguishable on screen, and the test then reads as
      // an assertion that two identical strings differ. Escapes are no good
      // either — Prettier rewrites them back to the literal characters.
      const precomposed = `passw${String.fromCharCode(LATIN_SMALL_O_WITH_DIAERESIS)}rd`;
      const decomposed = `passwo${String.fromCharCode(COMBINING_DIAERESIS)}rd`;
      expect(precomposed).not.toBe(decomposed);

      const salt = generateSalt();
      const masterKey = await generateMasterKey();
      const wrapped = await wrapMasterKey(
        await deriveKek(precomposed, salt, FAST_PARAMS),
        masterKey,
      );

      await expect(
        unwrapMasterKey(await deriveKek(decomposed, salt, FAST_PARAMS), wrapped),
      ).resolves.toBeDefined();
    },
    DERIVATION_TIMEOUT_MS,
  );

  it(
    'does not trim or case-fold the password',
    async () => {
      const salt = generateSalt();
      const masterKey = await generateMasterKey();
      const wrapped = await wrapMasterKey(await deriveKek('secret', salt, FAST_PARAMS), masterKey);

      await expect(
        unwrapMasterKey(await deriveKek(' secret', salt, FAST_PARAMS), wrapped),
      ).rejects.toThrow();
      await expect(
        unwrapMasterKey(await deriveKek('Secret', salt, FAST_PARAMS), wrapped),
      ).rejects.toThrow();
    },
    DERIVATION_TIMEOUT_MS,
  );

  it(
    'derives a different key for a different salt',
    async () => {
      const masterKey = await generateMasterKey();
      const wrapped = await wrapMasterKey(
        await deriveKek('secret', generateSalt(), FAST_PARAMS),
        masterKey,
      );

      await expect(
        unwrapMasterKey(await deriveKek('secret', generateSalt(), FAST_PARAMS), wrapped),
      ).rejects.toThrow();
    },
    DERIVATION_TIMEOUT_MS,
  );

  it('locks the Argon2id parameters at the benchmarked values', () => {
    // Section 3.4. The upgrade path only ever strengthens these; a silent
    // weakening is the change this assertion exists to catch.
    expect(ARGON2ID_PARAMS).toEqual({ memoryKib: 65536, iterations: 3, parallelism: 1 });
  });
});

describe('deriveVerifier', () => {
  it(
    'differs from the KEK derived from the same password',
    async () => {
      // Section 3.3: independent salts are the only domain separation between
      // the two, and the doc records that as sufficient.
      const password = 'correct horse battery staple';
      const verifier = await deriveVerifier(password, generateSalt(), FAST_PARAMS);
      const otherVerifier = await deriveVerifier(password, generateSalt(), FAST_PARAMS);

      expect(verifier).toHaveLength(32);
      expect(toHex(verifier)).not.toBe(toHex(otherVerifier));
    },
    DERIVATION_TIMEOUT_MS,
  );

  it(
    'is reproducible from the same password and salt',
    async () => {
      const salt = generateSalt();

      const first = await deriveVerifier('correct horse', salt, FAST_PARAMS);
      const second = await deriveVerifier('correct horse', salt, FAST_PARAMS);

      expect(toHex(second)).toBe(toHex(first));
    },
    DERIVATION_TIMEOUT_MS,
  );
});

describe('wrapping key material', () => {
  it('round-trips a master key under a KEK', async () => {
    const kek = await deriveRecoveryKek(generateRecoveryPhrase());
    const masterKey = await generateMasterKey();

    const reopened = await unwrapMasterKey(kek, await wrapMasterKey(kek, masterKey));

    expect(await exportRawKey(reopened)).toEqual(await exportRawKey(masterKey));
  });

  it('round-trips a private key under a KEK', async () => {
    const kek = await deriveRecoveryKek(generateRecoveryPhrase());
    const { privateKey } = generateKeypair();

    const reopened = await unwrapPrivateKey(kek, await wrapPrivateKey(kek, privateKey));

    expect(reopened).toEqual(privateKey);
  });

  it('refuses a master key wrap opened as a private key wrap', async () => {
    // The KIND byte is bound into the AAD, so a server moving a blob between
    // the two `user_keys` slots fails authentication rather than handing back
    // 32 bytes of the wrong key. This is the attack section 4 exists to block.
    const kek = await deriveRecoveryKek(generateRecoveryPhrase());
    const wrapped = await wrapMasterKey(kek, await generateMasterKey());

    await expect(unwrapPrivateKey(kek, wrapped)).rejects.toThrow();
  });

  it('refuses a wrap opened under the wrong KEK', async () => {
    const wrapped = await wrapMasterKey(
      await deriveRecoveryKek(generateRecoveryPhrase()),
      await generateMasterKey(),
    );
    const wrongKek = await deriveRecoveryKek(generateRecoveryPhrase());

    await expect(unwrapMasterKey(wrongKek, wrapped)).rejects.toThrow();
  });
});

describe('vault encryption', () => {
  it('round-trips a backup under the master key', async () => {
    const masterKey = await generateMasterKey();

    const restored = await decryptVault(masterKey, await encryptVault(masterKey, EMPTY_BACKUP));

    expect(restored).toEqual(EMPTY_BACKUP);
  });

  it('refuses a vault opened under a different master key', async () => {
    const sealed = await encryptVault(await generateMasterKey(), EMPTY_BACKUP);

    await expect(decryptVault(await generateMasterKey(), sealed)).rejects.toThrow();
  });

  it('produces different ciphertext each time, because the IV is fresh per call', async () => {
    const masterKey = await generateMasterKey();

    const first = await encryptVault(masterKey, EMPTY_BACKUP);
    const second = await encryptVault(masterKey, EMPTY_BACKUP);

    expect(toHex(first)).not.toBe(toHex(second));
  });
});

describe('isWrongKey', () => {
  /**
   * Matching on the error's class rather than its name answers differently in
   * a browser and in Node, so the predicate has to be exercised against a real
   * rejection rather than a hand-built one.
   */
  it('recognises a failed decrypt as a wrong key', async () => {
    const sealed = await encryptVault(await generateMasterKey(), EMPTY_BACKUP);

    await expect(decryptVault(await generateMasterKey(), sealed)).rejects.toSatisfy(isWrongKey);
  });

  it('does not claim an ordinary error is a wrong key', () => {
    expect(isWrongKey(new Error('network request failed'))).toBe(false);
    expect(isWrongKey('not an error at all')).toBe(false);
  });
});

describe('invite handoff', () => {
  it('hands the master key to the intended recipient', async () => {
    const sender = generateKeypair();
    const recipient = generateKeypair();
    const masterKey = await generateMasterKey();

    const envelope = await wrapForRecipient(sender.privateKey, recipient.publicKey, masterKey);
    const received = await unwrapFromSender(recipient.privateKey, sender.publicKey, envelope);

    expect(await exportRawKey(received)).toEqual(await exportRawKey(masterKey));
  });

  it('refuses an envelope attributed to the wrong sender', async () => {
    // Section 4.3's recipient validation rule, exercised with real X25519 keys
    // rather than the placeholder byte arrays envelope.test.ts uses. This is
    // the "server lies about who sent the wrap" attack.
    const sender = generateKeypair();
    const recipient = generateKeypair();
    const impostor = generateKeypair();

    const envelope = await wrapForRecipient(
      sender.privateKey,
      recipient.publicKey,
      await generateMasterKey(),
    );

    await expect(
      unwrapFromSender(recipient.privateKey, impostor.publicKey, envelope),
    ).rejects.toThrow(/sender/i);
  });

  it('cannot be opened by anyone but the named recipient', async () => {
    const sender = generateKeypair();
    const recipient = generateKeypair();
    const eavesdropper = generateKeypair();

    const envelope = await wrapForRecipient(
      sender.privateKey,
      recipient.publicKey,
      await generateMasterKey(),
    );

    await expect(
      unwrapFromSender(eavesdropper.privateKey, sender.publicKey, envelope),
    ).rejects.toThrow();
  });

  it('uses a fresh ephemeral key for every wrap', async () => {
    // Reusing it would cost forward secrecy.
    const sender = generateKeypair();
    const recipient = generateKeypair();
    const masterKey = await generateMasterKey();

    const first = await wrapForRecipient(sender.privateKey, recipient.publicKey, masterKey);
    const second = await wrapForRecipient(sender.privateKey, recipient.publicKey, masterKey);

    expect(toHex(parseHandoff(first).ephemeralPublicKey)).not.toBe(
      toHex(parseHandoff(second).ephemeralPublicKey),
    );
  });
});

describe('publicKeyFingerprint', () => {
  it('is stable for a given public key', async () => {
    const { publicKey } = generateKeypair();

    expect(toHex(await publicKeyFingerprint(publicKey))).toBe(
      toHex(await publicKeyFingerprint(publicKey)),
    );
  });

  it('differs between public keys', async () => {
    const first = await publicKeyFingerprint(generateKeypair().publicKey);
    const second = await publicKeyFingerprint(generateKeypair().publicKey);

    expect(toHex(first)).not.toBe(toHex(second));
  });

  it('is the truncated SHA-256 of the key, not some other digest', async () => {
    const { publicKey } = generateKeypair();
    const fullDigest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', publicKey as Uint8Array<ArrayBuffer>),
    );

    const truncated = await publicKeyFingerprint(publicKey);

    expect(truncated).toHaveLength(8);
    expect(toHex(truncated)).toBe(toHex(fullDigest.slice(0, 8)));
  });
});

/**
 * The two HKDF `info` strings are domain separators, and a typo in either is
 * invisible to every round-trip test in this file: the app would wrap and
 * unwrap perfectly against its own mistake. Only a second implementation
 * disagrees, so these tests are that second implementation. They spell each
 * string out literally rather than importing the module's constant — importing
 * it would make the assertion circular and prove nothing.
 *
 * Verified by mutation: changing either constant fails exactly these tests.
 */
describe('HKDF domain separation', () => {
  it('derives KEK_rec with the info string section 6.2 specifies', async () => {
    const seed = await mnemonicToSeed(TEST_PHRASE);
    const expectedBytes = hkdf(
      sha256,
      seed,
      undefined,
      new TextEncoder().encode('safelyspend-recovery-kek-v1'),
      32,
    );
    const expectedKek = await crypto.subtle.importKey(
      'raw',
      expectedBytes as Uint8Array<ArrayBuffer>,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );

    // The KEK is non-extractable, so compare by what it opens rather than by
    // its bytes: wrap under the module's key, unwrap under the expected one.
    const masterKey = await generateMasterKey();
    const wrapped = await wrapMasterKey(await deriveRecoveryKek(TEST_PHRASE), masterKey);

    await expect(unwrapMasterKey(expectedKek, wrapped)).resolves.toBeDefined();
  });

  it('derives the handoff key with the info string section 4.3 specifies', async () => {
    const sender = generateKeypair();
    const recipient = generateKeypair();
    const masterKey = await generateMasterKey();

    const envelope = await wrapForRecipient(sender.privateKey, recipient.publicKey, masterKey);
    const parsed = parseHandoff(envelope);

    // Rebuild the receiver side from section 4.3 directly: ikm is the static
    // secret then the ephemeral one, info is the literal prefix followed by
    // sender then recipient public key.
    const sharedStatic = x25519.getSharedSecret(recipient.privateKey, sender.publicKey);
    const sharedEphemeral = x25519.getSharedSecret(recipient.privateKey, parsed.ephemeralPublicKey);
    const ikm = new Uint8Array([...sharedStatic, ...sharedEphemeral]);
    const info = new Uint8Array([
      ...new TextEncoder().encode('ss-handoff-v1'),
      ...sender.publicKey,
      ...recipient.publicKey,
    ]);
    const expectedKey = await crypto.subtle.importKey(
      'raw',
      hkdf(sha256, ikm, undefined, info, 32) as Uint8Array<ArrayBuffer>,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );

    const opened = await openHandoff(
      parsed,
      { expectedSenderPublicKey: sender.publicKey, recipientPublicKey: recipient.publicKey },
      expectedKey,
    );

    expect(opened).toEqual(await exportRawKey(masterKey));
  });
});
