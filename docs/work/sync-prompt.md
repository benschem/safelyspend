# One sync prompt in place of the banner, and sign-in syncs

- **Status:** not started. Raised 2026-10-13. Needs `sync-merge.md` to land first.
- **Goal:** every caller syncs through one `sync()`. A device with no budget takes
  the household's without being asked, a device holding a different budget
  gets one clear dialog, and signing in on a device that has a budget syncs.
- **Touches:** `src/hooks/use-sync.ts`, `src/routes/settings.tsx`,
  `src/routes/household-waiting.tsx`,
  `src/components/account/join-household-step.tsx`, `src/routes/login.tsx`.

## Why

Once it lands, the merge uses a vault id to tell whether a device's budget is
the household's. When it is not, Settings shows the old conflict banner,
reworded, and nothing else in the app syncs.

## Proposed

- **Every caller goes through `sync()`**, which decides between merging,
  replacing and asking.
- **A device with no budget replaces without asking.** When `isInitialized` is
  false and a remote vault exists, there is nothing to lose and nothing to
  merge, so `sync()` calls `replaceLocalWithCloud()` (today's `pull`, under a
  clearer name) and skips the vault id check.
- **The prompt.** One dialog, opened by `sync()` from wherever it was called,
  replacing the banner. It says this device has a budget that is not the
  household's, offers to download a backup first, and has three buttons:
  - "Replace this device's budget".
  - "Replace the household's budget", which asks "are you sure" first. Copy
    along these lines: "This replaces the budget your household shares with
    the one on this device. Check that your partner has a backup of theirs
    first." The confirm button repeats the label in the destructive style.
  - "Combine both": disabled, with the tooltip "Coming soon". A disabled
    button does not fire hover events, so the tooltip trigger goes on a
    wrapper around it. See `combine-budgets.md`.
  - The first two both say "Replace" because both discard a budget. Each
    label names the one that is lost. No em dashes in any of the copy.
- **Settings keeps a small "Replace the household's budget" action**, for
  restoring a file backup and forcing it up without waiting to be asked.
- **The join screen calls `sync()`.** `household-waiting.tsx` pulls
  unconditionally today, over every local table, so it always warns and
  always offers a backup first. After this an invitee with nothing on the device gets
  the household's budget with no prompt, and one with a budget gets the same
  prompt as anyone else. `JoinHouseholdStep` loses its own warning and backup
  button (`onDownloadBackup`). Closing the prompt without choosing leaves them
  joined, with their own budget still on the device; the next Sync asks again.
- **After sign-in on a device that already has a budget, run `sync()`**,
  unless the device is in demo mode. A device signing back in to its own vault
  has the matching id and merges without a prompt.

Not verified: that `isInitialized` is a fair test for "this device holds a
budget". Invite signup skips the setup wizard, so a device that has never held
a budget is uninitialised. But a device set up once and since emptied still
counts as initialised. It would be asked instead of silently replaced, which
is safe but unnecessary.
