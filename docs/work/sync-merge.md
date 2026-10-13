# Sync merge plan

- **Status:** not started. Planned 2026-10-12 and 2026-10-13. Nothing in `src`
  mentions tombstones as of 0.49.0. The merge is built against a `BudgetRule`
  that has a `name` and no `items`.
- **Goal:** one Sync button merges both people's edits record by record, so
  two people can edit the household's budget at once and neither loses work.
- **Touches:** `src/lib/import-schema.ts`, `src/lib/db.ts`, `src/lib/types.ts`,
  `src/hooks/use-sync.ts`, a new merge module, every hook that deletes a
  record, and `src/routes/settings.tsx`.

Two people now edit one household vault, usually side by side, each on their
own device. Today the second person to push gets a 409 and has to discard one
side's work, and a plain Pull silently replaces any unpushed local edits.

The plan is kept to the smallest change that fixes this. Everything beyond the
merge is in `docs/BACKLOG.md`.

The vault stays one encrypted blob. The server and its `X-Expected-Version`
check do not change: the merge happens on the client, between the decrypted
remote blob and local data.

## Decisions

- **Last write wins, per record.** Where both sides hold a record, the newer
  `updatedAt` wins whole. Fields are not combined.
- **Deletes are tombstones in their own table.** Rows are still hard-deleted,
  so no read query changes. A tombstone is `{ id, table, deletedAt }`. It beats
  a record unless the record's `updatedAt` is later than `deletedAt`, in which
  case the record survives and the tombstone is dropped.
- **Tombstones are written at each delete site**, through one helper, and not
  by a Dexie `deleting` hook. Verified against Dexie 4.2.1: subscribing to
  that hook makes `clear()` fire it for every row, so `importAllData`,
  `loadDemoData` and `resetDatabase` would all write tombstones unless
  suppressed, and would slow to row-by-row deletes.
- **Undo stamps `updatedAt` and leaves tombstones alone.** A restored row is
  then newer than its tombstone, so the rule above keeps the row and drops the
  tombstone at the next merge. This also holds when the tombstone was already
  pushed, which removing it locally would not.
- **Trust both devices' clocks.** No skew correction.
- **Never zero scenarios after a merge.** The UI only deletes a scenario that
  is not the default, but one person can change the default and delete the old
  one while the other deletes the new one. Both tombstones then apply, and the
  orphan sweep would delete every budget and forecast rule.
  - If no scenario survives the tombstones, keep the tombstoned scenario with
    the latest `updatedAt` and drop its tombstone. Ties go to the lowest `id`.
  - This runs before the orphan sweep, so the kept scenario's rules survive.
- **Exactly one default scenario after a merge.** The flag is spread across
  records, so merging record by record can leave two defaults or none. None
  happens when one person changes the default (which stamps every scenario)
  and the other then edits the new default from a copy that predates the
  change.
  - Two or more: keep the one with the latest `updatedAt` and clear the rest.
  - None: promote the scenario with the latest `updatedAt`.
  - Ties in either case go to the lowest `id`, so both devices pick the same
    one.
- **Settings:**
  - `activeScenarioId` is which scenario this device is looking at. Keep the
    local value; a partner switching scenario should not switch yours. If that
    scenario is not in the merged result, use the default scenario.
  - `lastCheckInDate` is a date. Take the later one.
  - `checkInCadence` keeps the local value. Merging it is
    `sync-follow-ups.md`.
- **A vault id decides whether two copies may merge.** Merging is only right
  when both sides are copies of the same budget. Logout leaves the local budget
  in place and most sessions end by expiring, so a device can hold a solo
  budget, or another household's, when it syncs.
  - The id is random and minted at the first push of a new vault. It travels
    in the blob and is kept locally in `appConfig`, so it stays with the data
    through logout and session expiry.
  - Same id on both sides: merge.
  - A remote vault, and a local id that differs or is missing: do not merge.
    Offer today's two choices, replace this device or replace the cloud.
  - No remote vault: mint an id if this device has none, and push.
  - "Replace the cloud" mints a new id before pushing. The partner's device
    then holds an id that is not the cloud's and is asked, so its older copy
    cannot merge back in and undo the replace.
  - Restoring a file backup leaves the device with no id, even though the
    file carries one. The next sync then asks, and "replace the cloud" is how
    a restore reaches the household. Keeping the id would merge the restore
    with the cloud copy, where the cloud's newer records and tombstones win
    and the restore achieves nothing.
  - A remote vault with no id predates this and counts as a mismatch. The one
    existing vault is fixed once, by choosing "replace the cloud" on the device
    that holds the good copy.
- **The stored vault version stops deciding anything.** `sync()` sends the
  version it has just fetched, never the stored one. The stored version is
  still written, for display and for `sync-indicator.md`.
- **No sync in demo mode.** A demo persona is never offered to the cloud.
- **One Sync button** replaces Push and Pull in Settings.
- **No page reload after a sync.** Screens read through `useLiveQuery` and
  refresh on their own, and a reload on every sync would make working side by
  side unpleasant.
- **Login and the join screen do not change.** A device with no budget still
  pulls at sign-in, a device with one still goes to Settings without syncing,
  and an invitee still gets the household's budget over their own after the
  existing warning. Both pulls bring the vault's id with them.
- **Old clients are ignored.** There are no users yet, so a tab running
  pre-tombstone code is not handled.

These look wrong but are deliberate:

- Sync pushes every time, whether or not anything changed. That is fine until
  `sync-indicator.md`.
- An edit beats a delete, even though the category comes back hollow (see
  Limits).
- Anyone in the household, including someone who has just joined, can replace
  the shared budget with their own. A confirmation is the only guard.

## Steps

### 0. Guard the import schema first

Its own commit, before anything else. Zod drops unknown keys, so a field that
is in `types.ts` and missing from `import-schema.ts` is stripped by every
Pull. Once sync merges, the remote copy always arrives through the schema, and
ties go to remote, so every sync would strip the field and push the loss back.

- Add a test that builds one fully populated record of every entity type and
  checks it comes back from `validateImport` unchanged, so the next field
  added to `types.ts` and forgotten here fails a test.

Checked 2026-10-13 at 0.47.1: `budgetRuleSchema` has every field of
`BudgetRule`, and `src/__tests__/lib/import-schema.test.ts` has no such test.
The other schemas were not compared with their types.

### 1. Tombstones

- New `tombstones` table. Bump `CURRENT_SCHEMA_VERSION` to 6.
- Add `tombstones` to `BudgetBackup` and `import-schema.ts` as optional. Bump
  `CURRENT_DATA_VERSION` to 5. `importAllData` replaces the table with the
  backup's tombstones; `resetDatabase` and `loadDemoData` clear it.
- The schema is at 5 and the data at 4 as of 0.49.0. Check both constants in
  `src/lib/db.ts` before bumping.
- Cap the array at 500,000 in the schema. Every other array there has a
  `.max()`, and a remote vault that exceeds one fails validation, which stops
  sync for the whole household. Tombstones are never pruned, so the cap sits
  well above the transactions cap of 100,000.
- A `deleteWithTombstone` helper, used at every delete site, including the
  cascades (`budgetRules` for a category, `savingsAnchors` for a goal).
  `replaceExpenseWithOtherKind` in `src/lib/replace-expense.ts` is a delete
  site: an expense that gains or loses its due date moves between
  `budgetRules` and `forecastRules`, which deletes one record and adds
  another. Its tests stand in arrays for the tables, so they cover which rows
  are written and not the rollback when a write fails. That was not simulated
  in a browser either.
- Every undo stamps `updatedAt` on the row it puts back. Without it a merge
  deletes again what the user just restored. The places:
  - `restoreRule`, `restoreBudgetRule`, `restoreTransaction` and
    `restoreCategory` in the hooks.
  - Undoing a category delete still restores only the category row, as it
    does today. Its budget rules stay deleted. See `delete-cascades.md`.
- `deleteSavingsGoal` stamps `updatedAt` on the transactions it edits. It
  nulls `savingsGoalId` and appends the goal's name to the description through
  `.modify()`, without touching `updatedAt`. The orphan sweep in step 3
  repairs the reference whichever copy wins, but it cannot restore the
  description, so the edited copy has to be the newer one.
- `deleteCategory` stamps `updatedAt` on the transactions it uncategorises
  too. The sweep covers them when the delete wins. When a later edit keeps the
  category alive, an unstamped copy ties with the partner's, and which one
  survives would depend on who synced first.
- The withdrawal that closes a savings goal gets a deterministic id
  (`closed-<goalId>`) instead of `generateId()`. If both people delete the same
  goal, each device writes one; with random ids the merge keeps both and cash
  is overstated by the goal's balance. With the same id they are one record.
  `import-schema.ts` accepts any non-empty string as an id.

### 2. Vault id

- Add an optional `vaultId` to `AppConfig`, `BudgetBackup` and
  `import-schema.ts`. It is not indexed, so it needs no schema bump of its own.
- `exportAllData` writes it.
- `importAllData` takes a flag for whether to keep the backup's id. `pull()`
  keeps it. The file restore in Settings does not.
- `resetDatabase` and `loadDemoData` already rewrite or clear `appConfig`, so
  both leave the device with no id.
- `markInitialized` must keep the fields already in `appConfig`. It writes a
  fresh `{ id, isInitialized, isDemo }` today. Signup on a new device pushes
  first, which mints the id, and then runs the setup wizard, which calls
  `markInitialized` and would wipe it. The next sync would then ask instead of
  merging. Spread the current row in, as `setCheckInCadence` does.
- A helper that mints an id and stores it, creating the `appConfig` row if the
  device has none yet.

### 3. Merge function

A pure `mergeVaults(local, remote)` in `src/lib`, unit-tested, no Dexie. It
returns the merged vault. The vault id check happens before it is called, so
it assumes both sides are the same budget.

1. Union tombstones by id, keeping the later `deletedAt`.
2. Per table, union records by id; newer `updatedAt` wins; ties go to remote.
3. Apply tombstones as described under Decisions.
4. Never zero scenarios, as described under Decisions.
5. Orphan sweep. One loop over a declared list of relations: where a record
   points at a parent that is not in the merged result, null the reference or
   drop the record. It looks only at the merged data, so it does not replay or
   duplicate the hooks' delete logic.

   ```ts
   const RELATIONS = [
     { child: 'transactions', foreignKey: 'categoryId', parent: 'categories', whenParentMissing: 'nullify' },
     { child: 'budgetRules', foreignKey: 'categoryId', parent: 'categories', whenParentMissing: 'delete' },
     { child: 'transactions', foreignKey: 'savingsGoalId', parent: 'savingsGoals', whenParentMissing: 'nullify' },
     { child: 'savingsAnchors', foreignKey: 'savingsGoalId', parent: 'savingsGoals', whenParentMissing: 'delete' },
     { child: 'budgetRules', foreignKey: 'scenarioId', parent: 'scenarios', whenParentMissing: 'delete' },
     { child: 'forecastRules', foreignKey: 'scenarioId', parent: 'scenarios', whenParentMissing: 'delete' },
     { child: 'forecastRules', foreignKey: 'categoryId', parent: 'categories', whenParentMissing: 'nullify' },
     { child: 'forecastRules', foreignKey: 'savingsGoalId', parent: 'savingsGoals', whenParentMissing: 'delete' },
     { child: 'categoryRules', foreignKey: 'categoryId', parent: 'categories', whenParentMissing: 'delete' },
   ];
   ```

   This is every reference in `types.ts`. The local delete functions do not
   handle the last three (`delete-cascades.md`), so those are only cleaned up
   at a sync.

   A null `foreignKey` is not an orphan and is left alone.

   The sweep does not stamp `updatedAt` or write tombstones. The parent's
   tombstone stays in the vault, so every device reaches the same result from
   the same data.

   The hooks' own delete functions stay as they are. They carry steps a
   generic cascade does not fit (the description rewrite, reassigning the
   default scenario), and moving them onto this list is not needed for sync.
6. Default scenario: restore the one-only rule as described under Decisions.
   This runs after the tombstones and the sweep, so it only ever picks from
   scenarios that survived.
7. Settings as described under Decisions. The result carries the vault id both
   sides share.

Test cases to cover at minimum: add on each side, edit on both, delete versus
edit in both orders, delete on both, category deleted while the other side
adds a transaction in it, two defaults, no default, default deleted on one
side, every scenario deleted between the two sides, the active scenario
deleted by the other side, the same goal closed on both sides, empty local,
empty remote. Also: merging the result again changes nothing.

### 4. Wire it in

- `sync()` refuses to run in demo mode, and the Sync button is disabled there.
- `sync()`:
  1. Fetch remote, decrypt, validate. All the network work happens first,
     because a Dexie transaction cannot stay open across it.
  2. Apply the vault id rules under Decisions. With no remote vault, push and
     stop. On a mismatch, stop and offer the two choices below instead of
     merging.
  3. In one read-write Dexie transaction: read local, merge, and write the
     result back. An edit cannot land between the read and the write, so the
     write-back cannot wipe it.
  4. Push the result with the remote's version as expected, then store the
     new version.

  On a 409, repeat from the fetch, a bounded number of times.
- The two choices for a device whose budget is not the vault's. Reuse the
  existing conflict banner and its two actions:
  - `pull()` to replace this device.
  - `push(true)` to replace the cloud, after minting a new id. Keep the
    existing overwrite confirmation.
  - Reword the banner, since it no longer reports a version conflict. No em
    dashes in the copy.
- Settings: one Sync button. The banner no longer appears on a 409, because
  `sync()` retries instead.
- Signup's first push becomes `sync()`, which finds no remote vault.

### 5. Docs

- `docs/reference/DECISIONS.md`: the merge model and the limits below.
- `docs/reference/ARCHITECTURE.md`: the Sync section says "No merge".
- Correct the descriptions of the old behaviour in
  `docs/work/household-personal-money.md` and the header comment of
  `worker/src/services/vault.ts`.
- Delete `docs/work/logout-vault-version.md` and its line in
  `docs/BACKLOG.md`. Nothing sends the stored version any more.
- The next minor version and a changelog entry, staged with the change.

## Limits

For `docs/reference/DECISIONS.md`, along with the deliberate choices listed
under Decisions. Where a fix is planned, the bullet names its work file. The
hollow category, the late contribution and the unedited child records are
known and not planned: each needs both people to touch the same thing before
syncing, and the bullet says why it is left.

- **Not live**: each person sees the other's changes when they press Sync.
- **No indicator**: nothing says there are changes to pull or push. Syncing
  is by hand, and is always safe. See `sync-indicator.md`.
- **Same record edited by both**: the later edit wins whole. If one changes
  the amount and the other the date, one of those is lost.
- **Same thing added by both**: duplicates. Two categories with one name
  (`category-duplicates.md`), two allowances of one name in a category, two emergency
  funds, two balances for one date, or the same bank CSV imported twice
  (`sync-merge-duplicates.md`).
- **Hollow category**: when one edits a category the other deleted, the
  category survives, because the edit is newer than the delete, but it comes
  back hollow. Its allowance was deleted as a separate record and its
  transactions were uncategorised by the delete, and nobody edited those. Its
  import rules do survive. Restoring the rest would mean recording which
  delete wrote each tombstone.
- **Late contribution**: a contribution added while the other person closes
  the goal is not returned to cash. The closing withdrawal (`closed-<goalId>`)
  covers the balance the person closing it could see. The contribution has its
  goal nulled by the orphan sweep and nothing offsets it. Fixing it means the
  merge recomputing the withdrawal, which puts savings logic into a generic
  sweep.
- **Unedited child records**: which copy survives can depend on who synced
  first, when the parent was deleted on one side and edited on the other.
  Swept records are not stamped, so they tie with the other device's
  untouched copy and the remote wins. Both devices still end up the same.
- **Two existing budgets**: two people who each already have a budget cannot
  combine them. One is kept and the other is replaced. See
  `combine-budgets.md`.
- **Logging in**: on a device that already has the household's budget it does
  not sync. It goes to Settings, where Sync merges without asking. See
  `sync-prompt.md`.
- **Invitee warning**: an invitee with nothing on the device still sees the
  backup warning. See `sync-prompt.md`.
- **Check-in cadence**: stays per device. See `sync-follow-ups.md`.
- **Clocks**: a wrong device clock can make an older edit win.
- **Tombstones**: never pruned, so the vault keeps a record of every deleted
  id and when it was deleted. See `sync-follow-ups.md`.
- **Category undo**: undoing a category delete does not bring back its
  allowances, and local deletes leave some references behind until the next
  sync. See `delete-cascades.md`.
- **Scenario rules**: not deleted with the scenario (`deleteScenario`). The
  orphan sweep removes them, but only at the next sync. See
  `delete-cascades.md`.

## Not verified

Nothing in this plan has been run. Every claim about the code came from
reading it, except the Dexie `deleting` hook behaviour, which was checked
against Dexie's source.

- That every screen copes with the write-back without a reload. In-memory
  state that holds record ids may point at rows the merge removed.
- Whether demo data can be loaded on a signed-in device. The setup wizard
  offers the demo and signup lands on the wizard, so it looks reachable. The
  vault id is lost on demo load either way, which is the safe outcome.
- What each screen does with no default scenario. The merge guarantees one
  unless both sides hold no scenarios at all, which is the state straight
  after signup on a new device and before the wizard finishes.
- How every screen renders a transaction whose category is missing. Some fall
  back to "Unknown" or "Uncategorised". The orphan sweep should mean it never
  happens, so this was not traced further.
- That `markInitialized` is the only writer that drops `appConfig` fields.
  `resetApp` also does, and appears to have no callers.
