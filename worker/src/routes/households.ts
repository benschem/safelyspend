import { Hono } from 'hono';
import { authMiddleware, requireFullSession } from '../middleware/auth.js';
import { rateLimit, userRateLimit } from '../middleware/rate-limit.js';
import { badRequest, coded, forbidden, notFound } from '../lib/errors.js';
import { constantTimeEquals } from '../lib/bytes.js';
import { assertHandoffEnvelope, decodeRequired, parseKeyPair } from '../lib/key-material.js';
import { getPubkey } from '../services/users.js';
import * as householdService from '../services/households.js';
import * as inviteService from '../services/invites.js';
import { parseJsonBody } from './helpers.js';
import type { HonoEnv } from '../types.js';

const BODY_BYTES = 16 * 1024;

const addMemberRateLimit = rateLimit({ max: 10, windowSeconds: 3600, keyPrefix: 'households:add' });
const rewrapRateLimit = rateLimit({ max: 10, windowSeconds: 3600, keyPrefix: 'households:rewrap' });

const addMemberUserLimit = userRateLimit({ max: 5, windowSeconds: 3600, keyPrefix: 'households:add' });
const rewrapUserLimit = userRateLimit({ max: 3, windowSeconds: 3600, keyPrefix: 'households:rewrap' });

const households = new Hono<HonoEnv>();

households.use('*', authMiddleware, requireFullSession);

// POST /households/:householdId/members — complete the handoff from the sender's side
//
// Called after the sender has compared the invitee's safety number with them out of
// band. The membership row and the wrapped key land together: a membership without a
// key would give the invitee vault bytes they cannot read, and a key without a
// membership would leave them unable to fetch the vault at all.
households.post('/:householdId/members', addMemberRateLimit, addMemberUserLimit, async (c) => {
  const user = c.get('user');
  const householdId = c.req.param('householdId');

  if (c.get('householdId') !== householdId) {
    throw forbidden('This is not your household');
  }

  const body = await parseJsonBody<Record<string, unknown>>(c, BODY_BYTES);

  const inviteId = body['inviteId'];
  const inviteeUserId = body['inviteeUserId'];
  if (typeof inviteId !== 'string' || typeof inviteeUserId !== 'string') {
    throw badRequest('inviteId and inviteeUserId are required');
  }

  const wrappedMasterKey = decodeRequired(body['wrappedMasterKey']);
  assertHandoffEnvelope(wrappedMasterKey);

  const senderPubkey = decodeRequired(body['senderPubkey']);

  // Belt and braces against a server that hands the sender a substituted key to wrap
  // for: the primary defence is the out-of-band safety number in the sender's own UI.
  const storedPubkey = await getPubkey(c.env.DB, user.id);
  if (!storedPubkey || !constantTimeEquals(storedPubkey, senderPubkey)) {
    throw coded('Sender public key does not match this account', 400, 'INVALID_BLOB');
  }

  const invite = await inviteService.findById(c.env.DB, inviteId);
  if (!invite) {
    throw coded('Invite not found', 404, 'INVITE_NOT_FOUND');
  }
  if (invite.senderUserId !== user.id || invite.householdId !== householdId) {
    throw forbidden('This is not your invite');
  }
  if (invite.recipientUserId !== inviteeUserId) {
    throw coded('Invite is not addressed to that user', 409, 'INVITE_INVALID_STATE');
  }

  // The replay check comes before the state check. A retried request finds the invite
  // already 'completed' by its own first attempt, so validating state first would
  // report a successful retry as an invalid state rather than as the no-op it is.
  const alreadyMember = await householdService.isMember(c.env.DB, householdId, inviteeUserId);
  if (alreadyMember) {
    const hasEcies = await householdService.hasMemberKey(
      c.env.DB,
      householdId,
      inviteeUserId,
      'ecies',
    );
    if (hasEcies) {
      return c.json({ ok: true, member: { userId: inviteeUserId, role: 'member' } });
    }
    // Membership without a handoff row means the invitee already rewrapped. Replaying
    // the wrap now would resurrect a transient row they have finished with.
    throw coded('Membership exists without a pending handoff', 409, 'HOUSEHOLD_ROW_RACE');
  }

  if (invite.status !== 'accepted_pending_handoff' && invite.status !== 'open') {
    throw coded('Invite is not awaiting a handoff', 409, 'INVITE_INVALID_STATE');
  }

  const memberCount = await householdService.countMembers(c.env.DB, householdId);
  if (memberCount >= householdService.MAX_HOUSEHOLD_MEMBERS) {
    throw coded('This household is already full', 409, 'HOUSEHOLD_FULL');
  }

  const now = new Date().toISOString();

  try {
    await c.env.DB.batch([
      householdService.addMemberStatement(c.env.DB, householdId, inviteeUserId, 'member', now),
      householdService.insertEciesMemberKeyStatement(
        c.env.DB,
        householdId,
        inviteeUserId,
        wrappedMasterKey,
        user.id,
        senderPubkey,
        now,
      ),
      inviteService.completeInviteStatement(c.env.DB, inviteId, user.id, now),
    ]);
  } catch (err) {
    // UNIQUE(household_members.user_id) is Q5's enforcement: the invitee joined some
    // household between the check above and this write.
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw coded('That person is already part of a household', 409, 'HOUSEHOLD_FULL');
    }
    throw err;
  }

  console.info(JSON.stringify({
    event: 'household_member_added',
    requestId: c.get('requestId'),
    userId: user.id,
    householdId,
    inviteeUserId,
  }));

  return c.json({
    ok: true,
    member: { userId: inviteeUserId, role: 'member', joinedAt: now },
  });
});

// POST /households/:householdId/members/:userId/rewrap — complete it from the invitee's side
//
// The invitee has unwrapped the handoff envelope with their private key and re-wrapped
// the MasterKey under their own password and recovery KEKs. The transient handoff row
// goes in the same batch, so the household ends up with exactly the two durable rows.
households.post('/:householdId/members/:userId/rewrap', rewrapRateLimit, rewrapUserLimit, async (c) => {
  const user = c.get('user');
  const householdId = c.req.param('householdId');
  const targetUserId = c.req.param('userId');

  if (targetUserId !== user.id) {
    throw coded('You can only rewrap your own keys', 403, 'NOT_OWN_KEYS');
  }

  const household = await householdService.findById(c.env.DB, householdId);
  if (!household) {
    throw notFound('Household not found');
  }

  const body = await parseJsonBody<Record<string, unknown>>(c, BODY_BYTES);
  const memberKeys = parseKeyPair(body['memberKeys'], 'wrappedMasterKey');

  const hasEcies = await householdService.hasMemberKey(c.env.DB, householdId, user.id, 'ecies');
  if (!hasEcies) {
    throw coded('There is no pending handoff to complete', 409, 'NO_PENDING_HANDOFF');
  }

  const now = new Date().toISOString();

  await c.env.DB.batch([
    householdService.upsertMemberKeyStatement(c.env.DB, householdId, user.id, memberKeys.pwd, now),
    householdService.upsertMemberKeyStatement(c.env.DB, householdId, user.id, memberKeys.recovery, now),
    householdService.deleteEciesMemberKeyStatement(c.env.DB, householdId, user.id),
  ]);

  console.info(JSON.stringify({
    event: 'member_keys_rewrapped',
    requestId: c.get('requestId'),
    userId: user.id,
    householdId,
  }));

  return c.json({ ok: true });
});

export default households;
