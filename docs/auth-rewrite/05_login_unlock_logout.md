# Phase 5 — Cloud login and logout

**Status: built, 2026-09-16**, in five commits `0392e7a`..`96c9a08`, plus this note, the
0.41.0 bump that follows it, and one fixup folded into Phase 4's `7d981d2`. Pushed, and
the worker deployed alongside it. What landed and where it differs
from the plan below is in "[What was actually built](#what-was-actually-built)" at the
end; everything above that section is the plan as written, left alone.

**Built is not verified.** Nothing in this phase has run against a live server, and the
one screen anyone has looked at was reached by temporarily hard-coding the step. See
"[What has and has not been exercised](#what-has-and-has-not-been-exercised)".

- **Goal:** Log in to cloud sync with email OTP *plus* a password proof, so control of the inbox alone is not enough to reach the vault.
- **Files:** rewrite `src/routes/login.tsx` (418 lines; a three-step flow replaces the single verify call); `worker/src/routes/auth.ts` (JWT gains `hid`); `src/hooks/use-sync.ts` (key bundle handling on login).
- **Gates:** none outstanding. Q6 is locked — JWT and MasterKey lifetimes are independent.
- **Size:** S–M
- **Deps:** [Phase 3](03_client_crypto_rewrite.md), [Phase 2](02_backend_schema_endpoints.md).

## Scope, after the v1 cut — and after Phase 4 took the login branch

**The login branch is built.** [Phase 4](04_onboarding_rewrite.md) shipped it on
2026-09-15 along with the shell, under the licence this doc gave it below. It was cheap
because `/auth/login-complete` returns the key bundle inline, so unlocking is
derive-and-unwrap with no extra round trip. The old `restore` screen went with it, folded
into the same password prompt.

**What is actually left for this phase:** the recovery redemption screen, and deciding
what logout claims.

Also already answered, by being built:

- **A failed verifier consumes the bridge token — confirmed**, not softened to a few
  attempts. `login.tsx` routes back to the code step with copy saying the code was spent,
  and `EnterPasswordStep`'s `sign-in` mode warns before the password is typed. If that
  turns out to be as annoying in practice as §3.3 predicts, allowing retries is a server
  change, not a client one.
- **`rememberMe` is offered on sign-in and not at signup.** The original question below
  — whether it means anything without a local lock — is still open in principle; in
  practice it is the difference between a 7-day and a 30-day session, which is real
  enough to keep the checkbox.
- **A local re-unlock needs no OTP.** `useSync().unlockWithPassword` fetches
  `/auth/key-bundle` against the live JWT and unwraps. That is Q6 working as specified.

The original scoping note follows, since it is what the split was reasoned from.

[Phase 4](04_onboarding_rewrite.md) builds the auth shell — the email and code steps —
and the signup branch, because `/auth/verify-otp` returns `verifierSalt: null` to
distinguish the two and building the shell twice would mean rewriting it here. What is
left for this phase is the login branch, the recovery redemption screen, and logout.

**Recovery redemption stays in v1.** Handing someone twelve words they cannot actually
use is worse than handing them nothing. The crypto is built
([Phase 3](03_client_crypto_rewrite.md)) and so is `POST /v1/auth/recovery-reset`, so
this is one screen: enter the phrase, unwrap, set a new password, upload the new
password-wrapped rows.

If the login branch is cheap once Phase 4's shell exists, take it there instead. The
phase boundary is a planning artefact.

## The shape

Three calls where there are currently two, per Phase 2 §3.1–§3.3: request the OTP, exchange the code for a short-lived bridge token plus the verifier salt, then send the Argon2id verifier and receive the session and key bundle. The salt only appears after the code checks out, so it cannot be used to probe which emails have accounts.

The MasterKey is unwrapped client-side from the returned key bundle and lives in memory until the tab closes. The server never sees it and has no idea whether the client currently holds it.

There is no local unlock step — nothing on the device is encrypted. See [Phase 3](03_client_crypto_rewrite.md).

## Decisions to make

- ~~**A failed verifier consumes the bridge token**~~ — confirmed as built, see above.
- **Logout semantics.** Phase 2 §2.3 has logout clearing the server session and cookie while leaving the MasterKey in memory. With nothing encrypted locally, "logged out" and "logged in" look nearly identical to someone still holding all their data. Decide what the UI actually claims.

  **Phase 4 pre-empted half of this and it is worth re-examining rather than inheriting.**
  `useAuth().logout` now calls `lockKeyVault()`, as account deletion does. The reasoning
  was that Q6 decouples the JWT and MasterKey *lifetimes* — a session expiring should not
  lock the vault — which is not the same as an explicit logout leaving decryption keys in
  memory with nothing left to decrypt against. `key-vault.ts` contradicts itself on this
  point in its own doc comment, so the decision is a reading, not a citation. If the
  reading is wrong, the change is one line.
- **What a couple sees when the other person's session does something visible.** A new vault version arriving mid-session is the common case, and it is the same question as the two-writer conflict in [Phase 8](08_household_ui_scope.md).

## Open questions

- Should the app work fully offline once logged in? It does today because everything is local. Nothing here changes that, but it becomes a promise worth stating rather than an accident.
- Is `rememberMe` meaningful when there is no local lock to contrast it with?

---

## What was actually built

Four commits, `0392e7a`..`96c9a08`, plus a fixup folded back into Phase 4's `7d981d2`.

- `0392e7a` `feat:` unlock and rewrap keys from the recovery phrase
- `4e854f5` `feat:` the two recovery endpoints in the API client
- `3331bc3` `feat:` the forgot-password branch and its two screens
- `96c9a08` `docs:` a new `BACKLOG.md` entry found while building it

This note and the 0.41.0 bump follow, and are deliberately not listed by SHA. A doc that
names the commits after itself cannot be corrected without rewriting them, which changes
the SHAs it just named. Phase 4's list stops in the same place for the same reason.

The logout decision needed no commit of its own — see below.

### The flow

Reached from a **Forgot your password?** link on the sign-in password step, which is
offered only in `sign-in` mode: recovery spends the bridge token, and an `unlock` has
none to spend.

```
password step ──► phrase ──► login-complete (via: recovery) ──► unwrap locally
                                                                     │
                              new password ──► recovery-reset ──► sign in again
```

### Where it differs from the plan

**A wrong phrase does not burn the emailed code.** The plan assumed it would, by
analogy with a wrong password. It does not have to: the bridge token is spent fetching
the key bundle, and whether the phrase opens it is decided in the browser. So
`login.tsx` keeps the bundle in state and every attempt after the first is free, with no
server contact at all. Only a phrase that is valid BIP-39 *and* belongs to another
account gets that far, since the checksum stops a typo before anything is sent.

**After a successful reset the user signs in again**, rather than being carried into the
app. The `rec` session reaches only `/auth/key-bundle` and `/auth/recovery-reset`, so
carrying it forward would mean a signed-in state that fails at everything else. The
alternative — having the server upgrade the session on a successful reset — was
rejected as a worker change on a client-only phase, for a flow people will use once.

**`useAuth().logout` is called afterwards, not `api.auth.logout`.** This matters: if the
`rec` cookie survives, the `isAuthenticated` effect at the top of `login.tsx` drops the
user at the unlock prompt, and `/auth/key-bundle` *does* answer a recovery session — so
they would unlock successfully into an app that cannot push or pull. Nothing calls
`checkAuth()` on the logout-failure path, deliberately: `/auth/me` has no
`requireFullSession`, so asking would report a live session and cause the exact walk-in
this avoids.

**Logout semantics: the code was already right, only the comment was wrong.** Phase 4's
reading survived re-examination. The MasterKey exists solely to encrypt the vault for
sync — IndexedDB is plaintext on disk either way — so after a logout it can do nothing,
and holding it is liability with no purpose. Q6's independence is about *lifetimes*: a
session expiring should not lock the vault. A user pressing Log out is not a lifetime
elapsing. `key-vault.ts` claimed the opposite in its own doc comment; that correction
was folded into `7d981d2`, the commit that introduced the contradiction.

**Three guards that were not in the plan**, each because a structural failure would
otherwise have reached the user as "your recovery phrase is wrong" — the worst sentence
this flow can say, on the last way in:

- `assertBip39Kdf`, the recovery-side counterpart to `assertSameKek`. A row naming some
  other KDF cannot open under `deriveRecoveryKek`.
- `isValidRecoveryPhrase` inside `unlockKeyBundleWithPhrase`, not only in the form.
  `deriveRecoveryKek` throws a bare `Error` on a failed checksum, which is neither type
  the screens branch on.
- `normaliseRecoveryPhraseInput`, which case-folds on the way in. The BIP-39 wordlist is
  lowercase and `normaliseMnemonic` does not case-fold, so a phone autocapitalising the
  first word would read as a wrong phrase.

**Two components gained modes rather than being duplicated.** `CreatePasswordStep` takes
`mode: 'signup' | 'reset'`, mirroring `EnterPasswordStep`'s existing pair; the reset copy
says the recovery phrase still works, because someone who has just used theirs will
assume they have spent it. They have not: the server never touches the recovery rows.

### What has and has not been exercised

**Unit-level only.** 16 new client tests, 460 passing in total, 188 worker tests
untouched and passing. `npm run lint` and `npm run build` clean at every commit.

**The entry screen has been seen once, in a dev server**, by temporarily hard-coding the
initial step — the email and code steps need a worker. Confirmed there: the checksum
rejects twelve real words that do not add up, without contacting the server, and a
capitalised first word is folded rather than rejected. That scaffolding was reverted
before the commit.

**Nothing else has run.** No recovery login, no reset, no round trip of any kind. The v2
worker is deployed, so the live API can serve this flow — it simply has not been asked
to.

The walkthrough this phase needs, on top of Phase 4's outstanding one:

1. Sign up, keep the phrase, push a budget.
2. Sign in, claim to have forgotten the password, redeem the phrase.
3. Get the phrase wrong first, and confirm the retry costs no new code.
4. Set a new password, confirm the forced sign-in afterwards works with it.
5. Confirm the **old** phrase still works after the reset — the one claim the UI makes
   that nothing client-side can verify.
6. Confirm the old password no longer does.

### Still open

Both original open questions survive untouched. `rememberMe` is offered on sign-in and
remains a 7-day/30-day choice with no local lock to contrast it against; the offline
question is still a promise nobody has written down.
