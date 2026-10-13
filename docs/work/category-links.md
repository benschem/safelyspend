# Category names elsewhere do not look like links

- **Status:** not started. Decide whether it is worth doing at all.
- **Goal:** category names that link to the detail page look like links, or the
  idea is dropped.
- **Touches:** allowance rows, bill rows and transaction rows.

## Why

Raised 2026-10-11 as "category views are hard to find", when `/categories`
redirected to Budget. The Categories page came back on 2026-10-12
(`src/routes/categories/index.tsx`), which answers most of it.

Why that page has no Add Category and no spending figures is in
`docs/reference/DECISIONS.md`.

## Proposed

A category's name on an allowance row, a bill or a transaction is a bare
`hover:underline` and reads as plain text. It matters less now there is a
list. If it is done, use an arrow on hover, as the card pattern in
`.claude/rules/ui-patterns.md` has it.

Merging duplicate categories is in `category-duplicates.md`.

Not checked in a browser as of 2026-10-12: the list page and the Back links
were checked by lint, type-check and the build only.
