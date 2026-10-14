# Test against a real Dexie database with `fake-indexeddb`

- **Status:** not started.
- **Goal:** tests can open a real Dexie database, so transactions, indexes
  and schema upgrades are tested rather than assumed.
- **Touches:** `package.json`, `src/__tests__/setup.ts`, the tests below.

## Why

The test environment has no IndexedDB, and tests stand in arrays for the
tables (`src/__tests__/hooks/use-categories.test.ts`,
`src/__tests__/lib/replace-expense.test.ts`). That covers which rows are
written. It cannot cover a transaction rolling back when a write fails, a
`where()` on a field with no index, or a schema upgrade.

Three things wait on it:

- the rollback in `replaceExpenseWithOtherKind` (`src/lib/replace-expense.ts`);
- the version 5 Dexie upgrade in `src/lib/db.ts`, whose conversion function is
  tested and whose upgrade was run once by hand in a browser on 2026-10-13;
- `deleteCategory`, which `delete-cascades.md` suspects of a `where()` on an
  unindexed field.

## To decide

- Check the 7 day minimum release age when adding the dependency.
