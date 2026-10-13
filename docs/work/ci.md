# Worker tests run from the root script, and CI runs the checks

- **Status:** not started. Found in the 2026-10-13 code review. Steps to be
  written when this is picked up.
- **Goal:** one command runs every test in the repo, and every push runs
  lint, the type-check, Prettier's check and the tests without anyone
  remembering to.
- **Touches:** `package.json`, `vitest.config.ts`, `worker/package.json`,
  `worker/vitest.config.ts`, a new `.github/workflows/` file, `CLAUDE.md`.

## Why

`CLAUDE.md` says twice that nothing enforces formatting. Nothing enforces the
rest either: there is no pre-commit hook and no `.github/` folder.

The worker's tests are easy to miss. `npm run test:run` at the root reported
29 files and 691 tests on 2026-10-13, all under `src/`. The eight test files
under `worker/src/__tests__/` were not among them.

## Reported by the sub-review, not checked

- The root `vitest.config.ts` includes only `src/**`.
- The worker has its own config and is on vitest 3.2, against 4 at the root.
- Whether the worker's tests pass today. They were read, not run.

## To decide when planning

- One vitest run with two projects, or a root script that runs both in turn.
  The version gap may decide it.
- Whether a pre-commit hook is wanted as well as CI. CI is the one that works
  whoever, or whatever, makes the commit.
- The repo deploys by hand with `wrangler deploy`. Automating that is not in
  this plan.
