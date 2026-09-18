/**
 * The bridge between the wire shapes in `api-client.ts` and the crypto
 * primitives in `key-management.ts`.
 *
 * Two kinds of job, mostly in inverse pairs: assemble the key material an
 * upload sends, and open the key bundle a session downloads — under the
 * password, under the recovery phrase, or, for an invitee joining a household,
 * out of a handoff envelope. All of it is here rather than in a route
 * component so it can be tested without rendering anything, and so exactly one
 * module knows how a wrapped-key row is shaped.
 *
 * Specified by `docs/crypto-design.md` sections 2, 3, 6 and 7, and by
 * `docs/auth-rewrite/02_backend_schema_endpoints_design.md` sections 3.4, 3.7
 * and 4.
 */

import { bytesToBase64url, base64urlToBytes } from './base64url';
import {
  EnvelopeFormatError,
  KdfKind,
  encodeArgon2idParams,
  decodeArgon2idParams,
} from './envelope';
import {
  ARGON2ID_PARAMS,
  deriveKek,
  derivePublicKey,
  deriveRecoveryKek,
  deriveVerifier,
  generateKeypair,
  generateMasterKey,
  generateSalt,
  isValidRecoveryPhrase,
  isWrongKey,
  unwrapFromSender,
  unwrapMasterKey,
  unwrapPrivateKey,
  wrapForRecipient,
  wrapMasterKey,
  wrapPrivateKey,
} from './key-management';
import { generateId } from './utils';
import type {
  AddMemberBody,
  KekKind,
  KeyBundle,
  RecoveryResetBody,
  RewrapBody,
  SignupBody,
  SignupWithInviteBody,
  UserKeyRow,
  MemberKeyRow,
} from './api-client';
import type { Kek, MasterKey, PrivateKeyBytes } from './types';

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
 * The live keys, returned alongside an upload body by anything that has just
 * derived them, so the caller can unlock the session without paying Argon2id
 * (~216 ms, 64 MiB) a second time.
 */
export interface SessionKeys {
  masterKey: MasterKey;
  privateKey: PrivateKeyBytes;
}

export interface SignupMaterial {
  body: Omit<SignupBody, 'authPendingToken' | 'rememberMe'>;
  keys: SessionKeys;
}

/**
 * What an invite signup produces. No keys come back: the invitee has no
 * MasterKey to unlock a session with, and their private key is re-derived from
 * the password at the moment of joining rather than held across the wait.
 */
export interface InviteSignupMaterial {
  body: Omit<SignupWithInviteBody, 'authPendingToken' | 'rememberMe' | 'inviteToken'>;
}

/**
 * A base64url public key that a person has checked against its safety number
 * (section 7.2).
 *
 * Every public key the client holds came from the server, and a substituted
 * one looks exactly like a real one. The brand is how the functions that trust
 * a key refuse, at compile time, one taken straight from a response.
 */
export type ConfirmedPublicKey = string & { readonly __confirmedOutOfBand: true };

/**
 * The only way to make a `ConfirmedPublicKey`.
 *
 * Call it from the handler of the user's "the numbers match" action, on the
 * exact key the displayed fingerprint was computed from — never on a key whose
 * fingerprint the server supplied.
 */
export function markPublicKeyConfirmed(pubkey: string): ConfirmedPublicKey {
  return pubkey as ConfirmedPublicKey;
}

/** A handoff envelope and the sender it names, as the sender uploads it. */
export type HandoffWrap = Pick<AddMemberBody, 'wrappedMasterKey' | 'senderPubkey'>;

/** A handoff as the invitee may open it: the sender's key has been confirmed. */
export interface ConfirmedHandoff extends HandoffWrap {
  senderPubkey: ConfirmedPublicKey;
}

/**
 * The KDF columns a `pwd` row carries. `completeHandoff` copies them from the
 * invitee's existing `user_keys` row rather than minting new ones, so the
 * shape is named once for both paths.
 */
interface PasswordRowMetadata {
  kekKind: 'pwd';
  kekSalt: string;
  kekKdfKind: typeof KdfKind.argon2id;
  kekKdfParams: string;
}

/**
 * A `recovery` row's salt is SQL NULL because BIP-39 is deterministic from the
 * phrase, and its parameter block is the empty string rather than null — zero
 * bytes of parameters, which is distinct from "no parameter column".
 */
const RECOVERY_ROW_METADATA = {
  kekKind: 'recovery',
  kekSalt: null,
  kekKdfKind: KdfKind.bip39Hkdf,
  kekKdfParams: '',
} as const;

/** Everything needed to wrap a MasterKey into a member's `pwd` and `recovery` rows. */
interface MemberKeyWrapping {
  kekPwd: Kek;
  kekRecovery: Kek;
  passwordMetadata: PasswordRowMetadata;
}

/**
 * The account half of a signup: identity, keypair, and the private key wrapped
 * both ways. Both kinds of signup need exactly this, and only an ordinary one
 * goes on to mint a household — which is why the KEKs come back as well.
 */
interface AccountMaterial extends MemberKeyWrapping {
  body: InviteSignupMaterial['body'];
  privateKey: PrivateKeyBytes;
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
 * without the other (`parseKeyPair` in `worker/src/lib/key-material.ts`). That
 * is also why the recovery phrase cannot be deferred past this point: the
 * account does not exist until the recovery-wrapped rows do, so the window in
 * which an account is unrecoverable never opens.
 *
 * The phrase arrives as an argument rather than being generated in here for
 * the same reason. It is shown to the user and acknowledged *before* the
 * account is created, so it already exists by the time this runs; minting one
 * here would mean wrapping a phrase nobody had seen.
 */
export async function buildSignupMaterial(
  password: string,
  recoveryPhrase: string,
): Promise<SignupMaterial> {
  const account = await buildAccountMaterial(password, recoveryPhrase);
  const masterKey = await generateMasterKey();

  return {
    body: {
      ...account.body,
      // Client-generated, per the locked conventions in `00_overview.md`.
      household: { id: generateId(), name: DEFAULT_HOUSEHOLD_NAME },
      memberKeys: await wrapMemberKeys(masterKey, account),
    },
    keys: { masterKey, privateKey: account.privateKey },
  };
}

/**
 * Assemble everything `/auth/signup-with-invite` needs.
 *
 * An ordinary signup minus the household: no household block and no member
 * keys, because the invitee is joining a household that exists and has no
 * MasterKey for it yet. That arrives later through the handoff, and
 * `completeHandoff` writes the member rows then.
 */
export async function buildInviteSignupMaterial(
  password: string,
  recoveryPhrase: string,
): Promise<InviteSignupMaterial> {
  const account = await buildAccountMaterial(password, recoveryPhrase);
  return { body: account.body };
}

/**
 * The three derivations run in sequence rather than concurrently. Argon2id
 * holds 64 MiB while it runs, and section 3.4 makes overlapping them the lever
 * to reach for only if login latency ever becomes a complaint — a 128 MiB
 * spike in a phone browser tab is not a cost to pay for a saving nobody has
 * asked for.
 */
async function buildAccountMaterial(
  password: string,
  recoveryPhrase: string,
): Promise<AccountMaterial> {
  const { publicKey, privateKey } = generateKeypair();

  // Independent salts. This is the only domain separation between the verifier
  // and KEK_pwd, and section 3.3 records that it is sufficient.
  const kekSalt = generateSalt();
  const verifierSalt = generateSalt();

  const verifier = await deriveVerifier(password, verifierSalt);
  const kekPwd = await deriveKek(password, kekSalt);
  const kekRecovery = await deriveRecoveryKek(recoveryPhrase);

  const argon2idParams = encodedArgon2idParams();
  const passwordMetadata: PasswordRowMetadata = {
    kekKind: 'pwd',
    kekSalt: bytesToBase64url(kekSalt),
    kekKdfKind: KdfKind.argon2id,
    kekKdfParams: argon2idParams,
  };

  const userKeys: UserKeyRow[] = [
    {
      ...passwordMetadata,
      wrappedPrivKey: bytesToBase64url(await wrapPrivateKey(kekPwd, privateKey)),
    },
    {
      ...RECOVERY_ROW_METADATA,
      wrappedPrivKey: bytesToBase64url(await wrapPrivateKey(kekRecovery, privateKey)),
    },
  ];

  return {
    body: {
      verifierCandidate: bytesToBase64url(verifier),
      verifierSalt: bytesToBase64url(verifierSalt),
      verifierKdfKind: KdfKind.argon2id,
      verifierKdfParams: argon2idParams,
      pubkey: bytesToBase64url(publicKey),
      userKeys,
    },
    privateKey,
    kekPwd,
    kekRecovery,
    passwordMetadata,
  };
}

/**
 * The `pwd` and `recovery` member rows for a MasterKey. Shared by signup, which
 * wraps a MasterKey it has just minted, and the handoff, which wraps one it
 * has just received — the rows have to come out identical either way, or
 * `unlockKeyBundle` opens one kind of member and refuses the other.
 */
async function wrapMemberKeys(
  masterKey: MasterKey,
  wrapping: MemberKeyWrapping,
): Promise<MemberKeyRow[]> {
  return [
    {
      ...wrapping.passwordMetadata,
      wrappedMasterKey: bytesToBase64url(await wrapMasterKey(wrapping.kekPwd, masterKey)),
      senderUserId: null,
      senderPubkey: null,
    },
    {
      ...RECOVERY_ROW_METADATA,
      wrappedMasterKey: bytesToBase64url(await wrapMasterKey(wrapping.kekRecovery, masterKey)),
      senderUserId: null,
      senderPubkey: null,
    },
  ];
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

/**
 * Thrown when the recovery phrase simply did not open the wrapped rows.
 *
 * Its own class rather than a reused `WrongPasswordError`, for the reason that
 * one gives: the screens branch on the type, and a phrase and a password fail
 * for different reasons and need different wording.
 *
 * Covers both ways a phrase can be wrong — one that fails BIP-39's checksum and
 * one that passes it but opens nothing — because the user can do nothing
 * different about either, and this is the last way in. The form can still say
 * something sharper about a mistyped word before it gets here; it just cannot
 * be the only thing that does.
 */
export class WrongPhraseError extends Error {
  constructor() {
    super('That recovery phrase did not unlock your vault.');
    this.name = 'WrongPhraseError';
  }
}

/**
 * Thrown when a handoff envelope will not open for the invitee.
 *
 * Covers the envelope naming a different sender than the one confirmed, a
 * wrap addressed to some other key, and a tampered or malformed blob. The
 * first is the attack section 4.3 exists to stop and the others are
 * indistinguishable from it here, so the message names no cause; in every case
 * the right move is to stop and check with the sender.
 */
export class HandoffRefusedError extends Error {
  constructor() {
    super(
      'This invite could not be opened safely. Check with the person who sent it before trying again.',
    );
    this.name = 'HandoffRefusedError';
  }
}

/** How each kind of wrapping is named to a user, who has never heard of a KEK. */
const KEK_KIND_WORDING: Record<KekKind, string> = {
  pwd: 'password',
  recovery: 'recovery-phrase',
  ecies: 'invite',
};

function requireRow<Row extends { kekKind: KekKind }>(
  rows: Row[],
  kekKind: KekKind,
  description: string,
): Row {
  const row = rows.find((candidate) => candidate.kekKind === kekKind);
  if (!row) {
    throw new KeyBundleError(
      `This account has no ${KEK_KIND_WORDING[kekKind]}-wrapped ${description}`,
    );
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
 * Check a stored `pwd` row names a derivation this version can run, and return
 * its KDF columns non-null. The one place a password row is validated, so every
 * path reports the same fault in the same words.
 */
function readPasswordRowMetadata(row: KekDescriptor): PasswordRowMetadata {
  if (row.kekKdfKind !== KdfKind.argon2id) {
    throw new KeyBundleError('This account uses a key derivation this version cannot read');
  }
  if (!row.kekSalt || !row.kekKdfParams) {
    throw new KeyBundleError('Password key material is missing its salt or parameters');
  }
  return {
    kekKind: 'pwd',
    kekSalt: row.kekSalt,
    kekKdfKind: KdfKind.argon2id,
    kekKdfParams: row.kekKdfParams,
  };
}

/**
 * Derive the password KEK a `pwd` row was wrapped under.
 *
 * The parameters come from the row rather than from `ARGON2ID_PARAMS`, because
 * a row wrapped before a parameter change still has to open — that is what the
 * rolling-upgrade path in section 3.4 depends on. Re-wrapping at the current
 * parameters afterwards is deferred post-v1; this half has to be right now
 * regardless, since getting it wrong means an unopenable vault rather than a
 * missed optimisation.
 */
function derivePasswordKek(password: string, metadata: PasswordRowMetadata): Promise<Kek> {
  return deriveKek(
    password,
    base64urlToBytes(metadata.kekSalt),
    decodeArgon2idParams(base64urlToBytes(metadata.kekKdfParams)),
  );
}

/**
 * Refuse to open two rows with one KEK unless they say they were wrapped under
 * the same one.
 *
 * One derivation opening both rows is an optimisation, not an invariant: it
 * holds only because signup and the handoff write the same metadata to both
 * tables. The worker's rewrap endpoint checks it too
 * (`assertSamePasswordKek`), but the rolling upgrade in section 3.4 is
 * precisely the thing that could re-wrap `user_keys` and not
 * `household_member_keys`.
 *
 * Without this check the divergence surfaces as an AES-GCM tag failure on the
 * second unwrap — indistinguishable from a wrong password, and reported to the
 * user as one. A structural failure wearing a user-error label is the
 * expensive kind, and the check costs a string comparison rather than a second
 * Argon2id pass.
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
  const userKey = requireRow(bundle.userKeys, 'pwd', 'private key');
  const memberKey = requireRow(bundle.memberKeys, 'pwd', 'household key');
  assertSameKek(userKey, memberKey);

  const kek = await derivePasswordKek(password, readPasswordRowMetadata(userKey));

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
 * Refuse to open a recovery row that does not say it was wrapped by BIP-39.
 *
 * The counterpart to `assertSameKek`, and needed for the same reason rather
 * than a different one. There are no salts or parameters to compare here — a
 * recovery row carries a null salt and an empty parameter block by
 * construction — so the only thing that can drift is the KDF kind itself, and
 * a row naming some other KDF will not open under `deriveRecoveryKek`.
 *
 * Unguarded, that reaches the user as "wrong recovery phrase" against a
 * perfectly correct phrase, which is the worst sentence this flow could say:
 * it is the last way in, and someone told their phrase is wrong will conclude
 * their data is gone.
 */
function assertBip39Kdf(row: { kekKdfKind: number | null }, description: string): void {
  if (row.kekKdfKind !== KdfKind.bip39Hkdf) {
    throw new KeyBundleError(
      `Your ${description} was wrapped by a recovery method this version cannot read`,
    );
  }
}

/**
 * Open a key bundle with the twelve-word recovery phrase.
 *
 * The mirror of `unlockKeyBundle`, and deliberately its own function rather
 * than a mode flag on that one: they select different rows, derive under
 * different KDFs, and fail with different words. The only thing they share is
 * the unwrap at the bottom, which is two lines.
 *
 * There is no Argon2id here. `deriveRecoveryKek` is BIP-39 plus HKDF and is
 * deterministic from the phrase alone, which is why a recovery row needs no
 * stored salt — and why this is fast where a password unlock is not.
 */
export async function unlockKeyBundleWithPhrase(
  phrase: string,
  bundle: KeyBundle,
): Promise<SessionKeys> {
  // Checked here and not only in the form. `deriveRecoveryKek` rejects a failed
  // checksum with a bare `Error`, which is neither of the two types the screens
  // branch on, so an unguarded mistyped word would reach the user as whatever
  // the generic handler says — on the one screen where that is worst.
  if (!isValidRecoveryPhrase(phrase)) {
    throw new WrongPhraseError();
  }

  const userKey = requireRow(bundle.userKeys, 'recovery', 'private key');
  const memberKey = requireRow(bundle.memberKeys, 'recovery', 'household key');
  assertBip39Kdf(userKey, 'private key');
  assertBip39Kdf(memberKey, 'household key');

  const kek = await deriveRecoveryKek(phrase);

  try {
    const privateKey = await unwrapPrivateKey(kek, base64urlToBytes(userKey.wrappedPrivKey));
    const masterKey = await unwrapMasterKey(kek, base64urlToBytes(memberKey.wrappedMasterKey));
    return { masterKey, privateKey };
  } catch (err) {
    if (isWrongKey(err)) {
      throw new WrongPhraseError();
    }
    throw err;
  }
}

/**
 * Re-wrap recovered keys under a new password, for `/auth/recovery-reset`.
 *
 * Takes the keys rather than deriving them, because the caller has just
 * unwrapped them with the phrase and they are the same MasterKey and private
 * key throughout — a password reset changes how the keys are locked up, never
 * what they are. Re-minting either would orphan the vault.
 *
 * Fresh salts on both the KEK and the verifier, for the same reason a signup
 * generates independent ones: they are the only domain separation between the
 * two derivations (section 3.3). Reusing the old KEK salt would also leave the
 * old wrapped rows openable by anyone who had captured them alongside a
 * cracked old password.
 *
 * Only `pwd` rows are built. The recovery rows stay exactly as they were, so
 * the phrase the user has just proved they hold keeps working afterwards — the
 * server will not overwrite them even if asked.
 */
export async function buildPasswordResetMaterial(
  newPassword: string,
  keys: SessionKeys,
): Promise<RecoveryResetBody> {
  const kekSalt = generateSalt();
  const verifierSalt = generateSalt();

  // Sequential, not concurrent, as in `buildAccountMaterial`.
  const verifier = await deriveVerifier(newPassword, verifierSalt);
  const kekPwd = await deriveKek(newPassword, kekSalt);

  const argon2idParams = encodedArgon2idParams();
  const metadata = {
    kekSalt: bytesToBase64url(kekSalt),
    kekKdfKind: KdfKind.argon2id,
    kekKdfParams: argon2idParams,
  };

  return {
    newVerifier: {
      verifierCandidate: bytesToBase64url(verifier),
      verifierSalt: bytesToBase64url(verifierSalt),
      verifierKdfKind: KdfKind.argon2id,
      verifierKdfParams: argon2idParams,
    },
    newUserKeyPwd: {
      ...metadata,
      wrappedPrivKey: bytesToBase64url(await wrapPrivateKey(kekPwd, keys.privateKey)),
    },
    newMemberKeyPwd: {
      ...metadata,
      wrappedMasterKey: bytesToBase64url(await wrapMasterKey(kekPwd, keys.masterKey)),
    },
  };
}

/**
 * Wrap the household MasterKey for an invitee, for
 * `POST /households/:householdId/members`.
 *
 * `inviteePubkey` is branded because nothing in here can tell a real key from
 * one the server substituted — that check belongs to the person reading the
 * safety number, before this runs.
 */
export async function buildHandoffWrap(
  keys: SessionKeys,
  inviteePubkey: ConfirmedPublicKey,
): Promise<HandoffWrap> {
  const wrapped = await wrapForRecipient(
    keys.privateKey,
    base64urlToBytes(inviteePubkey),
    keys.masterKey,
  );
  return {
    wrappedMasterKey: bytesToBase64url(wrapped),
    senderPubkey: bytesToBase64url(derivePublicKey(keys.privateKey)),
  };
}

/**
 * The invitee's side of the handoff: prove both credentials, open the
 * envelope, and rewrap under their own keys, for
 * `POST /households/:householdId/members/:userId/rewrap`.
 *
 * The recovery phrase is asked for again because nothing kept it since signup;
 * `docs/auth-rewrite/07_invite_flow.md` records why.
 *
 * **Both credentials are proven before anything is wrapped.** A mistyped
 * phrase that passes the BIP-39 checksum derives a perfectly good KEK, just
 * not this account's, and a recovery row wrapped under it would never open —
 * discovered only on the day the phrase is needed.
 *
 * The `pwd` member row reuses the `pwd` user row's salt and parameters, so
 * `assertSameKek` holds on every later sign-in.
 *
 * Use the returned `keys` only once the rewrap upload has succeeded. Until it
 * does, the server has no `pwd` member row, and a session unlocked early would
 * find the next sign-in unable to open anything.
 */
export async function completeHandoff(
  credentials: { password: string; recoveryPhrase: string },
  bundle: KeyBundle,
  handoff: ConfirmedHandoff,
): Promise<{ body: RewrapBody; keys: SessionKeys }> {
  // See `unlockKeyBundleWithPhrase` for why the checksum is checked here.
  if (!isValidRecoveryPhrase(credentials.recoveryPhrase)) {
    throw new WrongPhraseError();
  }

  const passwordRow = requireRow(bundle.userKeys, 'pwd', 'private key');
  const recoveryRow = requireRow(bundle.userKeys, 'recovery', 'private key');
  assertBip39Kdf(recoveryRow, 'private key');
  const passwordMetadata = readPasswordRowMetadata(passwordRow);

  // The phrase first: proving it costs no Argon2id, so a wrong one fails fast.
  // The private key it opens is discarded — the password yields the same one.
  const kekRecovery = await deriveRecoveryKek(credentials.recoveryPhrase);
  try {
    await unwrapPrivateKey(kekRecovery, base64urlToBytes(recoveryRow.wrappedPrivKey));
  } catch (err) {
    if (isWrongKey(err)) {
      throw new WrongPhraseError();
    }
    throw err;
  }

  const kekPwd = await derivePasswordKek(credentials.password, passwordMetadata);
  let privateKey: PrivateKeyBytes;
  try {
    privateKey = await unwrapPrivateKey(kekPwd, base64urlToBytes(passwordRow.wrappedPrivKey));
  } catch (err) {
    if (isWrongKey(err)) {
      throw new WrongPasswordError();
    }
    throw err;
  }

  let masterKey: MasterKey;
  try {
    masterKey = await unwrapFromSender(
      privateKey,
      base64urlToBytes(handoff.senderPubkey),
      base64urlToBytes(handoff.wrappedMasterKey),
    );
  } catch (err) {
    if (err instanceof EnvelopeFormatError || isWrongKey(err)) {
      throw new HandoffRefusedError();
    }
    throw err;
  }

  return {
    body: {
      memberKeys: await wrapMemberKeys(masterKey, { kekPwd, kekRecovery, passwordMetadata }),
    },
    keys: { masterKey, privateKey },
  };
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
