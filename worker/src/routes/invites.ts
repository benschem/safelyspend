import { Hono } from 'hono';
import { authMiddleware, requireFullSession, requireHousehold } from '../middleware/auth.js';
import { rateLimit, userRateLimit } from '../middleware/rate-limit.js';
import { badRequest, coded, forbidden, notFound } from '../lib/errors.js';
import * as householdService from '../services/households.js';
import * as inviteService from '../services/invites.js';
import { sendInvite } from '../services/email.js';
import { householdIdOrThrow, parseJsonBody } from './helpers.js';
import type { HonoEnv } from '../types.js';

const BODY_BYTES = 1024;

const issueRateLimit = rateLimit({ max: 20, windowSeconds: 3600, keyPrefix: 'invites:issue' });
const listRateLimit = rateLimit({ max: 60, windowSeconds: 60, keyPrefix: 'invites:list' });
const acceptRateLimit = rateLimit({ max: 10, windowSeconds: 3600, keyPrefix: 'invites:accept' });
const revokeRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'invites:revoke' });

const issueUserLimit = userRateLimit({ max: 5, windowSeconds: 3600, keyPrefix: 'invites:issue' });
const listUserLimit = userRateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'invites:list' });
const acceptUserLimit = userRateLimit({ max: 3, windowSeconds: 3600, keyPrefix: 'invites:accept' });
const revokeUserLimit = userRateLimit({ max: 10, windowSeconds: 3600, keyPrefix: 'invites:revoke' });

const invites = new Hono<HonoEnv>();

invites.use('*', authMiddleware, requireFullSession);

// POST /invites — issue an invite
//
// The email is sent before the row is considered good: if Resend fails, the invite is
// deleted again, because an invite nobody received is worse than no invite at all —
// it occupies the one-open-invite-per-pair slot while being unusable.
// requireHousehold sits ahead of the per-user limit so that a user who has no
// household to invite from is told so, rather than spending their hourly budget on it.
invites.post('/', issueRateLimit, requireHousehold, issueUserLimit, async (c) => {
  const user = c.get('user');
  const householdId = householdIdOrThrow(c);

  const body = await parseJsonBody<{ recipientEmail?: string; expiresInDays?: number }>(
    c,
    BODY_BYTES,
  );

  if (!body.recipientEmail || typeof body.recipientEmail !== 'string') {
    throw badRequest('Recipient email is required');
  }
  const recipientEmail = body.recipientEmail.toLowerCase().trim();

  if (recipientEmail === user.email.toLowerCase()) {
    throw badRequest('You cannot invite yourself');
  }

  const expiresInDays = body.expiresInDays ?? inviteService.DEFAULT_EXPIRES_IN_DAYS;
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < inviteService.MIN_EXPIRES_IN_DAYS ||
    expiresInDays > inviteService.MAX_EXPIRES_IN_DAYS
  ) {
    throw badRequest(
      `expiresInDays must be between ${inviteService.MIN_EXPIRES_IN_DAYS} and ${inviteService.MAX_EXPIRES_IN_DAYS}`,
    );
  }

  const memberCount = await householdService.countMembers(c.env.DB, householdId);
  if (memberCount >= householdService.MAX_HOUSEHOLD_MEMBERS) {
    throw coded('This household is already full', 409, 'HOUSEHOLD_FULL');
  }

  const existing = await inviteService.findOpenForPair(c.env.DB, user.id, recipientEmail);
  if (existing) {
    throw coded('An invite to this address is already pending', 409, 'INVITE_ALREADY_PENDING', {
      inviteId: existing.id,
    });
  }

  const invite = await inviteService.create(
    c.env.DB,
    user.id,
    householdId,
    recipientEmail,
    expiresInDays,
  );

  try {
    await sendInvite(
      c.env.RESEND_API_KEY,
      c.env.FROM_EMAIL,
      recipientEmail,
      user.email,
      c.env.APP_URL,
      invite.token,
    );
  } catch (err) {
    await inviteService.deleteById(c.env.DB, invite.id);
    console.error(JSON.stringify({
      event: 'invite_email_failed',
      requestId: c.get('requestId'),
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
    throw coded('Unable to send the invitation. Please try again later.', 500, 'INTERNAL_ERROR');
  }

  console.info(JSON.stringify({
    event: 'invite_issued', requestId: c.get('requestId'), userId: user.id, inviteId: invite.id,
  }));

  return c.json(
    {
      invite: {
        id: invite.id,
        recipientEmail: invite.recipientEmail,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    },
    201,
  );
});

// GET /invites — invites this user sent or received
//
// The token is never returned: it is emailed to the recipient and nothing in either
// user interface needs it.
invites.get('/', listRateLimit, listUserLimit, async (c) => {
  const user = c.get('user');

  const [sent, received] = await Promise.all([
    inviteService.listSent(c.env.DB, user.id),
    inviteService.listReceived(c.env.DB, user.id),
  ]);

  return c.json({ sent, received });
});

// POST /invites/:token/accept — accept as an existing account
//
// Attaches the invite to this account but creates no membership: the invitee has no
// MasterKey for that household yet, and a membership row without one would hand them
// vault bytes they cannot decrypt.
invites.post('/:token/accept', acceptRateLimit, acceptUserLimit, async (c) => {
  const user = c.get('user');
  const token = c.req.param('token');

  // Q5: one household per user, so someone who already has one cannot join another.
  if (c.get('householdId')) {
    throw coded('You are already part of a household', 409, 'HOUSEHOLD_FULL');
  }

  const invite = await inviteService.findByToken(c.env.DB, token);
  inviteService.assertAcceptable(invite, user.email);

  const claimed = await inviteService.claim(c.env.DB, token, user.id, user.email);

  console.info(JSON.stringify({
    event: 'invite_accepted', requestId: c.get('requestId'), userId: user.id, inviteId: claimed.id,
  }));

  return c.json({
    household: null,
    invite: await inviteService.describeForRecipient(c.env.DB, claimed.id),
  });
});

// DELETE /invites/:id — revoke, sender only
invites.delete('/:id', revokeRateLimit, revokeUserLimit, async (c) => {
  const user = c.get('user');
  const inviteId = c.req.param('id');

  const invite = await inviteService.findById(c.env.DB, inviteId);
  if (!invite) {
    throw notFound('Invite not found');
  }
  if (invite.senderUserId !== user.id) {
    throw forbidden('This is not your invite');
  }
  if (invite.status === 'completed') {
    throw coded('This invite has already been completed', 409, 'INVITE_COMPLETED');
  }

  await inviteService.revoke(c.env.DB, inviteId);

  console.info(JSON.stringify({
    event: 'invite_revoked', requestId: c.get('requestId'), userId: user.id, inviteId,
  }));

  return c.json({ ok: true });
});

export default invites;
