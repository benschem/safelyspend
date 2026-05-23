# Phase 5 — Login / unlock / logout with session timeout

- **Goal:** Two distinct sessions: (a) **local unlock** that decrypts IndexedDB on app open, (b) **cloud auth session** for the worker (still email-OTP, now binding to a household).
- **Files:** rewrite `src/routes/login.tsx` (or split — `routes/unlock.tsx` for local, `routes/login.tsx` for cloud); new `src/hooks/use-unlock.ts` and lifecycle wiring in `src/App.tsx`/root layout; `worker/src/routes/auth.ts` (JWT payload may gain `householdId`, session lifetime semantics revisited).
- **Gates:** Q6 (how long is the local unlock cached — until tab close? configurable idle timeout? what's the relationship to JWT "remember me"?).
- **Size:** M
- **Deps:** [Phase 3](03_client_crypto_rewrite.md), [Phase 2](02_backend_schema_endpoints.md).
