# Phase 7 — Invite flow (UI + backend + email)

- **Goal:** Existing member invites a partner by email. Three acceptance paths land. Asymmetric master-key handoff completes once the recipient sets a password.
- **Files:** `worker/src/routes/invites.ts` (issue / list / accept / revoke); Resend email template; `src/routes/settings.tsx` (invite section — send invite, list pending invites); new `src/routes/accept-invite.tsx`; in-app banner component for path #2 (account exists, invite auto-attached on signup); `src/hooks/use-invites.ts`; client-side "pending handoffs" worker that, on every cloud login of an existing member, checks for invitees with a pubkey but no wrapped master key and writes one.
- **Gates:** Q2 (when does the existing member's client perform the wrap — on next login? polling? dedicated endpoint that surfaces "handoffs you owe"?).
- **Size:** L
- **Deps:** [Phase 2](02_backend_schema_endpoints.md), [Phase 3](03_client_crypto_rewrite.md), [Phase 4](04_onboarding_rewrite.md).

Reference: `../searchyourstuff/app/models/{house,invite,user}.rb` and `app/models/concerns/invitable.rb` — sweep-on-signup pattern is the model.
