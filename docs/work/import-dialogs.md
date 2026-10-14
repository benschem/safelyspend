# The import dialogs repeat one pipeline, and a failed write leaves them stuck

- **Status:** not started. The dialog findings are as the 2026-10-13 code
  review reported them, with 0.44.7 line numbers; confirm before planning.
  The `payee` finding was read in the code on 2026-10-13 at 0.47.1.
- **Goal:** both import dialogs share one tested pipeline, a failed write
  reports an error and lets the person try again, and the import rule and
  schema hold only what is used and checked.
- **Touches:** `src/components/csv-import-dialog.tsx`,
  `src/components/up-import-dialog.tsx`, `src/lib/types.ts`,
  `src/lib/import-schema.ts`.

## One pipeline, and a failed write

- File validation, duplicate detection and `handleImport` are near-identical:
  `csv-import-dialog.tsx:161-217`, `284-306`, `414-524` against
  `up-import-dialog.tsx:70-178`, `146-168`, `180-290`.
- Neither `handleImport` has a try/catch, so a failed `bulkImport` leaves the
  dialog on "importing".
- `CsvImportDialog` (`:68-976`) is 900 lines with 20 `useState` calls.

## An import rule's `payee` option is never read

`matchField` is `'description' | 'payee'` in `types.ts:139` and
`import-schema.ts:125`. Both places that create a rule write
`'description'`, and no matching code reads the field, so only an imported
file can carry `'payee'` and it is then matched as a description. Remove the
option or honour it. Removing it changes the import schema: see
`.claude/rules/schema-versioning.md`.

## Dates in the import schema are not checked

As reported: dates in the import schema are `z.string()` with no format
check.
