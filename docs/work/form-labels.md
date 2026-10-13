# Form labels sit tight against their inputs

- **Status:** not started. Noticed 2026-10-10. Traced, not measured: confirm on one form first.
- **Goal:** labels have the intended gap above their inputs on every form.
- **Touches:** `src/components/ui/label.tsx`, about 35 hand-written labels,
  `src/components/account/household-invites-panel.tsx`.

Noticed on the invite panel during the Phase 7 walkthrough, 2026-10-10. Only
that one label was fixed, by adding `block`.

The usual field markup is a wrapper with `space-y-2` (or `space-y-1.5`) holding
a label and an input. Tailwind 4 writes `space-y` as a bottom margin on every
child but the last, and here that child is the `<label>`: an inline element,
whose vertical margins the browser ignores. So the gap the class asks for never
appears, and the only space is line height.

About 35 places hand-write `<label className="text-sm font-medium">`: the
account steps, both wizards, the Settings dialogs, `password-dialog.tsx` and
`import-rules.tsx`. The shared `Label` in `src/components/ui/label.tsx` is
inline as well, so `FormField` is likely affected. Find the hand-written ones
with:

```bash
grep -rn "<label htmlFor" src
```

**Traced, not measured.** The mechanism comes from how Tailwind 4 defines
`space-y`; nobody has inspected the computed margins. Confirm on one form first.
Not every match is a field label: some wrap a checkbox and are fine as they are.

The fix is to add `block` to the shared `Label` and move the hand-written labels
onto it. It changes the spacing of every form at once, so it wants its own
commit and a look at each screen. Remove the one-off `block` in
`household-invites-panel.tsx` when it lands.
