# Phase 4 — Account creation at cloud-sync opt-in

- **Goal:** Opting into cloud sync collects email, password and recovery phrase, and provisions the household. First run is unchanged: open the app, set an opening balance, start budgeting. No email, no password, no account.
- **Files:** `src/routes/settings.tsx` (the sync opt-in flow gains account creation); new step components, likely `src/components/account/` (`password-step`, `recovery-phrase-step`); `src/hooks/use-app-config.ts` (init state gains `hasAccount`).
- **Gates:** Q1 (recovery phrase UX) — answered: display, "copy to your password manager" CTA, acknowledgement checkbox.
- **Size:** M
- **Deps:** [Phase 3](03_client_crypto_rewrite.md), [Phase 2](02_backend_schema_endpoints.md).

The password's only job is wrapping the keys for the cloud vault. It is not a local lock, and the copy should not imply it is. That is why it is collected here and not at first run: before you sync, it would protect nothing, and a 12-word recovery phrase is a heavy thing to hand someone with nothing yet to recover.

`src/components/first-run-wizard.tsx` (1,132 lines) is not touched. Neither are the landing page CTAs.

## Decisions to make

- **Where the opt-in lives.** Settings is the obvious home, but for a couple the trigger is "invite my partner", which is a different mental entry point to "back up my data". Two doors into the same flow, or one door with two labels?
- **What happens to existing local data at opt-in.** It becomes the household's first vault, which is the obvious behaviour. Worth confirming, because it is also the moment a second person is about to see it.
- **Recovery phrase timing.** Immediately after the password, or after the first successful sync? Deferring leaves a window where the account exists and is unrecoverable.
- **Whether "I have an account" needs a path from first run.** A second device, or a partner accepting an invite on a fresh install, both arrive that way and neither wants the budget wizard first.

## Open questions

- Does a local-only user ever get prompted about accounts, or is the opt-in purely something they go looking for?
- If someone opts in, syncs, then deletes their account, do they fall back to a working local-only app or a broken one?
