# Category page: say what period each part covers

- **Status:** not started. The layout under Decided is agreed; the items under
  Proposed need a yes.
- **Goal:** every part of the category page names the period it covers, and
  the two lists at the bottom no longer stop at the current month.
- **Touches:** `src/routes/categories/detail.tsx`,
  `src/components/description-breakdown.tsx`.

## Why

A category with many transactions shows one row under Where It Went and one
under Recent Transactions. Both are fed the current calendar month
(`periodTransactions`, `detail.tsx:141`), while the chart above them covers 12
months and the Transactions page lists every month. Neither panel names its
period: the "October 2026 · Day 13 of 31" label sits above the summary cards,
with the chart between it and the panels.

"View all" renders only when the month has more than 10 transactions
(`detail.tsx:548`), so there is usually no way from this page to the full
list.

The line under the page title packs the allowance, its monthly equivalent and
the bills due into one sentence of small grey text.

## Decided

2026-10-13. The page from top to bottom:

- **Header:** back link, title, Edit, Archive and Delete, as now. The small
  text under the title goes.
- **Two cards:** "Bills due this month" with its amount, and "Allowance" with
  its amount.
- **One card for this month:** Spent, vs Budget and vs Last Month merge into
  one card, with the "October 2026 · Day 13 of 31" label inside it.
- **Monthly Spending chart:** unchanged.
- **Where It Went:** covers the same 12 months as the chart. Still one row
  per description with its share of the total, top eight then Other. The
  heading names the period.
- **Recent Transactions:** the latest 10 for the category, whatever the
  month. "View all" always shows. The heading names the period.

No month picker.

## Proposed

- **Allowance card amount.** Show the monthly figure
  (`monthlyLimit.allowanceCents`) as the number, so it adds up with the bills
  card to the budget in the month card. Under it, the allowance as entered
  when there is one and it is not monthly ("$50/weekly"), or "from 3
  allowances" when there are several.
- **A card with nothing in it.** Keep both cards always, so the layout does
  not jump between categories. No allowance: a dash and the "Set one" link to
  `/budget?tab=plan` that the title line has now. No bills due: "$0".
- **Headings.** "Where It Went · last 12 months" and "Recent Transactions ·
  latest 10". Add "· last 12 months" to "Monthly Spending" to match.
- **The transaction count in the month card.** "3 transactions" is a link
  that scrolls to Recent Transactions (`detail.tsx:405`). The count is this
  month's and the list no longer is. Make it plain text.
- **Recent Transactions with fewer than 10.** Show "View all" anyway. It is
  the only route to the category's full list.

## Steps

1. Feed Where It Went the chart's transactions and their total, and add the
   period to its heading. `DescriptionBreakdown` is used nowhere else and
   needs no change beyond its empty message, which says "in this period".
2. Take Recent Transactions from every expense in the category, latest 10,
   with "View all" unconditional.
3. Replace the title line with the two cards.
4. Merge the three summary cards into one and move the month label into it.
5. Changelog entry and version bump, staged with the change.
6. Check in a browser at phone and desktop widths, with a category that has
   bills only, an allowance only, both, and neither.

## Not in this plan

- The same two-part display on the Budget page and Cash Flow, in
  `bills-and-allowance-parts.md`. Use the same words for the two parts on
  all three screens.
- Delete on this page ignoring allowances and bills, in `delete-cascades.md`.
- Rule start and end dates in the limit, in `category-limit-loose-ends.md`.
- "View all" landing on the Transactions page with its filter in the URL.
  The page reads `?category=` on load today, so the link works. Keeping
  filters in the URL as they change is its own Inbox line in `BACKLOG.md`.

Read in the code on 2026-10-13, not seen in a browser: that the panels are
scoped to the month. Not checked: how the merged card and the two new cards
sit at phone width.
