# Phase 4 — Account creation at cloud-sync opt-in

**Status: built, 2026-09-15**, in six commits ending `3c9b2f9`, pushed and deployed.
What landed and where it differs from the plan below is in
"[What was actually built](#what-was-actually-built)" at the end; everything above that
section is the plan as written, left alone.

- **Goal:** Opting into cloud sync collects email, password and recovery phrase, and provisions the household. First run is unchanged: open the app, set an opening balance, start budgeting. No email, no password, no account.
- **Files:** new `src/lib/base64url.ts`; `src/lib/api-client.ts` (the v2 auth surface); new `src/lib/account.ts` (assembles a signup payload from the Phase 3 primitives); rewrite `src/routes/login.tsx` as the shared auth shell; new `src/components/account/` step components; `src/components/dialogs/password-dialog.tsx` (create mode goes); `src/routes/settings.tsx` (the opt-in door); the first-run entry point (an "I already have an account" link).
- **Gates:** Q1 (recovery phrase UX) — answered: display, "copy to your password manager" CTA, acknowledgement checkbox.
- **Size:** M
- **Deps:** [Phase 3](03_client_crypto_rewrite.md), [Phase 2](02_backend_schema_endpoints.md).

The password's only job is wrapping the keys for the cloud vault. It is not a local lock, and the copy should not imply it is. That is why it is collected here and not at first run: before you sync, it would protect nothing, and a 12-word recovery phrase is a heavy thing to hand someone with nothing yet to recover.

`src/components/first-run-wizard.tsx` (1,132 lines) is not touched beyond the one link below. Neither are the landing page CTAs.

## Signup and login are one route, not two

`POST /v1/auth/verify-otp` returns `verifierSalt: null` for a user who has requested a
code but never completed signup, and a real salt for one who has
(`worker/src/services/users.ts:253`). The worker's own comment calls this out: it is not
an error condition, it is how the client routes itself.

So there is one flow with one branch:

```
email ──► code ──► verify-otp
                       │
      verifierSalt === null ──► password + confirm ──► recovery phrase ──► signup
                       │
      verifierSalt !== null ──► password ──► login-complete      (Phase 5)
```

Phase 4 builds the shell and the signup branch. [Phase 5](05_login_unlock_logout.md)
fills in the login branch, which is the shorter half. Building the shell twice would
mean writing the email and code steps twice and rewriting them in Phase 5, so it lands
here.

**If the login branch turns out to be an hour's work once the shell exists, do it here.**
The phase boundary is a planning artefact, not a rule. `00_overview.md` has the app
shipping sooner rather than in the right order.

## Decisions, resolved

**Where the opt-in lives.** Its own route, reached from the existing "Set Up Cloud Sync"
button in Settings. Not a dialog inside `settings.tsx` — that file is already 1,652
lines and a password-then-recovery-phrase sequence is not dialog-shaped.

The second door — "invite my partner", which also has to provision an account before it
can do anything — is [Phase 7](07_invite_flow.md)'s to add, pointing at this same flow.
Phase 4 does not ship a button that does nothing.

**Existing local data at opt-in.** It becomes the household's first vault. Confirmed —
it is the obvious behaviour and there is no alternative that is not worse. The copy
should note it, because this is also the moment a second person is about to be able to
read it.

**Recovery phrase timing. Not actually a decision.** `/auth/signup` calls
`parseKeyPair(body['userKeys'], …)`, which rejects anything that is not exactly a
`{pwd, recovery}` pair (`worker/src/lib/key-material.ts:263`). The recovery-wrapped rows
are mandatory in the same call that creates the account, so the phrase has to be
generated and acknowledged **before** the account exists. Deferring until after the
first sync would need a second endpoint, which is not built and should not be. The
window where the account exists and is unrecoverable never opens.

**"I have an account" from first run.** Yes — a quiet link from the first-run entry
point to the auth flow. This is not a nice-to-have: it is how a partner gets in on their
own phone and how the maintainer gets in on a second device. Without it they land in the
opening-balance wizard with no way out. The link only has to exist and route; the login
branch behind it does not work until Phase 5, and nothing is pushed until it does.

**Password policy: minimum 12 characters, no strength meter.** `crypto-design.md` §8 is
right that a length floor buys close to nothing against a dictionary run on a
human-chosen password, and `zxcvbn` is the conventional answer. It is also a dependency
and a lazy-loaded dictionary bought to protect two people who both use a password
manager. `00_overview.md` defers it; the copy carries the weight instead, pointing at a
generated password. Revisit on the same trigger as `crypto-design.md` §3.4 — the day
there are users who are not the maintainer.

This closes the open issue in `../crypto-design.md` §8. Record the number there too, so
the design doc stops saying no policy exists.

## Open questions, resolved

**Does a local-only user ever get prompted about accounts?** No. No nag, no banner, no
interstitial. The opt-in is in Settings and on the landing page, and someone who never
goes looking never sees it. The app works without an account and should not imply
otherwise.

**If someone opts in, syncs, then deletes their account, do they fall back to a working
local-only app?** They must. Account deletion tears down the server side; IndexedDB is
untouched, so the budget is still there. What the client owes is clearing the sync
localStorage keys and locking the key vault so the UI stops claiming a cloud connection
that no longer exists. `useAuth().deleteAccount` already clears the two storage keys —
**verify it also locks the key vault**, and that Settings returns to the "Not connected"
state rather than a half-signed-in one.

## Carried forward from Phase 3

**`password-dialog.tsx` promises data loss that will no longer be true.** The create-mode
warning reads "If you forget this password, your cloud data cannot be recovered. Write
it down." Once the recovery phrase ships, that is false in the direction that matters —
it tells someone their data is gone when it is not, and it undercuts the phrase they
were just asked to store.

**The fix is deletion, not a rewrite.** Under this phase the password is collected in
the signup flow, not in a dialog. The dialog's `create` mode has no remaining caller;
strip it and leave `unlock`, which is [Phase 5](05_login_unlock_logout.md)'s local
re-unlock prompt. A mode with no call site is the thing that gets resurrected later with
its stale copy intact.

## What has to be built

1. **`src/lib/base64url.ts`.** Every binary field on the wire is base64url
   (`02_backend_schema_endpoints_design.md` §11 fixes it; `worker/src/lib/bytes.ts` is
   the server's half). The client has no encoder — `src/lib/bytes.ts` is `concatBytes`
   and nothing else, and deliberately so. New module rather than a third concern in
   `bytes.ts` or a general-purpose export from `envelope.ts`.

2. **`src/lib/api-client.ts` — the v2 auth surface.** `auth.verify` calls
   `/v1/auth/verify`, which no longer exists. Replace it with `verifyOtp`,
   `loginComplete`, `signup`, `signupWithInvite` and `keyBundle`. `use-auth.ts` consumes
   `verify` and has to move with it.

3. **`src/lib/account.ts` — signup payload assembly.** The one piece Phase 3 did not
   build: generate the keypair, MasterKey and both salts; derive KEK_pwd and the
   verifier; derive KEK_rec from the phrase; wrap PrivKey and MasterKey under each; and
   encode the whole thing. Keeping it out of the route component means it is testable
   without rendering anything, and it is the only place that knows the payload shape.

   A client-generated UUID for the household id, per the locked conventions.

4. **The auth shell and the signup steps.** `src/routes/login.tsx` rewritten to the
   three-step shape above, with step components under `src/components/account/`:
   `password-step` (password, confirm, the 12-character floor, the password-manager CTA)
   and `recovery-phrase-step` (the phrase, a copy button, the acknowledgement checkbox,
   and no way past without ticking it).

   The phrase is shown once and stored nowhere — not in state that outlives the step,
   not in `sessionStorage`, not in the URL.

5. **First push.** Signup returns a session; the local budget then goes up as vault
   version 1. A signup that succeeds and leaves the vault empty is a worse state than
   either end of it, so the push is part of the flow, not a thing the user does next.

6. **The two copy changes** — Settings' opt-in door, and the first-run link.

## `hasAccount` is not needed

The stub proposed adding `hasAccount` to `use-app-config.ts`'s init state. It is
redundant: whether a server account exists is what `useAuth` already answers from
`/auth/me`, and a second local copy of that fact can only drift out of agreement with
it. Skip it unless something concrete needs to know the answer offline.

## Verification

Per `00_overview.md`: manual walkthrough in the browser, plus the suite for anything
touched. Specifically worth exercising, because each one can look right and be wrong:

- A signup whose password contains combining characters unlocks afterwards. NFKD
  normalisation is applied once, in `deriveKek` — a password that normalises differently
  on the second pass is a permanently unopenable vault.
- The recovery phrase step cannot be skipped, and the phrase is not recoverable from
  anywhere in the app once dismissed.
- An account created here produces `user_keys` and `household_member_keys` rows of both
  kinds. A partial write is rejected server-side, so this is really a check that the
  client sends both.
- Signup, then delete the account, then confirm the app still opens and the budget is
  intact.
- A wrong password on the login branch — once it exists — reports incorrectly-typed
  rather than something structural. `VERIFIER_MISMATCH` is the code.

Unit tests belong on `account.ts` and `base64url.ts`, which are pure and where a bug is
expensive. The step components get whatever the existing component tests do, and no
more.

## Version and changelog

This is the first phase with something user-visible to say, so
[Phase 3](03_client_crypto_rewrite.md)'s deferral ends here. Bump the version and write
one changelog entry when the flow lands, in the terms `CLAUDE.md` asks for: what someone
can now do, not what was built.

Shipped as **0.40.0**.

---

## What was actually built

Six commits, `613b0e2`..`3c9b2f9`. Each one typechecks and passes the suite on its own,
not just the final state.

- `613b0e2` `feat:` the base64url codec
- `814d4f3` `fix:` `isWrongKey` in both runtimes — see below, this one is not Phase 4's
- `7d981d2` `feat:` the account flow (the bulk)
- `a1b37d9` `feat:` the Settings and first-run doors
- `9d80451` `docs:` `BACKLOG.md`
- `3c9b2f9` `chore:` 0.40.0

### The login branch landed here too

The plan permitted this if it turned out cheap once the shell existed, and it did:
`/auth/login-complete` returns the key bundle in the same response, so unlocking is
derive-and-unwrap with no extra round trip. [Phase 5](05_login_unlock_logout.md) is
correspondingly smaller — recovery redemption and logout semantics are what is left.

**The old `restore` step is deleted**, not kept alongside. It was a second password
prompt for the case "signed in, no local budget", which is now the `unlock` mode of
`EnterPasswordStep`: same component, same destination logic, one code path. A device
with a budget on it still never pulls automatically.

### Three things the plan did not anticipate

**One KEK does not automatically open both rows.** `unlockKeyBundle` derives from the
`user_keys` row and was using that key on the `household_member_keys` blob too. That
holds only because signup writes the same metadata to both tables — and the Argon2id
rolling upgrade (`crypto-design.md` §3.4) is precisely the thing that could re-wrap one
and not the other. Unguarded, the divergence surfaces as an AES-GCM tag failure and
reaches the user as "wrong password" against a password that was right. `assertSameKek`
compares the three KDF columns before either row is opened; it costs a string comparison
rather than a second 130 ms derivation.

**A failed first push is not a failed signup.** Both were originally inside one `try`
with one message. Once `/auth/signup` returns, the account exists and the bridge token is
spent, so "could not create your account, try again" is advice that cannot work. The push
now warns and the flow continues.

**Signup must not ask the server what is in the vault.** An early version routed signup
through the same destination helper the sign-in path uses. That helper reads the vault
version — which `push()` had just set to 1 — so on a device that has not been set up it
would have pulled back the empty bytes uploaded a line earlier, marked the database
initialised, and walked the user past the opening-balance wizard into an empty app.
Signup navigates directly; only sign-in and unlock arrive at a vault they have not seen.

### `isWrongKey` was broken, and is a `fix:` of its own

Not Phase 4's code and not in this plan. `isWrongKey` guarded on
`instanceof DOMException`; a browser's Web Crypto rejects with one and Node's does not,
so the predicate answered `false` under test and `true` in production. It shipped in
Phase 3 with no test, so nothing noticed, and the wrong-key message on `pull()` has only
ever been reachable in a browser. Now matched on `name`, with two tests, one driving a
real failed decrypt.

It is committed separately and lands *before* the feature, because Phase 4's tests depend
on the predicate working.

### Smaller deviations

- **Vault subscription moved into `key-vault.ts`.** It was a listener set in
  `use-sync.ts`, which meant a caller could mutate the vault and leave the UI showing it
  locked. Now every mutation notifies, and `setMasterKey`/`setPrivateKey` are replaced by
  one `unlockKeyVault`.
- **`WrongPasswordError` is a class**, not a shared message string. Two call sites branch
  on the condition and branching on wording breaks silently when the wording changes.
- **Logout locks the key vault**, as account deletion does. Q6 makes the JWT and the
  MasterKey independent *lifetimes*; that is not the same as leaving decryption keys in
  memory after an explicit logout. Flagged in case anyone reads Q6 the other way.
- **`signupWithInvite` is built but unexercised.** Phase 7 is its only caller and has not
  been written, so nothing in `src/` invokes it and nothing has run it against the live
  worker. Its field names are transcribed from `worker/src/routes/auth.ts` rather than
  verified; its doc comment says so.
- **`rememberMe` is offered on sign-in only.** Signup takes the 7-day default rather than
  deciding a session length on the user's behalf at a moment they have no context for.
- **The household is named `"Household"`** with no UI, per the v1 rename deferral.
- **`hasAccount` was not added**, as the plan concluded.

### Verification — half done

Done: unit tests on `account.ts` (20) and `base64url.ts` (23), plus the two new
`isWrongKey` tests. 444 client tests pass; the worker's 188 are untouched and still pass.
The NFKD case from the list above is a real test — a password typed decomposed unlocks
when retyped composed. So is the recovery-phrase-alone unlock, and the both-row-kinds
check. Mutation-tested: reusing one salt for both derivations, and dropping the base64url
padding strip, each fail tests that would otherwise pass.

**Still not done, and no longer blocked:** the manual browser walkthrough. The worker is
deployed, so this is now a gap in testing rather than an impossibility. Specifically
outstanding from the list above — a real signup writing `user_keys` and
`household_member_keys` rows of both kinds server-side, and signup-then-delete leaving a
working local-only app. Nothing in this phase has yet spoken to a live server.
