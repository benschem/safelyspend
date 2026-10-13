# Create a category on save, not on pick

- **Status:** not started. Raised 2026-10-11. Direction not yet decided.
  `combobox.md` rewrites the same picker.
- **Goal:** typing a new category name into a form and cancelling leaves no
  category behind.
- **Touches:** `src/components/creatable-select.tsx` and the forms that use it.

## Why

Raised 2026-10-11 as a question: if there is nothing in a category, does it
delete itself? It does not. **Traced through the code, not clicked through.**

The half about having nowhere to delete one from was answered 2026-10-12: the
Categories list shows every category, empty ones included, and its bin is
enabled when nothing uses the category. `deleteCategory` in
`src/hooks/use-categories.ts` is still the only thing that removes one, called
from that list, the category detail page and the bin in the Budget page's edit
dialog. Nothing runs on its own.

They are still easy to make. The picker creates a category the moment "Create"
is chosen, so typing a name in Add Allowance or the transaction form and then
cancelling leaves one behind, and someone has to notice it on the list.

Directions, not yet decided:

- **Create on save, not on pick.** The dialog holds the typed name and creates
  the category only when the allowance or transaction is saved. Stops new orphans
  and does nothing for existing ones. A contained change to the picker and its
  callers.
- **Delete empty ones automatically.** Risky: a category someone has just made
  and not yet used looks the same as an abandoned one, and a pull from the
  other household member could remove it under them.
