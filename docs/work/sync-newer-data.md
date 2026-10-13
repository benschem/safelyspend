# An older app version drops newer fields on a sync pull

- **Status:** not started. No steps yet. Read in the code on 2026-10-13, not
  reproduced with two devices.
- **Goal:** an app that is handed data newer than it understands refuses it
  and says to update, on a sync pull, a sync push and a file import.
- **Touches:** `src/lib/import-schema.ts`, `src/hooks/use-sync.ts`,
  `src/routes/settings.tsx`, `src/__tests__/lib/db-versioning.test.ts`.

## Why

A household can have one device on a newer version than another. When the
older one pulls, the newer fields are lost, and its next push removes them
for everyone.

- `validateImport` (`src/lib/import-schema.ts`) parses with Zod, which drops
  any key a schema does not list.
- `migrateImportData` returns data unchanged when its version is the current
  one or higher, so newer data is accepted as it is.
  `db-versioning.test.ts` has a test that says accepting a future version is
  intended.
- A pull replaces the device's data with the result
  (`src/hooks/use-sync.ts`, `importAllData` in `src/lib/db.ts`).

Two releases have added a field a person types into:

- 0.47.0 added `items` to a budget rule without changing the data version,
  so a 0.46 device pulling from a 0.47 one drops the item names and keeps the
  total.
- 0.48.0 added `name` to a budget rule in data version 4, so a 0.47 device
  pulls named allowances as unnamed ones.

Nothing can change what released versions do. Until every device in a
household is on 0.48, the only protection is updating them all before anyone
edits allowances.

## Proposed

1. **Refuse or keep**: refuse data with a higher version than
   `CURRENT_DATA_VERSION`, with a message to update the app. The alternative
   is to keep unknown fields and pass them through, which needs every schema
   to stop stripping and still would not help where a newer version changes
   what an existing field means.
2. **Push**: an older device should also refuse to push over a vault written
   by a newer one. The pull check alone does not cover a forced push. This
   needs the vault's data version to be readable before the push, which is
   not checked: the version the worker returns is the vault's revision
   number, not the data version.
3. **File import**: the same check, since Settings uses `validateImport` too.

## Overlap

- `sync-merge.md`: takes data version 5, and replaces the pull-replaces
  behaviour this describes. The check belongs in whatever reads remote data
  after that lands.
- `sync-prompt.md` and `sync-indicator.md`: both add sync UI, where an
  "update the app" state would show.

## Not in this plan

- Making 0.47 and earlier safe. They are already released.
- Forcing an update when a new version is deployed.
