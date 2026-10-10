# Phase 7 — Invite flow (UI + backend + email)

- **Goal:** Existing member invites a partner by email. Three acceptance paths land. Asymmetric master-key handoff completes once the recipient sets a password.
- **Files:** `worker/src/routes/invites.ts` (issue / list / accept / revoke); Resend email template; `src/routes/settings.tsx` (invite section — send invite, list pending invites); new `src/routes/accept-invite.tsx`; in-app banner component for path #2 (account exists, invite auto-attached on signup); `src/hooks/use-invites.ts`; client-side "pending handoffs" worker that, on every cloud login of an existing member, checks for invitees with a pubkey but no wrapped master key and writes one.
- **Gates:** none outstanding. Q2 is locked: the existing member wraps on their next cloud login, the invitee polls.
- **Size:** L
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 4](04_onboarding_rewrite.md).

Reference: `../searchyourstuff/app/models/{house,invite,user}.rb` and `app/models/concerns/invitable.rb` — sweep-on-signup pattern is the model.

## What Phase 4 left you

**`api.auth.signupWithInvite` exists and has never run.** Phase 4 built it alongside
`signup` because the shapes were settled together, but this phase is its only caller and
nothing invokes it yet — so its field names are transcribed from
`worker/src/routes/auth.ts`, not verified against a live worker. Check them before
trusting them. Same for the `SignupWithInviteResponse` type.

**The signup flow is the account half of path 1.** `src/routes/login.tsx` already does
email → code → password → recovery phrase → create; accepting an invite as a new account
is that flow with the invite token attached, no household block, and no member keys. It
should be a branch in the existing shell rather than a second one.

**`account.ts` does not yet build an invite signup payload.** `buildSignupMaterial`
returns the household and member-key blocks that `signupWithInvite` must omit. Splitting
out the user-keys half is this phase's first move.

**`assertSameKek` will reject a freshly-handed-off invitee.** `unlockKeyBundle` requires
the `user_keys` and `household_member_keys` password rows to carry matching KDF metadata.
Between the handoff and the rewrap the invitee has an `ecies` member-key row and no `pwd`
one at all, so they take the "no password-wrapped household key" path. That is correct —
they genuinely cannot unlock yet — but the message says the wrong thing for the case, and
this phase owns the waiting-for-partner screen that should be shown instead.

## The invitee re-enters their recovery phrase to join, 2026-09-16

**The gap.** The last step of the handoff re-wraps the MasterKey under the invitee's
password *and* their recovery phrase, and `POST /households/:id/members/:userId/rewrap`
takes both or neither (`parseKeyPair`). But the handoff lands whenever the existing
member next unlocks, which may be days after signup, and by then the phrase is gone:
`login.tsx` clears it the moment the account exists and nothing stores it, by design.
`../crypto-design.md` §7.2 and §7.3 both assume it is still in hand. It never is.

**Decided: ask for it again at the moment of joining.** The waiting screen, once the
wrap has arrived and the sender's fingerprint is confirmed, asks for the password and
the twelve words, then rewraps. No crypto change, no worker change, and §6.3's row
shapes stand exactly as written.

The cost is taken knowingly: joining asks the invitee to find the phrase they saved at
signup. If they cannot, they cannot join — the account holds nothing yet, so the way
round is delete and sign up again. That is also a free test that the phrase was saved,
at the one moment it is cheap to fail.

**Rejected alternatives.**

- *Recovery reaches the MasterKey through the private key.* The invitee's `recovery`
  member row becomes a wrap of the MasterKey for their own public key, opened by the
  phrase → private key path that already exists. Joining would then need only the
  password. Rejected for v1 as a crypto-format change touching §6.3, Phase 2 §4.8, the
  worker's row validation and `unlockKeyBundleWithPhrase`. The better design if joining
  ever has to be painless; nothing below blocks moving to it.
- *Rewrap during the signup tab.* Works only if both people are online at once. Fragile.

**The phrase must be proven before anything is uploaded.** This is the sharp edge of the
decision. A mistyped phrase that happens to pass the BIP-39 checksum derives a perfectly
good KEK — just not theirs — and wrapping the MasterKey under it writes a `recovery` row
that will never open. Nothing fails at the time; the account is silently unrecoverable
and nobody finds out until the day it matters. So the rewrap first opens the invitee's
own `user_keys` rows — the phrase against the `recovery` row, the password against the
`pwd` row — and only a pair that opens both goes on to wrap and upload. The `pwd` row's
salt and params are reused rather than regenerated, so `assertSameKek` holds for every
later unlock.

**Signing in while waiting is its own state.** Between signup and rewrap the invitee has
`user_keys` rows and no `pwd` member row, so `unlockKeyBundle` throws "no
password-wrapped household key" — correct, since they cannot open a vault yet, and the
wrong thing to show. That login routes to the waiting screen instead. It only needs the
private key, which the `pwd` user row gives up on its own.

## Build order

Each step is its own commit and lands with its tests.

1. **Done, 2026-09-16.** **`account.ts` — key material.** Split the user-keys half out of
   `buildSignupMaterial` for invite signup. Add, each unit-tested: the handoff wrap
   (existing member, envelope C for the invitee's pubkey); opening a handoff (invitee,
   refusing a `SENDER_PUB` that differs from the one confirmed); and building the rewrap
   from password + phrase, proving both against `user_keys` first. Correct
   `SignupWithInviteResponse.invite.senderPubkey` to `string | null`.
   Built as `buildInviteSignupMaterial`, `buildHandoffWrap` and `completeHandoff`;
   the last proves password and phrase, opens the envelope and rewraps in one call, so
   joining pays Argon2id once. `AddMemberBody` and `RewrapBody` types landed here too,
   because `account.ts` imports its wire shapes; the methods that send them are step 2.
   Both handoff functions take a `ConfirmedPublicKey`, which only `markPublicKeyConfirmed`
   makes: steps 4 and 6 call it from the "numbers match" handler, on the key the displayed
   fingerprint was computed from. The rewrap endpoint now also refuses a `pwd` member row
   whose salt or params differ from the user's `pwd` row.
2. **Done, 2026-09-18.** **`api-client.ts` — the missing namespaces.** `invites` (issue,
   list, accept, revoke), `handoffs` (pending, incoming), `households` (add member,
   rewrap). Field names checked against the worker routes, not the design doc.
   Two shapes the routes settled: `issue` leaves `expiresInDays` out when it was not
   chosen, so the three-day default lives only in the worker; and the server's
   `inviteePubkeyFingerprint` / `senderPubkeyFingerprint` are typed but must be
   recomputed before display, which the types say in as many words.
3. **Done, 2026-10-01 (`f76390a`), not yet run against the live API.**
   **Invite signup.** `src/routes/accept-invite.tsx` reads the token and hands it to the
   existing `login.tsx` shell, which branches only at the final call: `signupWithInvite`,
   then the waiting screen instead of the setup wizard. A signed-in visitor gets plain
   copy for "you already have a household" rather than a raw 409 — in v1 every ordinary
   signup creates one, so this is the common case for path 3.

   Decided while planning the step, 2026-09-18:

   - **The shell is reused, not copied.** Invite mode is a third mode of `login.tsx`
     alongside sign-in and recovery, holding a token and changing the final call. A second
     copy would duplicate ~200 lines of the parts that are easy to get wrong: never
     storing the phrase, keeping steps out of the URL, handling a spent bridge token. The
     token cannot simply be a query param on `/login`, because the emailed link is
     `/accept-invite?token=` (`worker/src/services/email.ts`), and an invite link should
     look like one. If the shell does get unwieldy later, extract the email and code steps
     rather than fork it.
   - **The pre-signup screen cannot name the sender.** There is no unauthenticated
     token-lookup endpoint, deliberately: it would let anyone with a guessed token learn
     an email address. So the page says only that an invite exists, and the sender appears
     on the waiting screen, where the name arrives with the safety number that matters.
   - **The invite is bound to the address it was sent to.** A different address fails with
     403 `EMAIL_MISMATCH` after a whole OTP round trip, so the email step says in invite
     mode to use the address the invite was sent to, and the 403 says the address does not
     match rather than anything generic.
   - **Accept is never called on page load.** It is rate-limited to 3/h per user, so three
     refreshes would lock someone out of their own invite for an hour. The page shows what
     it knows, offers a button, and branches on the error code when it is pressed. That
     also keeps a state-changing call behind a deliberate click.
   - **Four signed-in cases, each with its own sentence.** Already in a household (the
     common one, and permanent under Q5/Q7 — offer deleting this account, or having the
     other person accept an invite from them instead); signed in with no household, which
     means they already accepted, so route to the waiting screen on the strength of
     `me()` rather than an accept call (**superseded** by the first revision below);
     signed in as the wrong account, likely on a shared
     laptop; and a token that is expired, revoked or unknown, where "already used" for a
     lapsed invite is exactly the wrong sentence. Sign out is reachable from every one of
     these dead ends.

   Revised while building, 2026-09-19:

   - **"No household" is not proof of waiting.** Two states leave a household-less account
     attached to no live invite: the claim failing after `signup-with-invite` created the
     account (the worker's own comment says to recover through accept), and the claimed
     invite being revoked and re-sent, which is how v1 re-sends. Routing either to the
     waiting screen strands them there, and it left the Accept button with no case in v1
     where it could succeed. So the page reads `invites.list()` beside `me()`: a received
     invite in `accepted_pending_handoff` goes to the waiting screen, and anything else
     gets the button. `listReceived` returns only invites this account has claimed, so
     the check is exact, and it costs a GET at 30/min rather than one of three accepts
     an hour. Step 4's waiting screen will likely want the same check, to say an invite
     was cancelled. The rejected alternatives: making accept idempotent for the caller's
     own claim (spends the rate-limited write to learn what a free read says), and
     refusing revoke on a pending invite (blocks revoke-then-send, and does not fix the
     failed claim).
   - **An invite failure at signup costs the code.** `signup-with-invite` checks the invite
     after spending the bridge token and creates nothing when the check fails. A mismatch
     goes back to the email step with its own sentence, and a dead invite ends on its
     screen. The recovery phrase shown just before is void either way.
   - **A failed signup can still leave an account.** The route creates the account and
     sets the cookie *before* it claims the invite, so a claim that loses a race, or a
     response lost on the way back, reports failure over a real account whose recovery
     phrase is the one just shown. Joining asks for that phrase again, so telling that
     user the signup failed would cost them their invite. On any failure but an address
     mismatch, the client asks `me()` whether a session now exists; if one does, it goes
     to the signed-in invite check, which sorts it into waiting or can-accept like any
     other signed-in visitor. The one exception is a failure that already names a dead
     invite: the check would offer an Accept button whose only outcome is that same
     sentence, at one of three accepts an hour, so it is shown straight away instead.
   - **`INVITE_ALREADY_ACCEPTED` also means revoked.** `assertAcceptable` gives a revoked
     invite that code, so its sentence says "cancelled, or already used" rather than
     claiming either one.
   - **Built as** `src/lib/invite-acceptance.ts` (the two decisions, unit-tested, and the
     `InviteView` vocabulary they feed), `invite-status-step.tsx` (the signed-in views), an
     `invite` mode on `EmailStep`, and a placeholder at `/household/waiting` for step 4 to
     replace, with a sign-out so it is never a dead end. A sign-in in invite mode skips
     the unlock when the account has no household, because there is no household key to
     open. A plain `/login` in that state still fails at the unlock, and step 4 owns that
     too.
   - **`classifyAcceptFailure` is for accept and invite signup only.** Issuing an invite
     answers `HOUSEHOLD_FULL` as well, meaning the *sender's* household is full. Step 5
     classifies its own errors.
   - **Deferred, 2026-09-19.** No route test covers the branching in `login.tsx` — there
     is no route-rendering test harness yet, and the two-browser walkthrough exercises
     these paths. And `login.tsx` is ~730 lines across three modes: when it next grows,
     move `step`, `error`, `loading` and the held secrets into one `useReducer`, which
     makes `discardHeldSecrets` a single `reset` action and every transition named.
     **Deferred again, 2026-10-01, until after the two-browser walkthrough.** Step 4
     adds only a few lines here, since the join screen lives in its own route. The
     version worth doing makes state a union where each step carries what it holds, so
     leaving a step drops its secrets and `discardHeldSecrets` goes away. That rewrites
     most handlers in a file with no route tests whose flows have never run live.
     Refactoring after the walkthrough keeps a bug in the refactor distinguishable from
     a bug in the flow, and the walkthrough becomes its regression check.
4. **Done, 2026-10-05 (`62b23b8`..`41ddfff`), not yet run against the live API.**
   **Invitee waiting screen.** Replaces the placeholder step 3 left at
   `/household/waiting`. Polls the key bundle; on arrival shows the safety numbers to
   confirm out-of-band, asks for password and phrase, opens, rewraps, then pulls the
   household vault. Also reached from a login in either waiting state.

   Only the awaiting state can be seen live until step 6 exists. Compare, mismatch and
   join are verified by type-check and reading, and `completeHandoff` by its unit tests;
   the page itself has no tests, for want of a route-rendering harness.

   Built as five commits: the safety number formatter (`formatSafetyNumber`,
   `safetyNumberFor`, on `@scure/base`'s `base32crockford`), `classifyHandoffState` and
   the `login.tsx` routing fix, `downloadBackup()` extracted from Settings,
   `usePollWhileVisible`, and the page with `safety-numbers.tsx` and
   `join-household-step.tsx`.

   Changed while building, 2026-10-01 to 2026-10-05:

   - **It polls `GET /auth/key-bundle`, not `/handoffs/incoming`.** The page needs the
     bundle anyway, since `completeHandoff` takes it and `classifyHandoffState` reads
     it, so one source of truth beats two that could disagree. Every 10 s is 6 a
     minute against 30 per user. `api.handoffs.incoming()` has no caller.
   - **Each poll re-reads the invite list too.** A sender who revokes while the invitee
     waits would otherwise leave them waiting until a reload. The list allows 30 a
     minute per user, so both at 6 a minute is well inside. A failed list read keeps
     the sender's address from the last good one and assumes the invite is open, rather
     than calling it cancelled on the strength of one failed request.
   - **Any rewrap failure but the rate limit re-reads the bundle before reporting.** The
     plan did this only for 409 `NO_PENDING_HANDOFF`, but a dropped connection after the
     worker commits is the likelier lost response. A bundle with a `pwd` row means the
     rewrap landed, and joining continues with the keys already in hand. A 400
     `INVALID_BLOB` keeps the fresh bundle and asks for the current password, since a
     password changed on another device is the likely cause. `classifyRewrapFailure` in
     `invite-acceptance.ts` reads the codes.
   - **The sender's address comes from the received invite list**, through
     `findJoiningInvite`: the live claim while waiting, the `completed` invite once the
     key is handed over, the most recent when a re-send left a revoked one behind. The
     key bundle carries only `senderUserId`.
   - **The poll hook hands each poll an `AbortSignal`**, aborted on unmount or when
     polling is disabled, and logs a timed poll's rejection through `debug` rather than
     dropping it. The page checks the signal after every read, and its initial load runs
     in an effect with its own abort, so StrictMode's second run shows nothing twice.
   - **A failed pull after joining stays on the page** with "You have joined" and Try
     again, as planned. A reload also recovers: the bundle now says `member`, so the
     page sends them to `/login`, whose unlock prompt pulls.

   Decided while planning the step, 2026-10-01:

   - **Waiting is two states, not one.** (a) *Awaiting handoff*: no `household_members`
     row, invite `accepted_pending_handoff`. (b) *Ready to join*: the existing member's
     add-member call has run, so the invitee **has a household** (`findForUser` finds
     the row), the invite is `completed`, and the key bundle holds a lone `ecies` member
     row and no `pwd` row. (b) is not brief — the wrap lands whenever the existing
     member next unlocks — so a sign-in in (b) is the usual way to reach the join screen.
     Step 3's code misroutes it twice: `classifySignedInInvitee` sees the household and
     shows the "already have a household" dead end, and `login.tsx` sees
     `session.household` and calls `unlockKeyBundle`, which throws "no password-wrapped
     household key".
   - **One classifier, read from the key bundle.** In `invite-acceptance.ts`: no
     household and no member rows → `awaiting-handoff`; household and a lone `ecies` row
     → `ready-to-join`; household and a `pwd` row → `member`, an ordinary unlock. Sign-in
     already holds the bundle, and the `ecies` row carries `senderPubkey` and
     `wrappedMasterKey`, so joining needs no second fetch for them. `login.tsx` uses it in
     place of the `!isInviteMode || session.household` check and sends both waiting
     states to `/household/waiting`. The signed-in invite check reads `keyBundle()`
     beside `invites.list()` in place of `me()`, since the bundle carries the household
     too. Checked against the worker: `GET /auth/key-bundle` allows 30 a minute per user,
     the same as `/auth/me`, and `listMemberKeys` returns every `kek_kind` with
     `sender_pubkey`, so state (b) is visible in it. It also makes a lost rewrap response
     self-healing: the next sign-in finds a `pwd` row and unlocks normally.
   - **Both safety numbers on both screens**, labelled as yours and theirs. The invitee
     needs their own number in state (a), to read to the existing member while they
     approve (step 6), and the sender's in state (b). Step 6 reuses the component.
     Rejected: one combined Signal-style number. The invitee cannot compute it in state
     (a), not knowing the sender's key yet, and it would change §7.2 of the locked design.
   - **The fingerprint displays as 13 Crockford base32 characters**, grouped `XXXX-XXXX-XXXXX`.
     Thirteen is the floor for the 8 bytes `../crypto-design.md` §8 fixes: 64 bits at 5
     bits a character. Crockford drops I, L, O and U and ignores case, so nothing reads
     as 1 or 0. One formatter beside `publicKeyFingerprint` in `key-management.ts`,
     because both screens must render a key identically, and always fed a fingerprint
     recomputed from the key, never the server's. Rejected: 20 decimal digits (clumsier,
     though unmistakable over the phone); base64 or base58 (case-sensitive aloud); six
     BIP-39 words (the recovery screen teaches "never share your words", and this would
     teach the opposite, which is how a phishing script gets the real phrase read out);
     anything shorter, since a malicious server grinding keypairs to match 40 bits is an
     afternoon on a GPU and at 64 is not practical.
   - **Poll every 10 s while the tab is visible**, paused on `visibilitychange`, with a
     Check now button, and stopped once a handoff arrives. No backoff: the likeliest real
     case is both people side by side, and backoff makes exactly that case slower.
     `/handoffs/incoming` allows 120 a minute. (**Superseded** in the endpoint only: the
     build polls the key bundle, as recorded above.)
   - **The join screen always warns and always offers a backup first.** Joining pulls
     the household vault over every local table. There is no test for whether the device
     holds a budget: someone with nothing on it declines the backup and carries on. The
     backup button reuses `exportAllData`. Showing it only when there is something to
     lose is in `../BACKLOG.md`.
   - **Joining runs** `completeHandoff` → `households.rewrapMemberKeys` →
     `unlockKeyVault` → `pull` → `/cash-flow`. The keys are unlocked only after the
     upload succeeds, as `completeHandoff`'s comment requires. Wrong phrase and wrong
     password each get their own sentence; neither spends anything, so the form stays.
   - **A mismatch is a dead end with no server call:** don't continue, contact them
     another way, with Compare again and sign out. Refusing to open is the whole of the
     defence, and a misread or a formatting bug leaves the handoff there to retry. The
     decline action that tells the existing member is in `../BACKLOG.md`.
   - **A sender who has deleted their account** leaves `senderPubkey` null, so there is
     nothing to verify and the handoff is refused with a generic message. The proper
     screen is in `../BACKLOG.md`.
5. **Existing member: send, list, revoke.** A Settings section on `use-invites.ts`.
   Deliberately small — the Settings restructure in `../BACKLOG.md` is where it finds its
   final home.
6. **Existing member: the sweep.** Runs on **vault unlock**, not only cloud login: the
   MasterKey most often returns through a password unlock against a live session, and a
   sweep bound to login would miss most visits. Pending handoffs → safety-number screen
   → approve → wrap → add member.

Then the two-browser walkthrough (`00_overview.md`, "How each phase will be verified").

**Fingerprint display.** Settled in step 4: 13 Crockford base32 characters. §7.2's six
groups of five digits predates the 8-byte length and would need more bits than exist.

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
