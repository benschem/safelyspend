# Faster tests, and a pre-push hook runs every check

- **Status:** in progress. Steps written and reviewed. Step 1 not started.
- **Goal:** the whole suite, frontend and worker, runs from one command in
  well under ten seconds, and nothing reaches GitHub, and so Netlify, without
  passing lint, the type-checks, Prettier's check, every test and
  `npm audit`.
- **Touches:** `src/__tests__/lib/account.test.ts`, `package.json`,
  `worker/package.json`, `worker/src/`, `vitest.config.ts`,
  `worker/vitest.config.ts`, a new `.githooks/pre-push`, a new `.nvmrc`,
  `README.md`, `CLAUDE.md`.

## Why

Nothing enforces lint, types, formatting, tests or the audit. There is no
hook and no `.github/` folder, and a push to `main` deploys to Netlify
straight away.

The worker's tests are easy to miss. The root `vitest.config.ts` includes only
`src/**`, and the worker has its own config on vitest 3.2, against 4.1 at the
root. `npm run test:run` at the root does not run them.

The suite is slower than it needs to be, and nearly all of the time is one
file paying for production-strength password hashing.

## Baseline

Measured on 2026-10-14 on an 8-core Mac.

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

`key-management.test.ts` already avoids the cost by passing `FAST_PARAMS`
(256 KiB, 1 iteration) and runs 41 tests in 0.2s. `account.ts` takes no
parameters, so its tests cannot do the same.

## Decided

- `account.test.ts` swaps `ARGON2ID_PARAMS` for fast parameters with
  `vi.mock` and `importOriginal`, rather than adding a `params` argument to
  `buildSignupMaterial` and the rest. A production signature should not grow
  an argument only tests use.
- The swap keeps the round trip honest. The unlock and verifier paths in
  `account.ts` decode their parameters from the stored row, not from
  `ARGON2ID_PARAMS`, so material built fast is opened fast through the same
  code. Checked in the code.
- Full-cost Argon2id stays covered by `argon2-conformance.test.ts` and by the
  test in `key-management.test.ts` that pins `ARGON2ID_PARAMS`.
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
- `vite build` is left out of the check: Netlify runs it, and `tsc` catches
  the type errors.
- `.nvmrc` pins Node 22, the version in use on 2026-10-14. Netlify reads it,
  so the deploy builds on the same Node as the machine that pushed.
- GitHub secret scanning and its push protection are already on for the
  repo. Checked through the API on 2026-10-14. Nothing to do.

## Steps

One step per commit, in order. Each leaves both suites passing. None is
user-visible, so none bumps the version or touches the changelog.

1. `style:` format the worker. Prettier over `worker/src`, where 22 files are
   unformatted, and no other code in the diff, so the reformat can be
   reviewed and reverted on its own. `CLAUDE.md`'s Formatting section
   changes with it: its Prettier commands cover `worker/src`, and the commit
   it names as fully formatted becomes this one.
2. `chore:` every test from one command, in a few seconds.
   - The plan: the queue line in Now, this file, `fake-indexeddb.md` with
     its line in Later, and the link in `review-findings.md`.
   - In `account.test.ts`, mock `@/lib/key-management` so `ARGON2ID_PARAMS`
     is the fast set, and drop `ARGON2ID_TIMEOUT_MS` and the per-test
     timeouts it exists for.
   - If a release of `@cloudflare/vitest-pool-workers` supports vitest 4 and
     is past the 7 day minimum release age, move the worker to it and run
     both suites as projects of one vitest run. Otherwise a root `test:all`
     script runs the root suite and then `npm --prefix worker run test:run`.
   - `CLAUDE.md` lists the command.
   - Measure the root suite and the whole command, and record both here.
3. `chore:` a pre-push hook runs every check.
   - `npm run check`: eslint, `tsc -b`, the worker's `tsc --noEmit`,
     `prettier --check` over `src/` and `worker/src/`, both suites with
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

- The time after the Argon2id change. About 3.5 to 4s for the root is an estimate from
  `key-management.test.ts`, not a measurement.
- Whether a vitest 4 build of the workers pool exists.
- Every file runs under happy-dom, including the pure `lib/` tests. That is
  about 9s of CPU summed across threads but under a second of wall clock.
  Running `lib/` under `node` is possible later and not in this plan.

## Not in this plan

- GitHub Actions, and automating the deploy, which is by hand with
  `wrangler deploy` for the worker and Netlify's own for the frontend.
- When the Later item "No floor on Argon2id parameters from the server"
  lands, the floor must be one the mock in `account.test.ts` can lower, or
  the account tests will start to fail.
