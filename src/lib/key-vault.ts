/**
 * In-memory holder for the key material a cloud session needs.
 *
 * Lifetime is tab-close or explicit lock (overview Q6), deliberately
 * independent of the 7-day JWT. Nothing here is persisted: no
 * `sessionStorage`, no IndexedDB, no cookie. Re-opening a tab against a live
 * session re-derives KEK_pwd and unwraps again — one Argon2id, ~216 ms on the
 * slowest device measured.
 *
 * The vault holds PrivKey as well as MasterKey. Section 7's login sweep has to
 * unwrap an envelope C handoff, which needs the long-term private key in
 * memory; a holder carrying only MasterKey would block that flow.
 *
 * ## On `lockKeyVault()` and zeroisation
 *
 * `lockKeyVault()` overwrites the private key bytes before dropping the reference.
 * That much is real: it is a `Uint8Array` we own.
 *
 * It is not a guarantee. The MasterKey is a `CryptoKey`, which is opaque — we
 * can drop our reference and nothing more. The engine may also have copied
 * either value during a GC cycle, and we cannot reach those copies. So this is
 * best-effort: it shortens the window in which the material sits in a heap
 * snapshot, and it does not make a compromised-while-unlocked browser safe.
 * The threat model (section 1) already says that case is out of scope.
 */

import type { MasterKey, PrivateKeyBytes } from './types';

let masterKey: MasterKey | null = null;
let privateKey: PrivateKeyBytes | null = null;

export function setMasterKey(key: MasterKey): void {
  masterKey = key;
}

export function getMasterKey(): MasterKey | null {
  return masterKey;
}

export function setPrivateKey(key: PrivateKeyBytes): void {
  privateKey = key;
}

export function getPrivateKey(): PrivateKeyBytes | null {
  return privateKey;
}

/** True once a session has unlocked — what the UI gates the sync controls on. */
export function isVaultUnlocked(): boolean {
  return masterKey !== null;
}

/**
 * Drop all held key material. Called on logout and on an explicit lock.
 *
 * Named for the vault rather than for the module's own state, because every
 * caller imports it bare: `clear()` at a call site says nothing about what is
 * being cleared.
 *
 * Locking the vault does not touch the server session, and logging out does
 * not lock the vault — Q6 makes the two independent in both directions.
 */
export function lockKeyVault(): void {
  if (privateKey) {
    privateKey.fill(0);
  }
  privateKey = null;
  masterKey = null;
}
