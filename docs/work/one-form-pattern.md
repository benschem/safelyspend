# One way to build a form, one amount parser, one way to report a result

- **Status:** not started. As the 2026-10-13 code review reported it, with
  0.44.7 line numbers; confirm before planning.
- **Goal:** every form is built the way "Form actions" in
  `docs/reference/CONVENTIONS.md` describes, parses amounts the same way,
  and reports a result the same way.
- **Touches:** `src/components/dialogs/`, `src/routes/transactions/new.tsx`,
  `package.json`.

- Five dialogs use a `useState` per field plus an effect that resets them on
  open: forecast rule (`:117-166`), savings goal (`:66-108`), category
  budget, transaction and scenario.
- `@tanstack/react-form` is installed and used only in
  `routes/transactions/new.tsx`, a route nothing links to.
- Amounts are parsed by `parseCentsFromInput` in some places and raw
  `parseFloat` in others.
- New forms should use React 19 form actions. The rule is in
  `docs/reference/CONVENTIONS.md` under "Form actions".

## Related work

Each touches the same dialogs. Check them for overlap before planning:

- `form-errors.md`
- `form-labels.md`
- `combobox.md`
