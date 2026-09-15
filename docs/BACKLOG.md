# Backlog

Known cleanups that are real but not worth interrupting feature work for. Each
one is repo-wide rather than local to a single change, which is why they keep
getting noticed during review and then left alone: fixing one inside a feature
diff buries an unrelated sweep in it.

Land each as its own commit when it comes up. Delete the entry when it does.

## Inline error blocks bypass `FormError`

`src/components/form-field.tsx` exports `FormError`, which renders a
`destructive` `Alert` and therefore carries `role="alert"`. Almost nothing uses
it. Eighteen places instead hand-roll the same block:

```tsx
<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
```

They are in `src/components/account/` (5), `src/components/dialogs/` (10),
`src/routes/settings.tsx` (2) and `src/routes/categories/import-rules.tsx` (1),
across seventeen files. Find them with:

```bash
grep -rn "bg-destructive/10 p-3" src
```

Two things follow from it. The cosmetic one is eighteen copies of one style,
which drift. The one that matters is accessibility: these messages appear
*after* a submit, in response to something the user did, and without
`role="alert"` a screen reader announces nothing at all — the form simply seems
not to have responded.

The fix is not a pure find-and-replace. `FormError` renders an `Alert`, which
looks different from the tinted div, so the sweep is a deliberate visual change
across every form in the app and wants looking at rather than trusting. Either
restyle `FormError` to match the current block and swap the call sites, or keep
`Alert` and accept the new look everywhere at once.
