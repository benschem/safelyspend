# The show-password toggle cannot be reached by keyboard

- **Status:** not started. Noticed 2026-10-05.
- **Goal:** the show-password toggle can be reached by keyboard on every account step.
- **Touches:** `src/components/account/`.

## Why

Noticed reviewing Phase 7 step 4's join form, 2026-10-05. The join form copies
both from its siblings in `src/components/account/`, so it is consistent with
them; fix every step in one go, or none.

- **The show-password toggle cannot be reached by keyboard.** It carries
  `tabIndex={-1}`, so someone tabbing through the form goes from the password
  straight past it. The likely intent was a tab order of password then submit,
  but it leaves keyboard users no way to check what they typed. Drop the
  `tabIndex`.
- **Focus on mount uses a ref and an effect** where the dialogs use plain
  `autoFocus`, which does the same job in one attribute. Cosmetic, but it is
  three lines per step that read as if they do something more.

The missing `role="alert"` on their error blocks is in `form-errors.md`.
