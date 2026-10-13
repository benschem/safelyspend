# Logging out forgets the vault version, so the next push conflicts

- **Status:** not started. Traced through the code while building the recovery
  flow, not observed. Nothing has been run against a live server, so confirm
  the 409 first. `sync-merge.md` deletes this file when it lands, because
  nothing sends the stored version after the merge. Worth fixing only if the
  merge is delayed.
- **Goal:** logging out and back in on a device that was in sync does not raise a
  conflict on the next push.
- **Touches:** `src/hooks/use-auth.ts`, `src/hooks/use-sync.ts`.

## Why

`clearLocalSyncState` in `src/hooks/use-auth.ts` removes
`STORAGE_KEYS.SYNC_LOCAL_VERSION` on every logout and on account deletion. That
is right for deletion. On logout the version is still valid and should be kept.

`getStoredVersion` in `src/hooks/use-sync.ts` returns `0` when nothing is
stored, and `push` sends that as its expected version. So on a device that
already has a budget:

1. Log out, log back in. `goToUnlockedDestination` sees `isInitialized` and
   navigates to Settings without pulling, so nothing restores the version.
2. The next push sends `expectedVersion: 0` against a server at version N.
3. The server answers 409 and the conflict UI opens, offering to pull or
   overwrite, although the two copies are not in conflict.

No data is lost: either branch of the conflict UI resolves it correctly, and a
stale device would have taken the 409 anyway on its true version. But the
prompt warns that an evening's work is about to be discarded, and a false one
after every sign-in teaches people to dismiss the real one.

## Proposed

Split `clearLocalSyncState` in two. Deletion keeps the current behaviour.
Logout keeps the version and clears only the key vault and the last-synced
timestamp. This touches every sign-out path in the app.
