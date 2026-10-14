# Split `SettingsPage`, and one panel for cash and savings anchors

- **Status:** not started. As the 2026-10-13 code review reported it, with
  0.44.7 line numbers; confirm before planning.
- **Goal:** Settings is made of components small enough to read, and cash
  and savings anchors are edited through one panel that behaves the same for
  both.
- **Touches:** `src/routes/settings.tsx`.

Overlaps `account-page.md`, which moves account controls out of Settings.
Check both before planning either.

- `SettingsPage` (`settings.tsx:83-1635`) is one component with 35
  `useState` calls.
- Cash anchor and savings anchor CRUD are written twice: state at `:98-124`,
  handlers `:426-504` against `:507-599`, list markup `:662-703` against
  `:745-800`, dialogs at `:1290` and `:1359`.
- The two have already drifted: only the savings one rejects a negative
  amount (`:453` against `:541-549`).
- It uses both an inline `showMessage` alert (`:317`) and sonner toasts
  (`:209`), and parses amounts with raw `parseFloat` (`:451`, `:539`).
- An error is swallowed at `settings.tsx:164`.
