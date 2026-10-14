# Join a household with a one-time code

- **Status:** proposed 2026-10-13. Nothing built. The direction is agreed
  ("deleting code is better than fixing it"); the items under "Proposed, not
  yet confirmed" still need a yes.
- **Goal:** a partner joins a household by entering a one-time code that the
  existing member shows them. The server never carries anything that can open
  the household key, so the public-key handoff, the waiting screen, the
  approval dialog and safety numbers are all deleted.
- **Touches:** `worker/src/routes/invites.ts`, `worker/src/routes/handoffs.ts`,
  `worker/src/routes/households.ts`, `worker/src/routes/auth.ts`, a worker
  migration, `src/lib/key-management.ts`, `src/lib/envelope.ts`,
  `src/lib/invite-acceptance.ts`, `src/lib/api-client.ts`,
  `src/routes/accept-invite.tsx`, `src/routes/household-waiting.tsx`,
  `src/routes/login.tsx`, `src/components/account/`, `src/routes/settings.tsx`.
- **Replaces:** `docs/reference/crypto-design.md` §7.2 and §7.3, and the
  public-key handoff the invite UI is built on. Invites by email stay.

## Why

A review on 2026-10-13 found that a malicious server can defeat the safety
number check. The invitee's "Yours" number is computed from the public key the
server sends back (`src/routes/household-waiting.tsx:110`), not from the
invitee's own private key. A server that hands its own key to both people makes
both screens agree, and the existing member then wraps the household key for
the server. `crypto-design.md` §7.2 calls this check the primary defence.

The hole could be patched. But the whole handoff exists only because the
untrusted server carries the key from one person to the other, which forces
per-user keypairs, an authenticated public key, and a human comparing numbers.
`crypto-design.md` §7.2 already assumes the couple has a trusted side channel
and uses it only to compare fingerprints. Sending the secret over that channel
removes the server from the exchange, and the class of attack with it.

It also removes the waiting state. Today the handoff lands days after signup,
so the invitee has to find and retype their recovery phrase to join
(decided 2026-09-16). With a code, the invitee holds the household
key during signup, while the phrase is still in hand, and joins in one call.

## How it works

1. The existing member, unlocked, sends an invite. Their client generates a
   random 128-bit transfer secret, wraps the household key under a key derived
   from it, and uploads that wrapped blob with the invite.
2. Their screen shows the secret once, as a QR code and as twelve words.
3. The server emails the invite link as it does today. The email never
   contains the secret.
4. The partner opens the link, signs up, and supplies the secret by scanning
   the QR code or typing the twelve words.
5. Their client fetches the wrapped blob, opens it, and wraps the household key
   under their own password and recovery phrase, the same as an ordinary
   signup does. One request creates the account, the membership and the key
   rows.
6. The server deletes the wrapped blob when the invite is accepted, cancelled
   or expires.

## Trade-offs accepted

- **Private side channel.** It now has to be private, not just tamper-proof.
  A leaked fingerprint was harmless; a leaked code is not. It is only useful
  together with the wrapped blob, which means a compromised server or a
  household account, and only until the blob is deleted. A server that kept a
  copy of the blob could still use a leaked code later.
- **Remote partners.** They have to be sent the twelve words over something
  trusted, such as Signal or a phone call.
- **Unlocked sender.** The existing member has to be unlocked to create the
  invite. They already are, since invites are sent from settings.
- **No per-user public keys in the flow.** Anything later that needs "encrypt
  this for one specific person" would bring them back.

## Proposed, not yet confirmed

- **A one-time transfer secret as the code**, as above, and not the household
  key itself. Showing the household key directly needs no server change at
  all, but a copy left in a chat history opens the vault for ever.
  Recommended: the one-time secret.
- **The QR code is a link** with the secret in the URL fragment
  (`/accept-invite?token=…#code=…`). The phone's own camera opens it, so the app
  needs no in-app scanner, no camera permission and no CSP change, and a
  fragment is never sent to the server. Recommended. To check: that nothing
  (analytics, error reporting, a redirect) reads or forwards the full URL on
  that route.
- **Closing the dialog.** If the sender closes it, they cancel and invite
  again. The secret is never stored, so it cannot be shown twice. Recommended
  as the simple version.
- **Per-user keypairs stay in the database for now.** Signup is built around
  them (`users.pubkey`, `user_keys`) and the recovery path opens the private
  key. Removing them is a separate, larger change. This plan only stops
  depending on them for joining. To decide after step 1.

## Steps

1. **Inventory, read only.** Confirm what each handoff piece is used by, and
   write the delete list into this file. Starting points, from a search and
   not yet read in full: `worker/src/routes/handoffs.ts`, the add-member and
   rewrap routes in `worker/src/routes/households.ts`,
   `worker/src/services/key-bundle.ts`, `src/routes/household-waiting.tsx`,
   `src/components/account/approve-invitee-dialog.tsx`,
   `safety-numbers.tsx`, `join-household-step.tsx`,
   `src/lib/invite-acceptance.ts`, the handoff envelope in `src/lib/envelope.ts`
   and its crypto in `src/lib/key-management.ts`, and
   `household_member_keys.sender_pubkey`. Also check whether production holds
   a pending handoff, and whether anything other than joining uses the
   per-user keypair.
2. **Transfer crypto.** Wrap and unwrap the household key under a key derived
   from the transfer secret (HKDF with its own info label, AES-GCM, header
   bound into the associated data like the other envelopes). Encode the secret
   as twelve words with `@scure/bip39`, which is already a dependency. Tests:
   round trip, wrong code, mistyped word, tampered blob, a known-answer vector.
3. **Worker.** The invite row carries the wrapped blob. Issuing an invite
   accepts it, the recipient's invite lookup returns it, and
   `signup-with-invite` accepts the member key rows and creates the membership
   in the same batch. The blob is cleared on accept, cancel and expiry. Tests
   for each, plus another user's invite and an expired one.
4. **Sender UI.** The invite panel in settings generates the secret and shows
   the QR code and the twelve words once. QR generation needs a small library;
   `qr` by the author of `@noble` and `@scure` is the candidate, to confirm.
5. **Invitee UI.** `accept-invite` takes the secret from the fragment or from a
   twelve-word field, and finishes signup with member keys in one call. No
   waiting screen.
6. **Delete the old flow** from the step 1 list, with its tests, endpoints and
   API client methods. Update `docs/reference/crypto-design.md` §7 and
   the "Joining a household" section of `docs/reference/ARCHITECTURE.md`, and
   check the privacy page copy, which describes the safety number check.
7. **Two-browser walkthrough**, in person by QR and remotely by typed words,
   then the version bump and changelog entry with the change.

## Not in this plan

- **Email control alone gives a full session.** Accepted by the maintainer,
  2026-10-13, not to be fixed. `via: 'recovery'` skips the password check
  (`worker/src/routes/auth.ts:261`) and `/recovery-reset` accepts a new
  verifier without proof of the phrase (`auth.ts:573`). Someone who controls
  the mailbox can overwrite or delete the cloud copy but cannot read it, and
  a user who has lost their email has larger problems. The rest of the
  reasoning is in `DECISIONS.md` ("The accepted exception: resetting a
  forgotten password"), `crypto-design.md` §3.3 and `api-design.md` §3.9, all
  in `docs/reference/`.
- **An existing account joining a household** (path 2 in `crypto-design.md`
  §7.4, and an invite that arrives after signup). Unchanged by this plan and
  still parked: it is "Join without the invite link" under Maybe in
  `BACKLOG.md`.
- **Leaving or removing a member.** Still needs a key rotation whichever way
  joining works.

## If this plan is not built

Each of these is a gap in the public-key handoff that this plan deletes.
Building the plan closes them. If it is abandoned, they go back in the queue.

Two of them share a dead end. Approving an invitee sets the invite to
`completed`, before they have joined. From then on the member cannot undo it:
revoking answers 409 `INVITE_COMPLETED`, and the household counts two members,
so every new invite answers `HOUSEHOLD_FULL`. Nothing in the app lets either
person throw the half-made account away and try again.

The cheap stopgap for both is to let the member remove someone who has been
approved but has not joined, which frees the place for a fresh invite.

### An invitee who loses their password before joining is stuck

Hit in the two-browser walkthrough of the invite UI, 2026-10-10: the invitee
signed up in a private window, the browser did not keep the generated
password, and the member had already approved them. Traced through the worker,
not exercised.

Between signing up and joining, the invitee has their own `user_keys` rows and,
once approved, a lone `ecies` member key. Joining proves the current password
against the `pwd` user row before it uploads anything, so without the password
they cannot join. On top of the dead end above:

- **Recovery cannot reset it.** `POST /auth/recovery-reset` requires
  `newMemberKeyPwd`, the household key re-wrapped under the new password. The
  invitee does not hold the household key yet, so there is nothing to wrap.
- **They cannot delete the account.** `DELETE /auth/account` needs a full
  session, which needs the password. A recovery session is refused.

The phrase does still open the invitee's private key, which is all that is
needed to open the handoff. So the likely fix is to let recovery work in this
state: a reset that replaces the verifier and the `pwd` user row and leaves the
member key alone, after which they join with the new password. That means a
branch in `recovery-reset` (or a sibling route) for a user with no `pwd` member
row, and the matching branch in `login.tsx` and `buildPasswordResetMaterial`.

Until that or the stopgap exists, the only repair is by hand in the database.

### An invitee who loses their recovery phrase before joining cannot start again

Hit in production, 2026-10-11: the invitee had signed up and been approved,
then lost the twelve words before finishing the join. Not traced: whether the
password alone would still have let them join, and whether a phrase can be
reissued once they have.

Repaired by hand in the production database: deleted the invite row, then the
user row, which cascaded to the membership and the lone `ecies` member key. The
household and its vault were untouched and it was back to one member.

Ideas, not decided:

- **Expire it automatically.** An account that was approved but never joined is
  deleted if it does not sign in again within some window, and the place is
  freed.
- **The stopgap above.**

### A handoff from a deleted account has no screen of its own

`IncomingHandoff` and the `ecies` member-key row both carry
`senderPubkey: string | null`, because the column is nulled when the sending
account is deleted. With no sender key there is no safety number to show and
nothing to bind the envelope to, so the handoff can never be opened. The
invitee is left a member of a household they cannot unlock.

Today the waiting screen refuses it with a generic "This invite cannot be
opened" (`cannot-verify` in `src/routes/household-waiting.tsx`). Better: say
that the person who invited them has deleted their account, and that the way
on is to delete this account too and start again or accept a fresh invite.
There is no leaving a household (`docs/reference/DECISIONS.md`, "Why one
household per user, and no leaving?"), so account deletion is the only exit.

Rare with two users, and nothing is lost: the account holds no data yet.

### Declining a handoff whose safety number does not match

Decided 2026-10-01: ship the simple version first.

**Today.** When the invitee says the numbers do not match, the screen refuses
to open the envelope and stops: don't continue, contact them another way, with
Compare again and sign out. No server call. Refusing to open is enough to keep
the key safe. Nothing cleans up afterwards. A misread or a formatting bug
costs nothing, because the handoff is still there to retry. A real attack
leaves the invitee a member of a household they cannot open, and deleting the
account is the way out, which is the right outcome in that case.

**Better: a decline action.**

- A worker route that, in one transaction, removes the invitee's
  `household_members` row and `ecies` member-key row and sets the invite to
  `'declined'`. The status is already in the `invites.status` CHECK; nothing
  writes it yet.
- A client method for it, and a "these don't match" button that calls it.
- For the existing member, a notice that the invitee reported a mismatch:
  their connection or our server may be compromised, or a number was misread.
  From there they can re-send cleanly.

The existing member then finds out without a side channel, and the invitee is
never left in a household they cannot open. Worth building when the app has
users who are not sitting next to each other.

### The approval dialog shows two numbers and invites comparing them

Found in the walkthrough, 2026-10-10: the maintainer read the dialog's two
safety numbers as a pair that should be equal, and reported a mismatch on a
good approval. A member doing this for real would cancel.

`approve-invitee-dialog.tsx` shows the invitee's number and the member's own
side by side from the start. Only the invitee's is checked at that point,
against the invitee's screen. The member's own is for afterwards, when the
invitee's screen shows it and asks them to confirm.

Fix: one number and one instruction per screen, as the invitee's waiting screen
already does.

1. Before approving: only their number, with "check this matches the number on
   their screen".
2. After approving: only yours, with "now read this to them so they can check
   it".

This narrows the decision "both safety numbers on both screens", which was
made for the invitee's side.

### The member cannot see their own safety number after the dialog closes

Also hit in the walkthrough, 2026-10-10. The member approves and closes the
dialog, the invitee's screen is still asking them to confirm the member's
number, and the app shows that number nowhere else. Approve cannot be pressed
again to bring it back, because the invite is already `completed`.

Blocking the dismiss is not the fix. A reload or a closed tab dismisses it
anyway, and the invitee may not join for days, which is by design. Make the
number retrievable: while someone is approved but has not joined, the invite
row says so and shows the member's number whenever the vault is unlocked, with
"read this to them when they ask". Once they have joined it is a plain joined
row. This goes with one number per screen: after approving, the member's
number lives on the row, not in a dialog.

Telling the two states apart needs the worker to report whether a member has
finished joining. The invite becomes `completed` on approval, not on joining,
so the panel has no signal today. Without that, show the number in the panel
whenever the vault is unlocked.

### Approving an invitee: what else is missing

- **Tell the member someone is waiting**, wherever they are in the app. Today
  they only find out by opening Settings, so an invitee can sit on the waiting
  screen until one of them thinks to ask the other.
- **Say what went wrong when an approval fails.** Today every failure reads
  "try again", including a cancelled invite and a full household, where trying
  again can never work.
- **Give "the numbers do not match" its own answer.** Today the member cancels
  and is told nothing about what a mismatch means or what to do next.

## Invite panel follow-ups

The invite panel stays under this plan, so check each against the new flow.

- **Send again button.** Today it is Cancel then Send by hand. A button must
  handle the revoke landing and the issue failing (five issues an hour): the
  old link is dead and nothing replaced it.
- **One row per address.** Drop revoked and declined before picking the
  newest, and always show every live invite. The other order hides joined
  rows, and live invites that then cannot be cancelled.
- **Confirm before cancelling someone who has already signed up.** It strands
  their account. This one changes under the plan, because signing up and
  joining become one step.
- **Hide the form when the household is full.** Needs the worker to report the
  member count: a `completed` invite outlives the joiner deleting their
  account.
