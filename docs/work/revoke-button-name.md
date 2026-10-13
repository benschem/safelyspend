# Active Sessions: the Revoke button loses its name while it works

- **Status:** not started.
- **Goal:** the Revoke button keeps its label while it is working.
- **Touches:** `src/routes/settings.tsx`.

In `src/routes/settings.tsx` the button's label is swapped for a spinner, so a
screen reader hears an unnamed button. Keep the label beside the spinner, as
the invite panel's Cancel button does.
