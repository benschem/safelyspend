---
paths:
  - "src/components/**/*.tsx"
  - "src/routes/**/*.tsx"
  - "src/hooks/**/*.ts"
---

# Leave the code you touch better

These apply only to the code the change already touches. Anything beyond that
is unrelated work: add a line to Inbox, as `docs/README.md` says.

- A figure you change moves into a pure function in `src/lib/`, with a test.
  `docs/reference/DECISIONS.md` says why.
- A form you change does not gain another `useState` per field. New forms
  follow "Form actions" in `docs/reference/CONVENTIONS.md`.
- Parse a typed amount with `parseCentsFromInput`, never raw `parseFloat`.
- Wrap a database write in try/catch, as in `CONVENTIONS.md`.
- Do not copy a block that already exists in the file. Extract it and use it
  in both places.

When you report the work, list any cleanup nearby that would be cheap to do
alongside it, under a heading that marks it as optional. Do not make those
changes unless asked.
