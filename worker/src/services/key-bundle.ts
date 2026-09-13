/** The wrapped material a client needs to unlock locally.
 *
 *  Every blob in here is opaque to the server: it hands over the locked boxes and the
 *  instructions for which KDF opens them, and the unwrapping happens client-side.
 */

import { blobToBase64url } from '../lib/bytes.js';
import * as householdService from './households.js';
import { listUserKeys } from './users.js';
import type { MemberKeyRow } from './households.js';
import type { UserKeyRow } from './users.js';
import type { Household } from '../types.js';

export interface KeyBundle {
  user: {
    id: string;
    pubkey: string | null;
    verifierSalt: string | null;
    verifierKdfKind: number | null;
    verifierKdfParams: string | null;
  };
  userKeys: UserKeyRow[];
  /** Null for a user who has signed up against an invite but whose handoff has not
   *  completed — they are a real account with no household yet. */
  household: Household | null;
  /** Zero to three rows: the pwd and recovery pair once provisioned, or a single
   *  transient 'ecies' row while a handoff is waiting to be rewrapped. */
  memberKeys: MemberKeyRow[];
}

export async function build(db: D1Database, userId: string): Promise<KeyBundle> {
  const row = await db
    .prepare(
      'SELECT pubkey, verifier_salt, verifier_kdf_kind, verifier_kdf_params FROM users WHERE id = ?',
    )
    .bind(userId)
    .first<{
      pubkey: unknown;
      verifier_salt: unknown;
      verifier_kdf_kind: number | null;
      verifier_kdf_params: unknown;
    }>();

  const [userKeys, household, memberKeys] = await Promise.all([
    listUserKeys(db, userId),
    householdService.findForUser(db, userId),
    householdService.listMemberKeys(db, userId),
  ]);

  return {
    user: {
      id: userId,
      pubkey: blobToBase64url(row?.pubkey),
      verifierSalt: blobToBase64url(row?.verifier_salt),
      verifierKdfKind: row?.verifier_kdf_kind ?? null,
      verifierKdfParams: blobToBase64url(row?.verifier_kdf_params),
    },
    userKeys,
    household,
    memberKeys,
  };
}
