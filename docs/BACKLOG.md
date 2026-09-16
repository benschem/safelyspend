# Backlog

Known cleanups that are real but not worth interrupting feature work for. Each
one is repo-wide rather than local to a single change, which is why they keep
getting noticed during review and then left alone: fixing one inside a feature
diff buries an unrelated sweep in it.

Land each as its own commit when it comes up. Delete the entry when it does.

## Logging out forgets the vault version, so the next push conflicts

`clearLocalSyncState` in `src/hooks/use-auth.ts` removes
`STORAGE_KEYS.SYNC_LOCAL_VERSION` on every logout and on account deletion. For
deletion that is right — the relationship with that server is over. For logout
it throws away a fact that is still true: the vault on the server is at version
N, and this device knows it.

`getStoredVersion` in `src/hooks/use-sync.ts` returns `0` when nothing is
stored, and `push` sends that as its expected version. So on a device that
already has a budget:

1. Log out, log back in. `goToUnlockedDestination` sees `isInitialized` and
   navigates to Settings without pulling, so nothing restores the version.
2. The next push sends `expectedVersion: 0` against a server at version N.
3. The server answers 409 and the conflict UI opens, offering to pull or
   overwrite — for two clients that are not in conflict at all.

The cost is a false alarm rather than lost data. A device that really is stale
would have taken the 409 anyway, on its true version; what this adds is the
same prompt for a device that was perfectly in sync a moment earlier. Either
branch of the conflict UI resolves it correctly. But the prompt is written to
warn that an evening's work is about to be discarded, and a warning that cries
wolf after every sign-in is one people learn to click through — which matters
on the day it is telling the truth.

**Traced, not observed.** This was followed through the code while building the
recovery flow, which logs out deliberately. Nothing has been run against a live
server, so confirm the 409 before fixing it.

The fix is probably to split `clearLocalSyncState` in two — deletion keeps the
current behaviour, logout keeps the version and clears only the key vault and
the last-synced timestamp — but it touches every sign-out path in the app,
which is why it is here rather than in the commit that noticed it.

## Inline error blocks bypass `FormError`

`src/components/form-field.tsx` exports `FormError`, which renders a
`destructive` `Alert` and therefore carries `role="alert"`. Almost nothing uses
it. Nineteen places instead hand-roll the same block:

```tsx
<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
```

They are in `src/components/account/` (6), `src/components/dialogs/` (10),
`src/routes/settings.tsx` (2) and `src/routes/categories/import-rules.tsx` (1),
across eighteen files. Find them with:

```bash
grep -rn "bg-destructive/10 p-3" src
```

Two things follow from it. The cosmetic one is nineteen copies of one style,
which drift. The one that matters is accessibility: these messages appear
*after* a submit, in response to something the user did, and without
`role="alert"` a screen reader announces nothing at all — the form simply seems
not to have responded.

The fix is not a pure find-and-replace. `FormError` renders an `Alert`, which
looks different from the tinted div, so the sweep is a deliberate visual change
across every form in the app and wants looking at rather than trusting. Either
restyle `FormError` to match the current block and swap the call sites, or keep
`Alert` and accept the new look everywhere at once.
