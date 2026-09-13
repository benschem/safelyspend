/** The two sweep endpoints of the invite handoff.
 *
 *  Both are plain short polls that answer with the current state. The inviting member
 *  is the active party — they wrap the MasterKey on their next cloud login — and the
 *  invitee simply polls until the wrap appears. Cadence is the client's call.
 */

import { Hono } from 'hono';
import { authMiddleware, requireFullSession } from '../middleware/auth.js';
import { rateLimit, userRateLimit } from '../middleware/rate-limit.js';
import { pubkeyFingerprint } from '../lib/crypto.js';
import { base64urlToBytes } from '../lib/bytes.js';
import * as householdService from '../services/households.js';
import * as inviteService from '../services/invites.js';
import type { HonoEnv } from '../types.js';

const pendingRateLimit = rateLimit({ max: 60, windowSeconds: 60, keyPrefix: 'handoffs:pending' });
const incomingRateLimit = rateLimit({ max: 120, windowSeconds: 60, keyPrefix: 'handoffs:incoming' });

const pendingUserLimit = userRateLimit({ max: 60, windowSeconds: 60, keyPrefix: 'handoffs:pending' });
const incomingUserLimit = userRateLimit({ max: 120, windowSeconds: 60, keyPrefix: 'handoffs:incoming' });

const handoffs = new Hono<HonoEnv>();

handoffs.use('*', authMiddleware, requireFullSession);

// GET /handoffs/pending — invitees waiting for this user to wrap the MasterKey for them
//
// The fingerprint is served alongside the public key so the client can render it
// immediately, but the client should still recompute it from the key before showing
// the safety number: a server that serves a real key with a mismatched fingerprint is
// exactly the attack the out-of-band check exists to catch.
handoffs.get('/pending', pendingRateLimit, pendingUserLimit, async (c) => {
  const user = c.get('user');

  return c.json({ handoffs: await inviteService.listPendingHandoffs(c.env.DB, user.id) });
});

// GET /handoffs/incoming — a MasterKey wrapped for this user, waiting to be rewrapped
//
// Zero or one entry in v1, since a user belongs to at most one household. The array
// shape is what a future multi-household version would need.
handoffs.get('/incoming', incomingRateLimit, incomingUserLimit, async (c) => {
  const user = c.get('user');

  const rows = await householdService.listIncomingHandoffs(c.env.DB, user.id);

  const withFingerprints = await Promise.all(
    rows.map(async (row) => {
      const senderPubkeyBytes = row.senderPubkey ? base64urlToBytes(row.senderPubkey) : null;
      return {
        ...row,
        senderPubkeyFingerprint: senderPubkeyBytes
          ? await pubkeyFingerprint(senderPubkeyBytes)
          : null,
      };
    }),
  );

  return c.json({ handoffs: withFingerprints });
});

export default handoffs;
