# Combine two existing budgets when two people join up

- **Status:** parked. Wishlist. Needs `sync-merge.md` and `category-duplicates.md`
  first.
- **Goal:** two people who each already have a budget can combine them.
- **Touches:** the merge function from `sync-merge.md`, categories, scenarios and balance anchors.

## Why

Raised 2026-10-13, from `docs/work/sync-merge.md`. Sync merges two copies of
the same budget. When two people who each already have a budget join up, the
choice is one or the other.

Running the record merge across two unrelated budgets would not combine them:

- **Categories.** Each side has its own "Groceries" under its own id, so every
  name appears twice. This needs the category merge from "Two categories can
  still end up with the same name" first.
- **Plans.** Bills and allowances belong to a scenario, and each side has its
  own default. Combining means folding one scenario's rules into the other's,
  and deciding what happens when both set an allowance for the same category.
- **Balances.** Each side has an opening balance and may have balance anchors.
  Here the two are different pots of money, so anchors on the same date add
  together. This is the opposite of the sync merge, which keeps the newer one
  because both describe the same pot. Anchors on different dates cannot simply
  add. That needs the one-anchor-per-date rule relaxed, so each person's
  anchor stands on its own and the balance sums the latest from each.

The vault id already says which case applies: the same id means one shared
budget and the sync merge, a different or missing id means two budgets and
this combine. The combine is its own code path, not a flag on the merge.

Until then the workaround is to keep the budget with more history and bring
the other person's transactions in with a bank CSV import.
