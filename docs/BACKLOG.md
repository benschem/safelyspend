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

## Nothing says you have changes to push, or that the household has newer ones

Raised 2026-10-10. Two people can now edit the same vault, and sync is by hand.
The sidebar says "Synced 2h ago" whether or not anything changed since.

Two states, neither tracked today:

- **You have changes you have not pushed.** Forget, and the other person works
  on old data.
- **The household vault is newer than yours.** The worse one. Edit on top of it
  and the next push answers 409, where the only choices are pull (lose yours)
  or overwrite (lose theirs). The vault is one blob, so nothing merges.

Likely shape:

- Unpushed changes: an amber dot and "Unsynced changes" on the existing
  `SyncStatus` in the sidebar. Quiet, because it is the normal state while
  editing. A banner would be up all session and stop being seen.
- Vault is newer: a banner with a Pull button. Check on load and on window
  focus with `api.vault.getMetadata()`, which already returns the version.
- Pushing automatically after edits would remove the forgetting altogether.
  Bigger, and conflicts then need a screen of their own. Decide separately.

To build it:

- Track unpushed changes with a Dexie write hook that sets a flag, cleared on a
  good push or pull. The pull's own import must not set it. It will not notice
  an edit that is undone, which is fine.
- `useSync` keeps its state in `useState`, so the sidebar and Settings each
  hold their own copy and a push from Settings does not update the sidebar.
  Move the shared parts to one store, as `key-vault.ts` does with
  `useSyncExternalStore`. Most of the work is here.

Not checked: that a pull replaces local data outright. Read `importAllData`
first.

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

## There is a way to sign in, and nothing that says sign up

Noticed at the start of the Phase 7 two-browser walkthrough, 2026-10-10.

A new person looks for "Sign up" or "Create account" and finds only sign in. The
flow does create accounts: `/login` takes an email and a code, and an address
with no account is carried on into choosing a password and a recovery phrase.
But nothing says so before the email is entered, so someone without an account
has no reason to think the sign-in door is theirs.

Directions, not yet decided:

- **Say it on the one screen**: a heading and a line that cover both, such as
  "Sign in or create an account", and "New here? Enter your email and we will
  set you up." The cheapest, and keeps the single flow.
- **A separate "Create account" entrance** that leads into the same flow with
  its own heading. Matches what people expect to see, at the cost of two
  entrances that behave identically, and of deciding what each says when the
  address turns out to be the other kind.

Whichever is chosen, an entrance must not reveal whether an address already has
an account: the worker answers the same for both until the code is passed, on
purpose. Belongs with the Settings entry above, since both are about where the
account is found.

## An invitee who loses their password before joining is stuck, and so is the household

Hit in the Phase 7 walkthrough, 2026-10-10: the invitee signed up in a private
window, the browser did not keep the generated password, and the member had
already approved them. **Traced through the worker, not exercised.**

Between signing up and joining, the invitee has their own `user_keys` rows and,
once approved, a lone `ecies` member key. Joining proves the current password
against the `pwd` user row before it uploads anything, so without the password
they cannot join. Nothing else gets them out:

- **Recovery cannot reset it.** `POST /auth/recovery-reset` requires
  `newMemberKeyPwd`, the household key re-wrapped under the new password. The
  invitee does not hold the household key yet, so there is nothing to wrap.
- **They cannot delete the account.** `DELETE /auth/account` needs a full
  session, which needs the password. A recovery session is refused.
- **The member cannot undo it.** Revoking a `completed` invite answers 409
  `INVITE_COMPLETED`, and the household now counts two members, so every new
  invite answers `HOUSEHOLD_FULL`. The second place is gone for good.

The phrase does still open the invitee's private key, which is all that is
needed to open the handoff. So the likely fix is to let recovery work in this
state: a reset that replaces the verifier and the `pwd` user row and leaves the
member key alone, after which they join with the new password. That means a
branch in `recovery-reset` (or a sibling route) for a user with no `pwd` member
row, and the matching branch in `login.tsx` and `buildPasswordResetMaterial`.

A cheaper stopgap is a way out instead of a way through: let the member remove
someone who has been approved but has not joined, which frees the place for a
fresh invite.

Until one of them exists, the only repair is by hand in the database.

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

## Form labels sit tight against their inputs

Noticed on the invite panel during the Phase 7 walkthrough, 2026-10-10. Only
that one label was fixed, by adding `block`.

The usual field markup is a wrapper with `space-y-2` (or `space-y-1.5`) holding
a label and an input. Tailwind 4 writes `space-y` as a bottom margin on every
child but the last, and here that child is the `<label>`: an inline element,
whose vertical margins the browser ignores. So the gap the class asks for never
appears, and the only space is line height.

About 35 places hand-write `<label className="text-sm font-medium">`: the
account steps, both wizards, the Settings dialogs, `password-dialog.tsx` and
`import-rules.tsx`. The shared `Label` in `src/components/ui/label.tsx` is
inline as well, so `FormField` is likely affected. Find the hand-written ones
with:

```bash
grep -rn "<label htmlFor" src
```

**Traced, not measured.** The mechanism comes from how Tailwind 4 defines
`space-y`; nobody has inspected the computed margins. Confirm on one form first.
Not every match is a field label: some wrap a checkbox and are fine as they are.

The fix is to add `block` to the shared `Label` and move the hand-written labels
onto it. It changes the spacing of every form at once, so it wants its own
commit and a look at each screen. Remove the one-off `block` in
`household-invites-panel.tsx` when it lands.

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

## Invite panel: what the first cut leaves out

- Send again button. Today it is Cancel then Send by hand. A button must handle
  the revoke landing and the issue failing (five issues an hour): the old link is
  dead and nothing replaced it.
- One row per address. Drop revoked and declined before picking the newest, and
  always show every live invite. The other order hides joined rows, and live
  invites that then cannot be cancelled.
- Confirm before cancelling someone who has already signed up. It strands their
  account.
- Hide the form when the household is full. Needs the worker to report the member
  count: a `completed` invite outlives the joiner deleting their account.

## The approval dialog shows two numbers and invites comparing them

Found in the Phase 7 walkthrough, 2026-10-10: the maintainer read the dialog's
two safety numbers as a pair that should be equal, and reported a mismatch on a
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

This narrows the Phase 7 step 4 decision "both safety numbers on both screens",
which was made for the invitee's side. Left until after the walkthrough's first
pass, so a failure in the handoff could not be blamed on the change.

## Approving an invitee: what the first cut leaves out

- Tell the member someone is waiting, wherever they are in the app. Today they
  only find out by opening Settings, so an invitee can sit on the waiting screen
  until one of them thinks to ask the other.
- Say what went wrong when an approval fails. Today every failure reads "try
  again", including a cancelled invite and a full household, where trying again
  can never work.
- Give "the numbers do not match" its own answer. Today the member cancels and
  is told nothing about what a mismatch means or what to do next.
- Let the member see their own safety number after the dialog closes. Raised
  again in the walkthrough, 2026-10-10: the member approves and closes the
  dialog, the invitee's screen is still asking them to confirm the member's
  number, and the app shows that number nowhere else. Approve cannot be pressed
  again to bring it back, because the invite is already `completed`.

  Blocking the dismiss is not the fix. A reload or a closed tab dismisses it
  anyway, and the invitee may not join for days, which is by design. Make the
  number retrievable instead: while someone is approved but has not joined, the
  invite row says so and shows the member's number whenever the vault is
  unlocked, with "read this to them when they ask". Once they have joined it is
  a plain joined row.

  Telling the two apart needs the worker to report whether a member has finished
  joining. The invite becomes `completed` on approval, not on joining, so the
  panel has no signal today. Without that, show the number in the panel
  whenever the vault is unlocked. Goes with the one-number-per-screen entry
  above: after approving, the member's number lives on the row, not in a dialog.

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

## Active Sessions: the Revoke button loses its name while it works

In `src/routes/settings.tsx` the button's label is swapped for a spinner, so a
screen reader hears an unnamed button. Keep the label beside the spinner, as
the invite panel's Cancel button does.

## The dev console is noisy on `/login`

Seen in Firefox at the start of the Phase 7 two-browser walkthrough, 2026-10-10.
None of it broke anything, but four lines of standing noise make a real error
easy to miss. Only the last is known to be the app's own.

- **`/pa-stats/js/script.manual.js` fails to load.** Expected: the proxy is a
  Netlify redirect and does not exist in dev (`DEVELOPMENT.md` says so). To
  quieten it, leave the script tag out of the dev page.
- **A source map error for `installHook.js.map`.** The React DevTools extension,
  not the app. Nothing to fix; listed so nobody chases it.
- **The CSP blocks an `eval` at `util.js:157`** (`script-src` has no
  `unsafe-eval`, on purpose). Source not traced. Most likely an extension or a
  dev-only dependency. Check whether it appears in a clean browser profile and
  in a production build before deciding it matters; the answer is never to add
  `unsafe-eval`.
- **"Select is changing from uncontrolled to controlled."** A real React
  warning: some `Select` starts with an undefined value and is given one later.
  Not traced to a component. Give it a defined initial value.

## Forms: move to React 19 form actions

Every form tracks its own loading flag and calls `preventDefault` by hand.
`useActionState` replaces both, and `useFormStatus` allows one shared submit
button in place of the spinner block copied into each form.

Use them for new forms. Convert old ones when they are next rewritten, starting
with `login.tsx` when its state is reworked. Not worth a sweep on its own.

- A form action resets uncontrolled fields when it finishes, even on a returned
  error. Keep inputs controlled, or a failed submit wipes what was typed.
- An error thrown in an action reaches the error boundary. Return failures as
  state instead.
- Buttons outside a form need `useTransition`; `useActionState` does not cover
  them.
