import { generateId } from '../lib/id.js';
import { blobToBase64url, blobToBytes, bytesToBase64url, randomToken } from '../lib/bytes.js';
import { pubkeyFingerprint } from '../lib/crypto.js';
import { coded, internal, notFound } from '../lib/errors.js';

export const INVITE_STATUSES = [
  'open',
  'accepted_pending_handoff',
  'completed',
  'expired',
  'revoked',
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const MIN_EXPIRES_IN_DAYS = 1;
export const MAX_EXPIRES_IN_DAYS = 7;
export const DEFAULT_EXPIRES_IN_DAYS = 3;

export interface Invite {
  id: string;
  token: string;
  senderUserId: string;
  householdId: string;
  recipientEmail: string;
  recipientUserId: string | null;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

interface InviteRow {
  id: string;
  token: string;
  sender_user_id: string;
  household_id: string;
  recipient_email: string;
  recipient_user_id: string | null;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
}

const INVITE_COLUMNS = `id, token, sender_user_id, household_id, recipient_email,
                        recipient_user_id, status, expires_at, created_at`;

function toInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    token: row.token,
    senderUserId: row.sender_user_id,
    householdId: row.household_id,
    recipientEmail: row.recipient_email,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function findById(db: D1Database, inviteId: string): Promise<Invite | null> {
  const row = await db
    .prepare(`SELECT ${INVITE_COLUMNS} FROM invites WHERE id = ?`)
    .bind(inviteId)
    .first<InviteRow>();

  return row ? toInvite(row) : null;
}

export async function findByToken(db: D1Database, token: string): Promise<Invite | null> {
  const row = await db
    .prepare(`SELECT ${INVITE_COLUMNS} FROM invites WHERE token = ?`)
    .bind(token)
    .first<InviteRow>();

  return row ? toInvite(row) : null;
}

export async function findOpenForPair(
  db: D1Database,
  senderUserId: string,
  recipientEmail: string,
): Promise<Invite | null> {
  const row = await db
    .prepare(
      `SELECT ${INVITE_COLUMNS} FROM invites
       WHERE sender_user_id = ? AND recipient_email = ? AND status = 'open'
         AND expires_at > ?`,
    )
    .bind(senderUserId, recipientEmail, new Date().toISOString())
    .first<InviteRow>();

  return row ? toInvite(row) : null;
}

/** Open invites addressed to an email, used by the signup sweep (crypto-design
 *  section 7.4 path 2) so a user who signs up from the landing page still sees the
 *  invite waiting for them. */
export async function findOpenForEmail(db: D1Database, email: string): Promise<Invite[]> {
  const { results } = await db
    .prepare(
      `SELECT ${INVITE_COLUMNS} FROM invites
       WHERE recipient_email = ? AND status = 'open' AND expires_at > ?`,
    )
    .bind(email, new Date().toISOString())
    .all<InviteRow>();

  return results.map(toInvite);
}

export async function create(
  db: D1Database,
  senderUserId: string,
  householdId: string,
  recipientEmail: string,
  expiresInDays: number,
): Promise<Invite> {
  const id = generateId();
  const token = randomToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO invites
         (id, token, sender_user_id, household_id, recipient_email, recipient_user_id,
          status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'open', ?, ?, ?)`,
    )
    .bind(id, token, senderUserId, householdId, recipientEmail, expiresAt, now, now)
    .run();

  return {
    id,
    token,
    senderUserId,
    householdId,
    recipientEmail,
    recipientUserId: null,
    status: 'open',
    expiresAt,
    createdAt: now,
  };
}

export async function deleteById(db: D1Database, inviteId: string): Promise<void> {
  await db.prepare('DELETE FROM invites WHERE id = ?').bind(inviteId).run();
}

/** Claim an open invite for the recipient. The guards live in the WHERE clause so the
 *  statement can sit inside the signup batch: if it matches nothing the whole batch
 *  rolls back, and the handler then reads the invite to say which guard failed. */
export function acceptInviteStatement(
  db: D1Database,
  token: string,
  recipientUserId: string,
  recipientEmail: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE invites
       SET recipient_user_id = ?, status = 'accepted_pending_handoff', updated_at = ?
       WHERE token = ? AND status = 'open' AND expires_at > ? AND recipient_email = ?`,
    )
    .bind(recipientUserId, now, token, now, recipientEmail);
}

/** Pre-flight an invite before any write. The same conditions are re-checked in the
 *  claiming UPDATE's WHERE clause, which is what actually decides a race; this exists
 *  to give the caller a specific error rather than a bare "no". */
export function assertAcceptable(
  invite: Invite | null,
  recipientEmail: string,
): asserts invite is Invite {
  if (!invite) {
    throw coded('Invite not found', 404, 'INVALID_INVITE');
  }
  if (invite.recipientEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
    throw coded('This invite was sent to a different address', 403, 'EMAIL_MISMATCH');
  }
  // Expiry is checked before status. The background sweep on /auth/login rewrites a
  // lapsed invite's status to 'expired', so checking status first would report a
  // timed-out invite as "already used" — the wrong thing to tell the recipient, and
  // the wrong code for the client to branch on.
  if (invite.status === 'expired' || new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw coded('Invite has expired', 410, 'INVITE_EXPIRED');
  }
  if (invite.status !== 'open') {
    throw coded('Invite has already been used', 409, 'INVITE_ALREADY_ACCEPTED');
  }
}

/** Claim an open invite for a recipient. If the guarded UPDATE matches nothing, re-read
 *  to say which condition lost — safe to disambiguate because the caller is already
 *  authenticated and the invite is addressed to them. */
export async function claim(
  db: D1Database,
  token: string,
  recipientUserId: string,
  recipientEmail: string,
): Promise<Invite> {
  const now = new Date().toISOString();
  const result = await acceptInviteStatement(db, token, recipientUserId, recipientEmail, now).run();

  if ((result.meta.changes ?? 0) === 0) {
    assertAcceptable(await findByToken(db, token), recipientEmail);
    // assertAcceptable throws for every state that can lose the guard. Reaching here
    // means the row changed again between the UPDATE and the re-read.
    throw coded('Invite could not be accepted', 409, 'INVITE_ALREADY_ACCEPTED');
  }

  const claimed = await findByToken(db, token);
  if (!claimed) {
    throw internal('Invite disappeared while being accepted');
  }
  return claimed;
}

/** What the invitee's "waiting for partner" screen needs: who sent it, and the
 *  sender's public key, so the safety number can be compared out of band before the
 *  invitee's client unwraps anything. */
export async function describeForRecipient(
  db: D1Database,
  inviteId: string,
): Promise<{ id: string; status: InviteStatus; senderEmail: string; senderPubkey: string | null }> {
  const row = await db
    .prepare(
      `SELECT i.id, i.status, u.email AS sender_email, u.pubkey
       FROM invites i JOIN users u ON u.id = i.sender_user_id
       WHERE i.id = ?`,
    )
    .bind(inviteId)
    .first<{ id: string; status: InviteStatus; sender_email: string; pubkey: unknown }>();

  if (!row) {
    throw notFound('Invite not found');
  }

  return {
    id: row.id,
    status: row.status,
    senderEmail: row.sender_email,
    senderPubkey: blobToBase64url(row.pubkey),
  };
}

export function completeInviteStatement(
  db: D1Database,
  inviteId: string,
  senderUserId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      "UPDATE invites SET status = 'completed', updated_at = ? WHERE id = ? AND sender_user_id = ?",
    )
    .bind(now, inviteId, senderUserId);
}

/** Revoking also clears recipient_user_id so the invitee's app can show that the
 *  invite was withdrawn rather than silently continuing to poll. */
export async function revoke(db: D1Database, inviteId: string): Promise<void> {
  await db
    .prepare(
      "UPDATE invites SET status = 'revoked', recipient_user_id = NULL, updated_at = ? WHERE id = ?",
    )
    .bind(new Date().toISOString(), inviteId)
    .run();
}

/** Expire only invites nobody ever acted on. An invite that reached
 *  accepted_pending_handoff is deliberately left alone past its expiry: no membership
 *  row exists yet, so nothing leaks, and the sender is shown a banner instead
 *  (crypto-design section 7.3). */
export async function expireStale(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE invites SET status = 'expired' WHERE status = 'open' AND expires_at < ?")
    .bind(new Date().toISOString())
    .run();
}

export interface SentInvite {
  id: string;
  recipientEmail: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ReceivedInvite {
  id: string;
  senderEmail: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

export async function listSent(db: D1Database, userId: string): Promise<SentInvite[]> {
  const { results } = await db
    .prepare(
      `SELECT id, recipient_email, status, expires_at, created_at
       FROM invites WHERE sender_user_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<{
      id: string;
      recipient_email: string;
      status: InviteStatus;
      expires_at: string;
      created_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    recipientEmail: row.recipient_email,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function listReceived(db: D1Database, userId: string): Promise<ReceivedInvite[]> {
  const { results } = await db
    .prepare(
      `SELECT i.id, u.email AS sender_email, i.status, i.expires_at, i.created_at
       FROM invites i JOIN users u ON u.id = i.sender_user_id
       WHERE i.recipient_user_id = ? ORDER BY i.created_at DESC`,
    )
    .bind(userId)
    .all<{
      id: string;
      sender_email: string;
      status: InviteStatus;
      expires_at: string;
      created_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    senderEmail: row.sender_email,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export interface PendingHandoff {
  inviteId: string;
  inviteeUserId: string;
  inviteePubkey: string;
  inviteePubkeyFingerprint: string;
  recipientEmail: string;
  householdId: string;
}

/** What the inviting member sweeps on every cloud login: invitees who have signed up
 *  and are waiting for their MasterKey to be wrapped for them. */
export async function listPendingHandoffs(
  db: D1Database,
  senderUserId: string,
): Promise<PendingHandoff[]> {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.recipient_user_id, i.recipient_email, i.household_id, u.pubkey
       FROM invites i JOIN users u ON u.id = i.recipient_user_id
       WHERE i.sender_user_id = ? AND i.status = 'accepted_pending_handoff'`,
    )
    .bind(senderUserId)
    .all<{
      id: string;
      recipient_user_id: string;
      recipient_email: string;
      household_id: string;
      pubkey: unknown;
    }>();

  const handoffs: PendingHandoff[] = [];
  for (const row of results) {
    const pubkey = blobToBytes(row.pubkey);
    if (!pubkey) {
      // An invitee without a pubkey has not finished signup, so there is nothing to
      // wrap for them yet. Skipping keeps a half-finished signup out of the sweep.
      continue;
    }
    handoffs.push({
      inviteId: row.id,
      inviteeUserId: row.recipient_user_id,
      inviteePubkey: bytesToBase64url(pubkey),
      inviteePubkeyFingerprint: await pubkeyFingerprint(pubkey),
      recipientEmail: row.recipient_email,
      householdId: row.household_id,
    });
  }
  return handoffs;
}
