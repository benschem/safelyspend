# Show unsynced changes and changes to pull

- **Status:** not started. Raised 2026-10-10. Needs `sync-merge.md` to land first.
- **Goal:** the sidebar says when this device has changes it has not pushed and
  when the household's vault is newer, and a sync with nothing to send does
  not push.
- **Touches:** `src/hooks/use-sync.ts`, `src/components/sync-status.tsx`,
  `src/hooks/use-auth.ts`.

## Why

Two people can edit the same vault, and sync is by hand. The sidebar says
"Synced 2h ago" whether or not anything changed since.

Two states, neither tracked today:

- **You have changes you have not pushed.** Forget, and the other person works
  on old data.
- **The household vault is newer than yours.** Today, editing on top of it
  makes the next push answer 409, and the choices are pull (lose yours) or
  overwrite (lose theirs). Once the merge has landed it is only a prompt to
  sync.

## Proposed

Designed 2026-10-13 in `sync-merge.md`, then cut from it to keep the merge
small. It assumes the merge has landed.

- **Shared sync store.** `useSync` keeps `syncStatus`, `localVersion` and
  `lastSyncedAt` in `useState`, so the sidebar and Settings each hold their
  own copy. Move the shared state to one module-level store read with
  `useSyncExternalStore`, as `key-vault.ts` does. No behaviour change. Lands
  first, as its own commit.
- **No empty pushes.** Every push bumps the vault version, and a bumped
  version is what tells the other device there is something to pull. With an
  indicator, pushing unconditionally would have the two devices prompting
  each other for ever.
  - `mergeVaults` also returns two booleans: whether the result differs from
    local, and whether it differs from remote. The comparison ignores
    `exportedAt`, which differs on every export, and `activeScenarioId`, which
    is per device.
  - `sync()` skips the write-back when the result matches local, and skips the
    push when it matches remote.
  - Test: merging a vault with itself reports no difference on either side.
- **Unpushed changes.** A flag in the store, persisted to `localStorage`, set
  from `Dexie.on('storagemutated')` and cleared when a sync completes.
  - The event reports every committed write without per-row hooks. An import
    also fires it, so the flag is cleared after a sync finishes, not before.
  - Its keys name the table (`idb://BudgetApp/<table>/<index>`, checked in
    Dexie 4.2.1). Writes to `activeScenario` are ignored: that table is this
    device's view, so switching scenario is not an unsynced change.
- **Edits during a push.** An edit made while a push is in flight must keep
  the flag set. The store also counts mutations in memory. `sync()` notes the
  count once its own write-back has been counted, and clears the flag after
  the push only if the count has not moved since.
- **Changes to pull.** Compare `api.vault.getMetadata().version` with the
  local version, once on load and then through the existing
  `usePollWhileVisible` (it polls on tab focus and on an interval, but not
  when first enabled).
- **Logout.** It clears the stored version (`clearLocalSyncState` in
  `use-auth.ts`), so without a sync at sign-in the indicator would say
  "Changes to pull" after every sign-in. See `sync-prompt.md`.
- **Display.** `SyncStatus` in the sidebar gains "Changes to pull"
  (prominent) and "Unsynced changes" (an amber dot). The dot is quiet because
  unsynced is the normal state while editing; a banner would be up all session
  and stop being seen. No em dashes in the copy.
- **Automatic sync.** Syncing on a timer or on tab focus is a small step once
  the above exists, and would keep two people working side by side up to
  date. Decide separately.

Not verified: whether `storagemutated` for the sync's own write-back has fired
by the time the transaction's promise resolves. The mutation count depends on
reading it after that event, not before. If it fires later, the flag would
never clear. Check this first.
