import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildPasswordResetMaterial,
  buildSignupMaterial,
  deriveLoginVerifier,
  unlockKeyBundle,
  unlockKeyBundleWithPhrase,
  KeyBundleError,
  WrongPasswordError,
  WrongPhraseError,
  type SignupMaterial,
} from '@/lib/account';
import { base64urlToBytes } from '@/lib/base64url';
import { EnvelopeKind, FORMAT_VERSION, KdfKind } from '@/lib/envelope';
import {
  decryptVault,
  deriveRecoveryKek,
  encryptVault,
  unwrapMasterKey,
} from '@/lib/key-management';
import type { KeyBundle, RecoveryResetBody } from '@/lib/api-client';
import type { BudgetBackup } from '@/lib/db';

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a different twelve plus character password';

/** BIP-39's own all-zero-entropy vector. A real mnemonic, so it passes validation. */
const RECOVERY_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/**
 * BIP-39's all-0x7f vector: a phrase that passes its checksum and still opens
 * nothing. The case a valid-looking phrase from the wrong account produces, and
 * the only one that reaches the unwrap.
 */
const OTHER_RECOVERY_PHRASE =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

/**
 * Twelve real words whose checksum does not add up — what a mistyped last word
 * produces. Never reaches the wrapped rows, so it fails differently inside.
 */
const MISTYPED_RECOVERY_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';

/**
 * Argon2id at the locked parameters costs roughly 130 ms a derivation, and a
 * signup pays it twice — so a test that builds one and opens it again is
 * several hundred milliseconds of real work, not a hang. Generous enough that
 * a slower machine does not produce a flake.
 */
const ARGON2ID_TIMEOUT_MS = 20_000;

/**
 * Reassemble the key bundle the server would hand back, from the material we
 * uploaded. Mirroring the round trip is the point: the bytes that go up are
 * the bytes that have to come back and open.
 */
function bundleFrom(material: SignupMaterial): KeyBundle {
  const { body } = material;
  return {
    user: {
      id: 'user-1',
      pubkey: body.pubkey,
      verifierSalt: body.verifierSalt,
      verifierKdfKind: body.verifierKdfKind,
      verifierKdfParams: body.verifierKdfParams,
    },
    userKeys: body.userKeys,
    household: body.household,
    memberKeys: body.memberKeys,
  };
}

/**
 * The bundle the server would hand back *after* a recovery reset: the new
 * password rows in place of the old ones, the recovery rows untouched. That
 * substitution is the endpoint's whole behaviour, so the tests reproduce it
 * rather than assume it.
 */
function bundleAfterReset(material: SignupMaterial, reset: RecoveryResetBody): KeyBundle {
  const bundle = bundleFrom(material);
  return {
    ...bundle,
    user: {
      ...bundle.user,
      verifierSalt: reset.newVerifier.verifierSalt,
      verifierKdfKind: reset.newVerifier.verifierKdfKind,
      verifierKdfParams: reset.newVerifier.verifierKdfParams,
    },
    userKeys: [
      { ...reset.newUserKeyPwd, kekKind: 'pwd' },
      ...bundle.userKeys.filter((row) => row.kekKind === 'recovery'),
    ],
    memberKeys: [
      { ...reset.newMemberKeyPwd, kekKind: 'pwd', senderUserId: null, senderPubkey: null },
      ...bundle.memberKeys.filter((row) => row.kekKind === 'recovery'),
    ],
  };
}

describe('buildSignupMaterial', () => {
  let material: SignupMaterial;

  beforeAll(async () => {
    material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
  }, ARGON2ID_TIMEOUT_MS);

  it(
    'refuses a recovery phrase that is not a valid mnemonic',
    async () => {
      // The message, not a bare throw: an unrelated failure inside a signup
      // would satisfy `rejects.toThrow()` and leave this passing for the wrong
      // reason, which on a validation test is the only reason that matters.
      await expect(buildSignupMaterial(PASSWORD, 'not a mnemonic')).rejects.toThrow(
        'Recovery phrase is not a valid BIP-39 mnemonic',
      );
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it('sends both a pwd and a recovery user key', () => {
    expect(material.body.userKeys.map((row) => row.kekKind).sort()).toEqual(['pwd', 'recovery']);
  });

  it('sends both a pwd and a recovery member key', () => {
    // A partial write is rejected server-side, so this is really a check that
    // the client sends both rather than that the server stores both.
    expect(material.body.memberKeys.map((row) => row.kekKind).sort()).toEqual(['pwd', 'recovery']);
  });

  // The server's assertKekMetadata rejects anything else, and an INVALID_BLOB
  // at signup gives no hint which column was wrong.
  it('describes the pwd rows as Argon2id with a 16-byte salt and 9 parameter bytes', () => {
    for (const row of [...material.body.userKeys, ...material.body.memberKeys]) {
      if (row.kekKind !== 'pwd') continue;
      expect(row.kekKdfKind).toBe(KdfKind.argon2id);
      expect(base64urlToBytes(row.kekSalt as string)).toHaveLength(16);
      expect(base64urlToBytes(row.kekKdfParams as string)).toHaveLength(9);
    }
  });

  it('describes the recovery rows as BIP-39 with a null salt and empty parameters', () => {
    for (const row of [...material.body.userKeys, ...material.body.memberKeys]) {
      if (row.kekKind !== 'recovery') continue;
      expect(row.kekKdfKind).toBe(KdfKind.bip39Hkdf);
      // Null, because BIP-39 is deterministic from the phrase. The parameters
      // are the empty string rather than null: zero bytes of parameters is a
      // different thing from no parameter column, and the server checks which.
      expect(row.kekSalt).toBeNull();
      expect(row.kekKdfParams).toBe('');
    }
  });

  it('wraps the private key as envelope A kind 0x03', () => {
    for (const row of material.body.userKeys) {
      const bytes = base64urlToBytes(row.wrappedPrivKey);
      expect(bytes[0]).toBe(FORMAT_VERSION);
      expect(bytes[1]).toBe(EnvelopeKind.wrappedPrivateKey);
    }
  });

  it('wraps the master key as envelope A kind 0x02', () => {
    for (const row of material.body.memberKeys) {
      const bytes = base64urlToBytes(row.wrappedMasterKey);
      expect(bytes[0]).toBe(FORMAT_VERSION);
      expect(bytes[1]).toBe(EnvelopeKind.wrappedMasterKey);
    }
  });

  it('sends a 32-byte public key and a 32-byte verifier', () => {
    expect(base64urlToBytes(material.body.pubkey)).toHaveLength(32);
    expect(base64urlToBytes(material.body.verifierCandidate)).toHaveLength(32);
  });

  it('uses independent salts for the verifier and for KEK_pwd', () => {
    // The only domain separation between the two derivations (section 3.3).
    // Reusing one salt for both would silently make the verifier equal to the
    // KEK, handing the server the key it must never hold.
    const passwordRow = material.body.userKeys.find((row) => row.kekKind === 'pwd');
    expect(material.body.verifierSalt).not.toBe(passwordRow?.kekSalt);
  });

  it('generates a household id client-side', () => {
    expect(material.body.household.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('unlockKeyBundle', () => {
  const backup = { transactions: [{ id: 'txn-1' }] } as unknown as BudgetBackup;

  it(
    'recovers a master key that decrypts what the signup key encrypted',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const sealed = await encryptVault(material.keys.masterKey, backup);

      const reopened = await unlockKeyBundle(PASSWORD, bundleFrom(material));

      expect(await decryptVault(reopened.masterKey, sealed)).toEqual(backup);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'recovers the same private key',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      const reopened = await unlockKeyBundle(PASSWORD, bundleFrom(material));

      expect(reopened.privateKey).toEqual(material.keys.privateKey);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  /**
   * NFKD normalisation is applied once, inside `deriveKek`. A password that
   * normalises differently on the second pass is a permanently unopenable
   * vault, so this is worth a real test rather than a reading of the code.
   *
   * "café" composed (U+00E9) and decomposed (e + U+0301) are different byte
   * strings that NFKD folds together.
   */
  it(
    'unlocks under a differently-composed spelling of the same password',
    async () => {
      const decomposed = 'cafe\u0301 passphrase';
      const composed = 'caf\u00e9 passphrase';
      expect(decomposed).not.toBe(composed);

      const material = await buildSignupMaterial(decomposed, RECOVERY_PHRASE);

      await expect(unlockKeyBundle(composed, bundleFrom(material))).resolves.toBeDefined();
    },
    ARGON2ID_TIMEOUT_MS,
  );

  /** Guards `assertSameKek` in `account.ts`, which carries the reasoning. */
  it(
    'refuses when the two rows were wrapped under different KEKs',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const bundle = bundleFrom(material);
      const memberKey = bundle.memberKeys.find((row) => row.kekKind === 'pwd');
      memberKey!.kekSalt = 'AAAAAAAAAAAAAAAAAAAAAA';

      await expect(unlockKeyBundle(PASSWORD, bundle)).rejects.toThrow(KeyBundleError);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'fails on the wrong password',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      // A typed error, not a bare GCM tag failure: both call sites have to tell
      // this apart from a structural one, and neither should be reading a
      // DOMException's name to do it.
      await expect(unlockKeyBundle('some other password', bundleFrom(material))).rejects.toThrow(
        WrongPasswordError,
      );
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'rejects a bundle with no password-wrapped rows',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const bundle = bundleFrom(material);
      bundle.userKeys = bundle.userKeys.filter((row) => row.kekKind !== 'pwd');

      await expect(unlockKeyBundle(PASSWORD, bundle)).rejects.toThrow(KeyBundleError);
    },
    ARGON2ID_TIMEOUT_MS,
  );
});

describe('the recovery-wrapped rows', () => {
  /**
   * The path nobody walks until someone has actually lost their password,
   * which is the worst moment to discover it was never wired up.
   */
  it(
    'opens the master key with the recovery phrase alone',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const sealed = await encryptVault(material.keys.masterKey, {
        categories: [],
      } as unknown as BudgetBackup);

      const row = material.body.memberKeys.find((entry) => entry.kekKind === 'recovery');
      const kek = await deriveRecoveryKek(RECOVERY_PHRASE);
      const masterKey = await unwrapMasterKey(kek, base64urlToBytes(row!.wrappedMasterKey));

      expect(await decryptVault(masterKey, sealed)).toEqual({ categories: [] });
    },
    ARGON2ID_TIMEOUT_MS,
  );
});

describe('unlockKeyBundleWithPhrase', () => {
  const backup = { transactions: [{ id: 'txn-1' }] } as unknown as BudgetBackup;

  it(
    'recovers the master key that sealed the vault',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const sealed = await encryptVault(material.keys.masterKey, backup);

      const reopened = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));

      expect(await decryptVault(reopened.masterKey, sealed)).toEqual(backup);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'recovers the private key as well as the master key',
    async () => {
      // Section 7's handoff needs PrivKey in memory. A recovery that produced
      // only the MasterKey would leave someone unable to accept an invite.
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      const reopened = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));

      expect(reopened.privateKey).toHaveLength(32);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'reports a valid but wrong phrase as a wrong phrase',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      await expect(
        unlockKeyBundleWithPhrase(OTHER_RECOVERY_PHRASE, bundleFrom(material)),
      ).rejects.toThrow(WrongPhraseError);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'reports a phrase failing its checksum as a wrong phrase too',
    async () => {
      // Same sentence as a valid-but-wrong phrase, because the user can do
      // nothing different about either. What matters is that it is a
      // WrongPhraseError and not the bare Error deriveRecoveryKek throws.
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      await expect(
        unlockKeyBundleWithPhrase(MISTYPED_RECOVERY_PHRASE, bundleFrom(material)),
      ).rejects.toThrow(WrongPhraseError);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'reports a missing recovery row as structural, not as a wrong phrase',
    async () => {
      // An account with no way back in is not the user mistyping, and telling
      // them it is would send them hunting for a phrase that cannot help.
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const bundle = bundleFrom(material);
      bundle.userKeys = bundle.userKeys.filter((row) => row.kekKind !== 'recovery');

      await expect(unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundle)).rejects.toThrow(
        KeyBundleError,
      );
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'refuses a recovery row naming a KDF it cannot perform',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const bundle = bundleFrom(material);
      const row = bundle.memberKeys.find((entry) => entry.kekKind === 'recovery');
      row!.kekKdfKind = KdfKind.reservedPbkdf2;

      await expect(unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundle)).rejects.toThrow(
        KeyBundleError,
      );
    },
    ARGON2ID_TIMEOUT_MS,
  );
});

describe('buildPasswordResetMaterial', () => {
  const backup = { transactions: [{ id: 'txn-1' }] } as unknown as BudgetBackup;

  /**
   * The whole reset, end to end, against a vault sealed before it happened.
   *
   * This is the test the feature exists for. A reset that produced a working
   * new password over a *different* master key would pass every shape check
   * above and silently strand the user's data.
   */
  it(
    'leaves the new password opening the vault the old one sealed',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const sealed = await encryptVault(material.keys.masterKey, backup);

      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      const reopened = await unlockKeyBundle(NEW_PASSWORD, bundleAfterReset(material, reset));

      expect(await decryptVault(reopened.masterKey, sealed)).toEqual(backup);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'leaves the old password unable to open the rewrapped rows',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      await expect(unlockKeyBundle(PASSWORD, bundleAfterReset(material, reset))).rejects.toThrow(
        WrongPasswordError,
      );
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'leaves the recovery phrase still working afterwards',
    async () => {
      // The server never overwrites the recovery rows, so a reset must not
      // assume it can replace them. Someone who has just used their phrase
      // still has only that phrase.
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      const again = await unlockKeyBundleWithPhrase(
        RECOVERY_PHRASE,
        bundleAfterReset(material, reset),
      );

      expect(again.privateKey).toEqual(recovered.privateKey);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'produces a verifier the server will accept for the new password',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      const candidate = await deriveLoginVerifier(NEW_PASSWORD, reset.newVerifier);

      expect(candidate).toBe(reset.newVerifier.verifierCandidate);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'uses fresh, independent salts rather than the ones it is replacing',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      const oldKekSalt = material.body.userKeys.find((row) => row.kekKind === 'pwd')!.kekSalt;

      expect(reset.newUserKeyPwd.kekSalt).not.toBe(oldKekSalt);
      expect(reset.newVerifier.verifierSalt).not.toBe(material.body.verifierSalt);
      expect(reset.newVerifier.verifierSalt).not.toBe(reset.newUserKeyPwd.kekSalt);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it(
    'wraps both rows under the one KEK, as unlockKeyBundle requires',
    async () => {
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);
      const recovered = await unlockKeyBundleWithPhrase(RECOVERY_PHRASE, bundleFrom(material));
      const reset = await buildPasswordResetMaterial(NEW_PASSWORD, recovered);

      expect(reset.newMemberKeyPwd.kekSalt).toBe(reset.newUserKeyPwd.kekSalt);
      expect(reset.newMemberKeyPwd.kekKdfParams).toBe(reset.newUserKeyPwd.kekKdfParams);
    },
    ARGON2ID_TIMEOUT_MS,
  );
});

describe('deriveLoginVerifier', () => {
  it(
    'reproduces the verifier the account was created with',
    async () => {
      // If these two ever disagree, every sign-in reports a wrong password
      // against a password that is right.
      const material = await buildSignupMaterial(PASSWORD, RECOVERY_PHRASE);

      const candidate = await deriveLoginVerifier(PASSWORD, {
        verifierSalt: material.body.verifierSalt,
        verifierKdfKind: material.body.verifierKdfKind,
        verifierKdfParams: material.body.verifierKdfParams,
      });

      expect(candidate).toBe(material.body.verifierCandidate);
    },
    ARGON2ID_TIMEOUT_MS,
  );

  it('refuses a challenge naming a KDF it cannot perform', async () => {
    await expect(
      deriveLoginVerifier(PASSWORD, {
        verifierSalt: 'AAAAAAAAAAAAAAAAAAAAAA',
        // 0x01 is the reserved PBKDF2 slot: never written, never read.
        verifierKdfKind: KdfKind.reservedPbkdf2,
        verifierKdfParams: '',
      }),
    ).rejects.toThrow(KeyBundleError);
  });

  it('refuses a challenge with no salt', async () => {
    await expect(
      deriveLoginVerifier(PASSWORD, {
        verifierSalt: null,
        verifierKdfKind: KdfKind.argon2id,
        verifierKdfParams: '',
      }),
    ).rejects.toThrow(KeyBundleError);
  });
});
