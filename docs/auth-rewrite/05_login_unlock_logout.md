# Phase 5 — Cloud login and logout

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
