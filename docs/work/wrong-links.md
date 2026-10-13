# Links and redirects that land in the wrong place

- **Status:** not started. Found 2026-10-12. Traced through the code, not clicked through.
- **Goal:** every link and redirect listed below lands where it says.
- **Touches:** `src/routes/transactions/index.tsx`,
  `src/routes/categories/import-rules.tsx`,
  `src/routes/categories/index.tsx`, `src/routes/budget/plan-tab.tsx`,
  `src/App.tsx`, `src/routes/transactions/new.tsx`.

Found 2026-10-12 while making the category detail page's Back link return to
the page it was opened from. **Traced through the code, not clicked through.**

- **"Set Up Rules" in the import warning forgets where it came from**
  (`transactions/index.tsx:956`). It links to the import rules page without
  `?from=transactions`, so Back there goes to Categories. The other link to
  that page, a few hundred lines up, has it. Add the parameter.
- **"Create categories first" on the import rules page is a dead end**
  (`import-rules.tsx:340`). It links to `/categories`, which lists categories
  and deliberately has no Add Category. Reword it to say a category is made
  when an allowance, a bill or a transaction is added, and drop the link.
- **Links to Budget land at the top of the page.** Budget already opens and
  scrolls to a section given `?section=income`, `fixed`, `variable` or
  `savings` (`plan-tab.tsx:182`). Two links should use it: the allowance and
  bill cells on the Categories list (`variable` and `fixed`).
- **`?tab=plan` does nothing.** The Budget page reads only `tab=overview`
  (`budget/index.tsx:28`). Three redirects in `App.tsx` and five links on
  Scenarios still carry it. Harmless; remove it when next in those files.
- **Saving on `/transactions/new` goes to a route that does not exist.**
  `transactions/new.tsx:73` navigates to `/transactions/<id>` and `App.tsx`
  defines no such path. Not checked: whether anything still links to
  `/transactions/new`, and what the app shows when it gets there. Look in a
  browser before fixing; the page may be dead and better deleted.

Not looked at: whether Cash Flow and Transactions keep the month and filters
that were selected when someone goes to a category and comes back.
