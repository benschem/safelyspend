# Form errors are not announced to screen readers

- **Status:** not started. Counted 2026-10-05.
- **Goal:** every form error is announced to screen readers, through one shared component.
- **Touches:** `src/components/form-field.tsx` and the twenty files listed below.

## Why

`src/components/form-field.tsx` exports `FormError`, which renders a
`destructive` `Alert` and therefore carries `role="alert"`. Almost nothing uses
it. Twenty-one places hand-roll the same block:

```tsx
<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
```

They are in `src/components/account/` (8), `src/components/dialogs/` (10),
`src/routes/settings.tsx` (2) and `src/routes/categories/import-rules.tsx` (1),
across twenty files (counted 2026-10-05). Find them with:

```bash
grep -rn "bg-destructive/10 p-3" src
```

The copies drift in style. They are also silent to a screen reader: the
messages appear after a submit, and without `role="alert"` nothing is
announced, so the form seems not to have responded.

## Proposed

`FormError` renders an `Alert`, which looks different from the tinted div, so
swapping it in changes how every form looks. Check each form by eye. Either
restyle `FormError` to match the current block and swap the call sites, or keep
`Alert` and accept the new look everywhere at once.
