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

/**
 * The vault is module state rather than React state, so anything rendering
 * from it has to be told when it changes. Subscription lives here rather than
 * in `use-sync.ts` for one reason: here, every mutation below notifies, and a
 * future caller cannot unlock the vault and leave the UI showing it locked.
 */
const listeners = new Set<() => void>();

export function subscribeToVaultState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyVaultStateChanged(): void {
  listeners.forEach((listener) => listener());
}

/** Adopt the key material a signup or an unlock just produced. */
export function unlockKeyVault(keys: { masterKey: MasterKey; privateKey: PrivateKeyBytes }): void {
  masterKey = keys.masterKey;
  privateKey = keys.privateKey;
  notifyVaultStateChanged();
}

export function getMasterKey(): MasterKey | null {
  return masterKey;
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
 * Locking the vault does not touch the server session. Q6 makes the JWT and
 * the MasterKey independent *lifetimes*: a session expiring does not lock the
 * vault, and locking does not end the session.
 *
 * The converse does not follow, and that is the half worth stating rather than
 * leaving a reader to infer. An explicit logout *does* lock the vault —
 * `clearLocalSyncState` in `use-auth.ts` calls this — because the MasterKey
 * exists only to encrypt the vault for sync, and IndexedDB on this device is
 * plaintext either way. Once the session is over the key can do nothing at
 * all, so keeping it is liability with no purpose left to serve. A lifetime
 * running out on its own and a user pressing Log out are not the same event.
 */
export function lockKeyVault(): void {
  if (privateKey) {
    privateKey.fill(0);
  }
  privateKey = null;
  masterKey = null;
  notifyVaultStateChanged();
}
