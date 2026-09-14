# Phase 5 — Cloud login and logout

- **Goal:** Log in to cloud sync with email OTP *plus* a password proof, so control of the inbox alone is not enough to reach the vault.
- **Files:** rewrite `src/routes/login.tsx` (418 lines; a three-step flow replaces the single verify call); `worker/src/routes/auth.ts` (JWT gains `hid`); `src/hooks/use-sync.ts` (key bundle handling on login).
- **Gates:** none outstanding. Q6 is locked — JWT and MasterKey lifetimes are independent.
- **Size:** S–M
- **Deps:** [Phase 3](03_client_crypto_rewrite.md), [Phase 2](02_backend_schema_endpoints.md).

## Scope, after the v1 cut

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

- **A failed verifier consumes the bridge token**, so a mistyped password means fetching a fresh code from the inbox. That is deliberate (Phase 1 §3.3) and it will be annoying at least once. Confirm, or allow a small number of verifier attempts against one bridge token.
- **Logout semantics.** Phase 2 §2.3 has logout clearing the server session and cookie while leaving the MasterKey in memory. With nothing encrypted locally, "logged out" and "logged in" look nearly identical to someone still holding all their data. Decide what the UI actually claims.
- **What a couple sees when the other person's session does something visible.** A new vault version arriving mid-session is the common case, and it is the same question as the two-writer conflict in [Phase 8](08_household_ui_scope.md).

## Open questions

- Should the app work fully offline once logged in? It does today because everything is local. Nothing here changes that, but it becomes a promise worth stating rather than an accident.
- Is `rememberMe` meaningful when there is no local lock to contrast it with?
