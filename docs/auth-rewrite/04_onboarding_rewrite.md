# Phase 4 — Onboarding rewrite

- **Goal:** Account creation is the first screen for every new install. Collect password + recovery phrase. No cloud opt-in here.
- **Files:** restructure `src/components/first-run-wizard.tsx` (likely split: `account-step`, `password-step`, `recovery-phrase-step`, then the existing budget setup steps); `src/components/landing-page.tsx` (CTA changes from "View Demo" / "Log in" to "Create Account" / "I have an account"); `src/App.tsx` routing; `src/hooks/use-app-config.ts` (new init state covers `hasAccount`, `recoveryAcknowledged`).
- **Gates:** Q1 (recovery phrase UX — write-down vs verify-on-next-launch vs "I saved it to my password manager" path).
- **Size:** L
- **Deps:** [Phase 3](03_client_crypto_rewrite.md) (must be able to generate keypair + master key + wrapped artefacts).

The wizard ends with a local-only account; sync opt-in (which collects email + sends OTP + stores wrapped material server-side) is a separate later flow in Settings, gated by [Phase 2](02_backend_schema_endpoints.md).
