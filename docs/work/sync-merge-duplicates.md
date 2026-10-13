# A merge can leave two of something that should be one

- **Status:** not started. Raised 2026-10-12 and 2026-10-13. Needs `sync-merge.md` to land first.
- **Goal:** after a merge there is at most one emergency fund, one anchor per
  date and one copy of a transaction both people imported, and it is decided
  what happens to two allowances of one name in a category.
- **Touches:** the merge function from `sync-merge.md`.

Raised 2026-10-13, from `docs/work/sync-merge.md`. The merge matches records
by `id`, so a rule the hooks enforce on one device can be broken when both
people add the same thing before syncing. The merge already repairs the
default scenario. These are left:

- **Two allowances of one name in a category.** A category can hold several
  allowances, so a second one is not a mistake in itself. The expense dialog
  refuses to make two of one name on one device. Two people each adding the same allowance leaves two rows, both
  listed and both counted, so the category's limit doubles until one is
  removed. The likeliest of these when setting up a budget side by side.
  Decide whether two with the same name, or two with none, are merged or
  left for the user to remove.
- **At most one emergency fund.** Keep the goal with the latest `updatedAt`,
  clear the flag on the rest. None is a valid state, so nothing is promoted.
- **One anchor per date.** The hooks allow one balance anchor per date, and
  one savings anchor per goal per date. They are not added together: within
  one vault both are statements about the same money, so adding would double
  the balance.
- For each that is merged: keep the one with the latest `updatedAt`, ties to
  the lowest `id`,
  and give the dropped record a tombstone so it does not come back from the
  other device. Runs in `mergeVaults` after the tombstones and the sweep.
- Two categories with one name is `category-duplicates.md`. A bank import
  both people ran is the section below.

## Sync merge duplicates a bank import both people ran

Raised 2026-10-12, from `docs/work/sync-merge.md`. The merge matches records by
`id`, so if both partners import the same bank CSV before syncing, every
transaction arrives twice under two ids.

Transactions already carry `importFingerprint`, which the import dialogs use to
skip duplicates on one device. The merge could do the same across the two
sides: where two transactions share a fingerprint, keep one. Decide which one
wins when they were categorised differently.
