/**
 * The bridge between the wire shapes in `api-client.ts` and the crypto
 * primitives in `key-management.ts`.
 *
 * Two jobs, and they are inverses of each other: assemble the key material a
 * signup uploads, and open the key bundle a session downloads. Both are here
 * rather than in a route component so they can be tested without rendering
 * anything, and so exactly one module knows how a wrapped-key row is shaped.
 *
 * Specified by `docs/crypto-design.md` sections 2, 3 and 6, and by
 * `docs/auth-rewrite/02_backend_schema_endpoints_design.md` sections 3.4 and
 * 3.7.
 */

import { bytesToBase64url, base64urlToBytes } from './base64url';
import { KdfKind, encodeArgon2idParams, decodeArgon2idParams } from './envelope';
import {
  ARGON2ID_PARAMS,
  deriveKek,
  deriveRecoveryKek,
  deriveVerifier,
  generateKeypair,
  generateMasterKey,
  generateSalt,
  isWrongKey,
  unwrapMasterKey,
  unwrapPrivateKey,
  wrapMasterKey,
  wrapPrivateKey,
} from './key-management';
import { generateId } from './utils';
import type { KeyBundle, SignupBody, UserKeyRow, MemberKeyRow } from './api-client';
import type { MasterKey, PrivateKeyBytes } from './types';

/**
 * The household has no name in v1 and no way to set one — renaming is deferred
 * in `docs/auth-rewrite/00_overview.md`. The worker defaults to this same
 * string when the field is blank; sending it explicitly keeps the default in
 * one readable place rather than in a server-side fallback.
 */
const DEFAULT_HOUSEHOLD_NAME = 'Household';

/** Phase 4's floor, from `crypto-design.md` section 8. No strength meter — deferred, not rejected. */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * What a signup produces besides the payload: the live keys, so the caller can
 * unlock the session without deriving Argon2id a second time.
 */
export interface SessionKeys {
  masterKey: MasterKey;
  privateKey: PrivateKeyBytes;
}

export interface SignupMaterial {
  body: Omit<SignupBody, 'authPendingToken' | 'rememberMe'>;
  keys: SessionKeys;
}

/** The 9-byte Argon2id parameter block, as every row that names Argon2id carries it. */
function encodedArgon2idParams(): string {
  return bytesToBase64url(
    encodeArgon2idParams(
      ARGON2ID_PARAMS.memoryKib,
      ARGON2ID_PARAMS.iterations,
      ARGON2ID_PARAMS.parallelism,
    ),
  );
}

/**
 * Assemble everything `/auth/signup` needs.
 *
 * Both wrapped-key kinds are built here because the endpoint will not take one
 * without the other (`worker/src/lib/key-material.ts:263`). That is also why
 * the recovery phrase cannot be deferred past this point: the account does not
 * exist until the recovery-wrapped rows do, so the window in which an account
 * is unrecoverable never opens.
 *
 * The phrase arrives as an argument rather than being generated in here for
 * the same reason. It is shown to the user and acknowledged *before* the
 * account is created, so it already exists by the time this runs; minting one
 * here would mean wrapping a phrase nobody had seen.
 *
 * The three derivations run in sequence rather than concurrently. Argon2id
 * holds 64 MiB while it runs, and section 3.4 makes overlapping them the lever
 * to reach for only if login latency ever becomes a complaint — a 128 MiB
 * spike in a phone browser tab is not a cost to pay for a saving nobody has
 * asked for.
 */
export async function buildSignupMaterial(
  password: string,
  recoveryPhrase: string,
): Promise<SignupMaterial> {
  const { publicKey, privateKey } = generateKeypair();
  const masterKey = await generateMasterKey();

  // Independent salts. This is the only domain separation between the verifier
  // and KEK_pwd, and section 3.3 records that it is sufficient.
  const kekSalt = generateSalt();
  const verifierSalt = generateSalt();

  const verifier = await deriveVerifier(password, verifierSalt);
  const kekPwd = await deriveKek(password, kekSalt);
  const kekRecovery = await deriveRecoveryKek(recoveryPhrase);

  const argon2idParams = encodedArgon2idParams();
  const passwordMetadata = {
    kekKind: 'pwd',
    kekSalt: bytesToBase64url(kekSalt),
    kekKdfKind: KdfKind.argon2id,
    kekKdfParams: argon2idParams,
  } as const;
  // A recovery row's salt is SQL NULL because BIP-39 is deterministic from the
  // phrase, and its parameter block is the empty string rather than null —
  // zero bytes of parameters, which is distinct from "no parameter column".
  const recoveryMetadata = {
    kekKind: 'recovery',
    kekSalt: null,
    kekKdfKind: KdfKind.bip39Hkdf,
    kekKdfParams: '',
  } as const;

  const userKeys: UserKeyRow[] = [
    {
      ...passwordMetadata,
      wrappedPrivKey: bytesToBase64url(await wrapPrivateKey(kekPwd, privateKey)),
    },
    {
      ...recoveryMetadata,
      wrappedPrivKey: bytesToBase64url(await wrapPrivateKey(kekRecovery, privateKey)),
    },
  ];

  const memberKeys: MemberKeyRow[] = [
    {
      ...passwordMetadata,
      wrappedMasterKey: bytesToBase64url(await wrapMasterKey(kekPwd, masterKey)),
      senderUserId: null,
      senderPubkey: null,
    },
    {
      ...recoveryMetadata,
      wrappedMasterKey: bytesToBase64url(await wrapMasterKey(kekRecovery, masterKey)),
      senderUserId: null,
      senderPubkey: null,
    },
  ];

  return {
    body: {
      verifierCandidate: bytesToBase64url(verifier),
      verifierSalt: bytesToBase64url(verifierSalt),
      verifierKdfKind: KdfKind.argon2id,
      verifierKdfParams: argon2idParams,
      pubkey: bytesToBase64url(publicKey),
      // Client-generated, per the locked conventions in `00_overview.md`.
      household: { id: generateId(), name: DEFAULT_HOUSEHOLD_NAME },
      userKeys,
      memberKeys,
    },
    keys: { masterKey, privateKey },
  };
}

/** Thrown when a key bundle cannot produce a session — as distinct from a wrong password. */
export class KeyBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyBundleError';
  }
}

/**
 * Thrown when the password simply did not open the wrapped rows.
 *
 * A class rather than a shared message string. Both call sites that branch on
 * this condition — the sign-in flow and the Settings unlock dialog — need to
 * tell it apart from a failed request, and branching on wording means rewording
 * the sentence silently breaks the branch, with no type and no test to notice.
 *
 * It also collapses two spellings of one condition: a raw `DOMException` from
 * Web Crypto on the paths that unwrap directly, and a plain `Error` on the
 * paths that had already translated it. Callers now see one thing.
 */
export class WrongPasswordError extends Error {
  constructor() {
    super('That password did not unlock your vault.');
    this.name = 'WrongPasswordError';
  }
}

function requirePasswordRow<Row extends { kekKind: string }>(
  rows: Row[],
  description: string,
): Row {
  const row = rows.find((candidate) => candidate.kekKind === 'pwd');
  if (!row) {
    throw new KeyBundleError(`This account has no password-wrapped ${description}`);
  }
  return row;
}

/** The KDF columns that decide which KEK a wrapped row opens under. */
interface KekDescriptor {
  kekSalt: string | null;
  kekKdfKind: number | null;
  kekKdfParams: string | null;
}

/**
 * Derive the password KEK that opens a bundle's `pwd` rows.
 *
 * The parameters come from the row rather than from `ARGON2ID_PARAMS`, because
 * a row wrapped before a parameter change still has to open — that is what the
 * rolling-upgrade path in section 3.4 depends on. Re-wrapping at the current
 * parameters afterwards is deferred post-v1; this half has to be right now
 * regardless, since getting it wrong means an unopenable vault rather than a
 * missed optimisation.
 */
async function deriveBundleKek(password: string, row: KekDescriptor): Promise<CryptoKey> {
  if (row.kekKdfKind !== KdfKind.argon2id) {
    throw new KeyBundleError('This account uses a key derivation this version cannot read');
  }
  if (!row.kekSalt || !row.kekKdfParams) {
    throw new KeyBundleError('Password key material is missing its salt or parameters');
  }
  return deriveKek(
    password,
    base64urlToBytes(row.kekSalt),
    decodeArgon2idParams(base64urlToBytes(row.kekKdfParams)),
  );
}

/**
 * Refuse to open two rows with one KEK unless they say they were wrapped under
 * the same one.
 *
 * One derivation opening both rows is an optimisation, not an invariant: it
 * holds only because `buildSignupMaterial` writes the same metadata to both
 * tables. Nothing enforces it, and the rolling upgrade in section 3.4 is
 * precisely the thing that could re-wrap `user_keys` and not
 * `household_member_keys`.
 *
 * Without this check the divergence surfaces as an AES-GCM tag failure on the
 * second unwrap — indistinguishable from a wrong password, and reported to the
 * user as one. A structural failure wearing a user-error label is the
 * expensive kind, and the check costs a string comparison rather than a second
 * 130 ms Argon2id pass.
 */
function assertSameKek(userKey: KekDescriptor, memberKey: KekDescriptor): void {
  const matches =
    userKey.kekSalt === memberKey.kekSalt &&
    userKey.kekKdfKind === memberKey.kekKdfKind &&
    userKey.kekKdfParams === memberKey.kekKdfParams;

  if (!matches) {
    throw new KeyBundleError(
      'Your account and household keys were wrapped differently, so one password cannot open both',
    );
  }
}

/**
 * Open a key bundle with the account password.
 *
 * Serves both the login branch — where `/auth/login-complete` returns the
 * bundle inline — and a local re-unlock against a session that is already
 * live, which fetches it from `/auth/key-bundle`. Both need exactly this, so
 * neither gets its own copy.
 *
 * A wrong password arrives as an AES-GCM tag failure and leaves as a
 * `WrongPasswordError`, so no caller has to know that Web Crypto expresses it
 * as an `OperationError`. Everything else this throws is a `KeyBundleError`
 * and is structural.
 */
export async function unlockKeyBundle(password: string, bundle: KeyBundle): Promise<SessionKeys> {
  const userKey = requirePasswordRow(bundle.userKeys, 'private key');
  const memberKey = requirePasswordRow(bundle.memberKeys, 'household key');
  assertSameKek(userKey, memberKey);

  const kek = await deriveBundleKek(password, userKey);

  try {
    const privateKey = await unwrapPrivateKey(kek, base64urlToBytes(userKey.wrappedPrivKey));
    const masterKey = await unwrapMasterKey(kek, base64urlToBytes(memberKey.wrappedMasterKey));
    return { masterKey, privateKey };
  } catch (err) {
    if (isWrongKey(err)) {
      throw new WrongPasswordError();
    }
    throw err;
  }
}

/**
 * Derive the proof `/auth/login-complete` checks.
 *
 * The salt and parameters are the server's, echoed back from `/verify-otp`.
 * Deriving against locally-chosen parameters would produce a verifier that
 * cannot match, which the server reports as a wrong password.
 */
export async function deriveLoginVerifier(
  password: string,
  challenge: {
    verifierSalt: string | null;
    verifierKdfKind: number | null;
    verifierKdfParams: string | null;
  },
): Promise<string> {
  if (challenge.verifierKdfKind !== KdfKind.argon2id) {
    throw new KeyBundleError('This account uses a password check this version cannot perform');
  }
  if (!challenge.verifierSalt || !challenge.verifierKdfParams) {
    throw new KeyBundleError('The sign-in challenge is missing its salt or parameters');
  }
  const verifier = await deriveVerifier(
    password,
    base64urlToBytes(challenge.verifierSalt),
    decodeArgon2idParams(base64urlToBytes(challenge.verifierKdfParams)),
  );
  return bytesToBase64url(verifier);
}
