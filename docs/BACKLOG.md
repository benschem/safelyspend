# Backlog

Known cleanups that are real but not worth interrupting feature work for. Each
one is repo-wide rather than local to a single change, which is why they keep
getting noticed during review and then left alone: fixing one inside a feature
diff buries an unrelated sweep in it.

Land each as its own commit when it comes up. Delete the entry when it does.

## Logging out forgets the vault version, so the next push conflicts

`clearLocalSyncState` in `src/hooks/use-auth.ts` removes
`STORAGE_KEYS.SYNC_LOCAL_VERSION` on every logout and on account deletion. For
deletion that is right — the relationship with that server is over. For logout
it throws away a fact that is still true: the vault on the server is at version
N, and this device knows it.

`getStoredVersion` in `src/hooks/use-sync.ts` returns `0` when nothing is
stored, and `push` sends that as its expected version. So on a device that
already has a budget:

1. Log out, log back in. `goToUnlockedDestination` sees `isInitialized` and
   navigates to Settings without pulling, so nothing restores the version.
2. The next push sends `expectedVersion: 0` against a server at version N.
3. The server answers 409 and the conflict UI opens, offering to pull or
   overwrite — for two clients that are not in conflict at all.

The cost is a false alarm rather than lost data. A device that really is stale
would have taken the 409 anyway, on its true version; what this adds is the
same prompt for a device that was perfectly in sync a moment earlier. Either
branch of the conflict UI resolves it correctly. But the prompt is written to
warn that an evening's work is about to be discarded, and a warning that cries
wolf after every sign-in is one people learn to click through — which matters
on the day it is telling the truth.

**Traced, not observed.** This was followed through the code while building the
recovery flow, which logs out deliberately. Nothing has been run against a live
server, so confirm the 409 before fixing it.

The fix is probably to split `clearLocalSyncState` in two — deletion keeps the
current behaviour, logout keeps the version and clears only the key vault and
the last-synced timestamp — but it touches every sign-out path in the app,
which is why it is here rather than in the commit that noticed it.

## Settings buries the account, and nobody will find log out

Noticed on the first real run of signup, recovery and deletion against the live API.

`src/routes/settings.tsx` is one 1,600-line page with eight sections — Initial Cash,
Savings Balances, Cloud Sync, Data Management, Appearance, Check-in, Developer, About —
and the account lives inside the third. Cloud Sync alone carries connection state,
push and pull, Active Sessions and the Account block with deletion. Signing in, signing
out and deleting the account are all in there, below two sections of opening balances.

**The model it asks people to hold is the problem, not only the layout.** The page
presents "cloud sync" as a feature you connect, and the account as a detail of that
feature. The average person does not think in those terms: they think they have an
account or they do not, and that they are signed in or they are not. That the budget
lives on this device whether or not they are signed in — and that deleting the account
and deleting the data are different buttons with different consequences — is exactly the
part the page never says plainly. "Delete All Data" (this device, under Data Management)
and deleting the account (the server, under Cloud Sync) sit seventy lines apart with no
sentence connecting them.

**Log out is not where anyone looks for it.** People expect an account control in the
top right of the header, or at the foot of the sidebar. Whatever this becomes, sign in /
sign out and a way to reach the account belong in one of those two places, visible from
every page, not only inside Settings.

Directions, not yet decided:

- **Extract an Account page** (or "Account & sync"): signed-in state, email, sessions, log
  out, delete account. Settings keeps preferences. Probably the right cut, because it
  matches how people already think about apps.
- **Extract a "Your data" page**: where the budget lives, export, import, delete this
  device's data, and cloud backup as one option within it. Answers the local-versus-cloud
  confusion directly, but splits the account across two places.
- **Keep one page and restructure it**: tabs or a side index, with sessions collapsed. The
  cheapest, and does nothing about log out being hard to find.

Whichever is chosen, the copy needs one plain sentence on what signing in adds: your
budget is always on this device; an account keeps an encrypted copy in the cloud so you
can use it on another device, share it with someone, and get it back if this one is lost.
That sentence is also the obligation Phase 10's privacy pass carries, so write it once.

Bigger than a cleanup and not on the v1 critical path, but it will be the first thing
the second person in the household trips over, so it wants doing before that.

## A handoff from a deleted account has no screen of its own

Noticed while scoping Phase 7 step 4, 2026-10-01.

`IncomingHandoff` and the `ecies` member-key row both carry `senderPubkey: string | null`,
because the column is nulled when the sending account is deleted. With no sender key
there is no safety number to show and nothing to bind the envelope to, so the handoff
can never be opened. The invitee is left a member of a household they cannot unlock.

Step 4 only has to refuse it, with a generic "cannot join" message. The real version
says plainly that the person who invited them has deleted their account, and that the
way on is to delete this account too and start again or accept a fresh invite. Under
Q7 there is no leaving a household, so account deletion is the only exit.

Rare on a fleet of two, and nothing is lost: the account holds no data yet.

## The join screen offers a backup to everyone

Decided while scoping Phase 7 step 4, 2026-10-01. Joining a household pulls the
household vault over every local table, so v1 always warns and always offers an
`exportAllData` backup first, and an invitee with nothing on the device declines it.

The better version shows the warning only when there is something to lose. The likely
test is `isInitialized`: invite signup skips the setup wizard, so a device that has
never held a budget is uninitialised. Check it holds before relying on it — a device
set up once and since emptied would still count as initialised.

## Declining a handoff whose safety number does not match

Decided while scoping Phase 7 step 4, 2026-10-01. v1 ships the simple version.

**What v1 does.** When the invitee says the numbers do not match, the screen refuses to
open the envelope and stops: don't continue, contact them another way, with Compare
again and sign out. No server call. Refusing to open is the whole of the security; what
is missing is cleanup. A misread or a formatting bug costs nothing, because the handoff
is still there to retry. A real attack leaves the invitee a member of a household they
cannot open, and deleting the account is the way out — the right outcome in that case.

**The better version** is a decline action:

- A worker route that, in one transaction, removes the invitee's `household_members`
  row and `ecies` member-key row and sets the invite to `'declined'`. The status is
  already in the `invites.status` CHECK; nothing writes it yet.
- A client method for it, and a "these don't match" button that calls it.
- On the existing member's side (step 6), a notice that the invitee reported a mismatch:
  their connection or our server may be compromised, or a number was misread. From
  there they can re-send cleanly.

The gain is that the existing member finds out without a side channel, and the invitee
is never left in a household they cannot open. Worth building when the app has users
who are not sitting next to each other.

## Inline error blocks bypass `FormError`

`src/components/form-field.tsx` exports `FormError`, which renders a
`destructive` `Alert` and therefore carries `role="alert"`. Almost nothing uses
it. Twenty-one places instead hand-roll the same block:

```tsx
<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
```

They are in `src/components/account/` (8), `src/components/dialogs/` (10),
`src/routes/settings.tsx` (2) and `src/routes/categories/import-rules.tsx` (1),
across twenty files (counted 2026-10-05). Find them with:

```bash
grep -rn "bg-destructive/10 p-3" src
```

Two things follow from it. The cosmetic one is nineteen copies of one style,
which drift. The one that matters is accessibility: these messages appear
*after* a submit, in response to something the user did, and without
`role="alert"` a screen reader announces nothing at all — the form simply seems
not to have responded.

The fix is not a pure find-and-replace. `FormError` renders an `Alert`, which
looks different from the tinted div, so the sweep is a deliberate visual change
across every form in the app and wants looking at rather than trusting. Either
restyle `FormError` to match the current block and swap the call sites, or keep
`Alert` and accept the new look everywhere at once.

## The account steps' password toggle and focus handling

Noticed reviewing Phase 7 step 4's join form, 2026-10-05. The join form copies
both from its siblings in `src/components/account/`, so it is consistent with
them; fix every step in one go, or none.

- **The show-password toggle cannot be reached by keyboard.** It carries
  `tabIndex={-1}`, so someone tabbing through the form goes from the password
  straight past it. The likely intent was a tab order of password then submit,
  but it leaves keyboard users no way to check what they typed. Drop the
  `tabIndex`.
- **Focus on mount uses a ref and an effect** where the dialogs use plain
  `autoFocus`, which does the same job in one attribute. Cosmetic, but it is
  three lines per step that read as if they do something more.

The missing `role="alert"` on their error blocks is the entry above.

## The waiting screen forgets the sender's name when a poll's invite read fails

`screenFor` in `src/routes/household-waiting.tsx` sets `senderEmail: null` when
`api.invites.list()` fails, so one dropped poll swaps the sender's address for
"The person who invited you" until the next good poll. Cosmetic.

Fix: when the list read fails, keep the `senderEmail` already on screen.

## Worker: issuing an invite does not check the address is an address

`POST /v1/invites` (`worker/src/routes/invites.ts`) accepts any non-empty string
as `recipientEmail`. The only shape check is the client's
(`recipientAddressProblem` in `src/lib/invite-sending.ts`), so anything other
than this app's form can create an invite to a non-address, and the worker then
tries to email it.

Fix: reject it with a 400 using the pattern `worker/src/routes/auth.ts` already
has as `EMAIL_REGEX`. Keep the client check: the per-user limit runs before the
handler, so a typo that reaches the worker still spends one of the five issues
an hour.
