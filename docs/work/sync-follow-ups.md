# Sync follow-ups: check-in cadence, and pruning tombstones

- **Status:** not started. Raised 2026-10-12 and 2026-10-13. Needs `sync-merge.md` to land first.
- **Goal:** the check-in cadence follows the household, and old tombstones are
  pruned from the vault.
- **Touches:** the merge function from `sync-merge.md`, `src/hooks/use-app-config.ts`,
  `src/routes/privacy.tsx`.

## Check-in cadence does not sync

Raised 2026-10-13, from `docs/work/sync-merge.md`. The merge keeps each
device's own `checkInCadence`. To merge it, add a `checkInCadenceUpdatedAt`,
stamped in `setCheckInCadence`. Newer wins; a missing stamp counts as oldest.

## Sync tombstones are never pruned

Raised 2026-10-12, from `docs/work/sync-merge.md`. Every delete leaves a
tombstone (`id`, table, `deletedAt`) in the vault so the other device learns of
it. Nothing removes them, so the vault only grows, and it keeps a record of
every deleted id and when it went.

- Prune tombstones older than some age on sync. The cost is that a device
  offline for longer than that brings its deleted records back, so pick the age
  with that in mind.
- Consider a line on the privacy page saying that a deleted record leaves a
  trace of its deletion in the encrypted vault, and for how long.
