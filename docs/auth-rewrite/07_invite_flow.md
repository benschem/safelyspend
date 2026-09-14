# Phase 7 — Invite flow (UI + backend + email)

- **Goal:** Existing member invites a partner by email. Three acceptance paths land. Asymmetric master-key handoff completes once the recipient sets a password.
- **Files:** `worker/src/routes/invites.ts` (issue / list / accept / revoke); Resend email template; `src/routes/settings.tsx` (invite section — send invite, list pending invites); new `src/routes/accept-invite.tsx`; in-app banner component for path #2 (account exists, invite auto-attached on signup); `src/hooks/use-invites.ts`; client-side "pending handoffs" worker that, on every cloud login of an existing member, checks for invitees with a pubkey but no wrapped master key and writes one.
- **Gates:** none outstanding. Q2 is locked: the existing member wraps on their next cloud login, the invitee polls.
- **Size:** L
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 4](04_onboarding_rewrite.md).

Reference: `../searchyourstuff/app/models/{house,invite,user}.rb` and `app/models/concerns/invitable.rb` — sweep-on-signup pattern is the model.

## v1 does not build the path 2 fix, 2026-09-14

The decision below stands and is still the right one. It is **not being built for v1**.

`00_overview.md` records the trade: the maintainer will tell the one recipient to click
the emailed link, which puts them on path 1 where everything works. The exposure is that
a recipient who ignores the link and signs up from the landing page gets their own
household and can never join — recoverable only by deleting the account, which at that
point holds nothing.

Build the fork the moment there is a third user. Everything below is the design, ready
to pick up; nothing about it changes.

## Path 2 is decided: sweep before create, then fork

Path 2 is the one where the recipient ignores the emailed link, signs up from the
landing page, and expects the app to notice the invite waiting for them. As built in
Phase 2 it cannot work. `/auth/signup` creates the new user a household in the same
call — that is what an ordinary signup *is* — and `UNIQUE(household_members.user_id)`
then means they can never accept. The sweep runs and the banner renders; the button
behind it returns 409 `HOUSEHOLD_FULL`.

The root cause is not path 2. It is Q5 meeting "signup always creates a household", and
any fix has to give on one of those two.

**Decided: `/auth/signup` sweeps for an open invite before it creates anything.** If one
matches the email, the endpoint returns the invite and builds nothing — no household, no
membership, no key rows — and the client shows a fork:

- **Join them** — re-route to `/auth/signup-with-invite`, which never creates a household.
  The client already holds the generated key material and carries it across.
- **Start my own** — proceed with the ordinary signup.

Nothing is ever built speculatively, so nothing is ever torn down. The rejected
alternative was to let acceptance delete a brand-new empty household: it keeps signup
simpler, but it puts a delete path on a table nothing else deletes from, and "empty"
has to be defined exactly right or it eventually eats a real household.

**The fork screen must say that the choice is permanent.** Under Q5, "start my own" cannot
be undone — there is no leave-a-household flow in v1 (Q7), so the only way back is
deleting the account. A fork that hides this is worse than no fork, because it turns an
informed decision into a 409 the user meets later and cannot act on. This sentence is
the feature; without it this is just the delete-the-household option with extra steps.

### Declining is a terminal state, and the schema already carries it

Choosing "start my own" sets `invites.status = 'declined'`. Phase 2 added the value to
the CHECK constraint ahead of need, because SQLite cannot extend a CHECK in place: adding
it later means rebuilding the table, and the database was empty exactly once.

Leaving the invite `open` instead was rejected — the sender would see "pending" forever
and the recipient would keep a banner they can never action. `revoked` was wrong because
it reads as the sender cancelling.

Nothing sets `'declined'` yet. Phase 7 wires the transition, and should also give
`assertAcceptable` a case for it: a declined invite currently falls through to
`INVITE_ALREADY_ACCEPTED` ("already been used"), which is not what happened.

### What this does not fix

**An invite can arrive after signup.** B signs up normally, and only then does A invite
them. No sweep can catch that, because at signup there was nothing to sweep. B hits the
same wall through a different door, and the only v1 answer is to delete the account and
sign up again.

That is inherent to Q5 rather than to this decision, and it is the case to handle in copy
rather than in code: `GET /v1/invites` will list the invite as received, and the UI has to
say plainly why it cannot be accepted and what the (unpleasant) way round is. Getting
that wrong means a permanently stuck banner, which is the exact failure this phase set
out to remove.
