# Faster tests, and a pre-push hook runs every check

- **Status:** in progress. Steps 1 and 2 done, step 2 as three commits.
  Step 3 not started.
  `@cloudflare/vitest-plugin` 1.4.0 was under 7 days old on 2026-10-15, so
  the worker is on 1.3.7. Step 3 may move it.
- **Goal:** the whole suite, frontend and worker, runs from one command in
  well under ten seconds, and nothing reaches GitHub, and so Netlify, without
  passing lint, the type-checks, Prettier's check, every test and
  `npm audit`.
- **Touches:** `src/__tests__/lib/account.test.ts`, `src/lib/account.ts`,
  `worker/src/__tests__/`, `docs/reference/DEVELOPMENT.md`,
  `worker/README.md`, `package.json`,
  `worker/package.json`, `worker/src/`, `vitest.config.ts`,
  `worker/vitest.config.ts`, a new `.githooks/pre-push`, a new `.nvmrc`,
  `README.md`, `CLAUDE.md`.

## Why

Nothing enforces lint, types, formatting, tests or the audit. There is no
hook and no `.github/` folder, and a push to `main` deploys to Netlify
straight away.

## Baseline

Measured on 2026-10-14 on an 8-core Mac, before step 2.

- **Root:** 13.2s wall clock, 35 files, 812 tests, all passing.
- **Worker:** 3.9 to 4.2s, 8 files, 189 tests, all passing. About 2s of that
  is Miniflare starting up.
- **Both in turn:** about 17s.

Vitest runs files in parallel, so the root's wall clock is its slowest file.

- `account.test.ts` takes 12.1s, and 11s run alone, so it is not contention.
  Every signup, unlock and reset in it runs Argon2id at `ARGON2ID_PARAMS`
  (64 MiB, 3 iterations), 300 to 900ms a test. Its `ARGON2ID_TIMEOUT_MS`
  comment says about 130ms a derivation, which is out of date.
- `argon2-conformance.test.ts` takes 3.2s. It runs the reference vectors,
  one at 256 MiB, at full cost on purpose.
- The other 33 files each take under 0.25s.

## After step 2

Measured on 2026-10-15 on the same Mac. One root run covers both: 43 files,
1001 tests, 6.1s wall clock. `account.test.ts` takes 0.4s. The slowest file is
`argon2-conformance.test.ts` at 3.1s, and the rest is fixed startup: workerd,
transforms and happy-dom across 8 threads.

## Decided

- `account.test.ts` swaps `ARGON2ID_PARAMS` for fast parameters with
  `vi.mock` and `importOriginal`, rather than adding a `params` argument to
  `buildSignupMaterial` and the rest. A production signature should not grow
  an argument only tests use.
- Signup and password reset in `account.ts` pass `ARGON2ID_PARAMS` to
  `deriveVerifier` and `deriveKek` explicitly, instead of relying on their
  default. The parameters written into the rows and the parameters used to
  hash are then the same expression, and the mock reaches both. Unlock reads
  its parameters from the row.
- Full-cost Argon2id stays covered by `argon2-conformance.test.ts` and by the
  test in `key-management.test.ts` that pins `ARGON2ID_PARAMS`.
- The worker is on vitest 4.1 and `@cloudflare/vitest-plugin`, the renamed
  `@cloudflare/vitest-pool-workers`, and runs as a project of the root
  vitest run. No separate script.
- `npm run typecheck` checks the app and the worker in one `tsc -b . worker
  --noEmit`. `build` keeps checking only the app, because Netlify runs it
  without the worker's packages installed.
- The plugin isolates storage per test file, not per test. Rate-limit
  counters were the only state that leaked, and `resetRateLimits` clears them
  before each test in the three route files. The suite also passes shuffled.
- The worker's quota test uploads 45 MB on purpose and takes 0.85s. It stays.
- A pre-push hook, not GitHub Actions. A push to `main` deploys, so a check
  that runs after the push reports too late. The hook stops the push. Actions
  can be added later if the hook proves not to be enough.
- The hook lives in a committed `.githooks/` folder, switched on per clone
  with `git config core.hooksPath .githooks`. Plain git, no dependency. No
  `prepare` script, because that would also run in Netlify's build.
- One `npm run check` holds the list of checks, and the hook only calls it.
- `npm audit` blocks the push, at `--audit-level=high` as the existing
  `audit` script has it, in both the root and `worker/`, which has its own
  lockfile. No feature outranks shipping a known high-severity hole.
- When the audit fails, the check prints what to do:
  - bump the package, and if the fixed version is under 7 days old, override
    `.npmrc` once with `npm install <pkg> --min-release-age=0`;
  - if no fixed version exists yet, `git push --no-verify` gets an unrelated
    change out.
- The test runs use `--allowOnly=false`. Vitest only refuses `.only` when
  `CI` is set, so in a local hook a forgotten `it.only` would pass with most
  tests skipped.
- `vite build` is left out of the check: Netlify runs it, and
  `npm run typecheck` catches the type errors.
- `.nvmrc` pins Node 22, the version in use on 2026-10-14. Netlify reads it,
  so the deploy builds on the same Node as the machine that pushed.
- GitHub secret scanning and its push protection are already on for the
  repo. Checked through the API on 2026-10-14. Nothing to do.

## Steps

One step per commit, in order. Each leaves both suites passing. None is
user-visible, so none bumps the version or touches the changelog.

1. `style:` format the worker. Done.
2. Done as three commits: the Argon2id speed-up, the worker on vitest 4,
   and one command each for every test and every type-check.
3. `fix:` clear the high-severity audit findings. On 2026-10-15 the root had
   10 (`brace-expansion`, `braces`, `source-map-js`, through eslint and its
   plugins) and the worker 6 (`undici`, `ws`, `sharp`, `esbuild`, through
   `wrangler` and `miniflare`). All are dev tooling; the worker's only
   runtime dependency is `hono`. On its own so step 4's audit passes the
   first time it runs, and so the bumps can be reverted alone. A fix that
   needs a release under 7 days old is reported, not overridden.
4. `chore:` a pre-push hook runs every check.
   - `npm run check`: eslint, `npm run typecheck`, `prettier --check` over `src/` and `worker/src/`, both suites with
     `--allowOnly=false`, and the audit in both places with its message. If
     the message does not fit a `package.json` line, it goes in a small
     shell script.
   - A test that `package.json`'s version matches the latest entry in
     `src/lib/changelog.ts`. The two are bumped by hand and nothing checks
     them.
   - `.nvmrc`.
   - `.githooks/pre-push`, which runs `npm run check`.
   - `README.md`'s setup section gets the `git config core.hooksPath` line.
     `CLAUDE.md` lists `check`, and its passage saying nothing enforces
     formatting is rewritten to describe the hook.
   - Time a push.
   - The queue line and this file are deleted.

## Not checked

- Every file runs under happy-dom, including the pure `lib/` tests. That is
  about 9s of CPU summed across threads but under a second of wall clock.
  Running `lib/` under `node` is possible later and not in this plan.

## Not in this plan

- GitHub Actions, and automating the deploy, which is by hand with
  `wrangler deploy` for the worker and Netlify's own for the frontend.
- When the Later item "No floor on Argon2id parameters from the server"
  lands, the floor must be one the mock in `account.test.ts` can lower, or
  the account tests will start to fail.
