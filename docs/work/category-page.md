# Category page: say what period each part covers

- **Status:** not started. Everything under Decided is agreed.
- **Goal:** every part of the category page names the period it covers, and
  the two lists at the bottom no longer stop at the current month.
- **Touches:** `src/routes/categories/detail.tsx`,
  `src/components/description-breakdown.tsx`.

## Why

A category with many transactions shows one row under Where It Went and one
under Recent Transactions. Both are fed the current calendar month
(`periodTransactions` in `detail.tsx`), while the chart above them covers 12
months and the Transactions page lists every month. Neither panel names its
period: the "October 2026 · Day 13 of 31" label sits above the summary cards,
with the chart between it and the panels.

"View all" renders only when the month has more than 10 transactions (the
`periodTransactions.length > 10` check in `detail.tsx`), so there is usually
no way from this page to the full list.

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
- **Monthly Spending chart:** unchanged apart from its heading.
- **Where It Went:** covers the same 12 months as the chart. Still one row
  per description with its share of the total, top eight then Other. The
  heading names the period.
- **Recent Transactions:** the latest 10 for the category, whatever the
  month. "View all" always shows. The heading names the period.

No month picker.

The detail:

- **Allowance card amount.** Show the monthly figure
  (`monthlyLimit.allowanceCents`) as the number, so it adds up with the bills
  card to the budget in the month card. Under it, the allowance as entered
  when there is one and it is not monthly ("$50/weekly"), or "from 3
  allowances" when there are several.
- **A card with nothing in it.** Keep both cards always, so the layout does
  not jump between categories. No allowance: a dash and a "Set one" link. No
  bills due: "$0".
- **Where "Set one" goes.** `/budget?section=expenses`, which opens the
  Expenses tab and scrolls to it through `SECTION_FOR_PARAM` in
  `plan-tab.tsx`. The title line links to `/budget?tab=plan` now, and the
  Budget page ignores `tab=plan`.
- **Headings.** "Where It Went · last 12 months" and "Recent Transactions ·
  latest 10". Add "· last 12 months" to "Monthly Spending" to match. Each is
  an `h2` followed by a muted span, as the month label is now.
- **The transaction count in the month card.** "3 transactions" is a link
  that scrolls to the `recent-transactions` id in `detail.tsx`. The count is
  this month's and the list no longer is. Make it plain text and remove the
  id, which nothing else uses.
- **Recent Transactions with fewer than 10.** Show "View all" anyway. It is
  the only route to the category's full list.
- **Transactions dated after this month.** Leave them out of Recent
  Transactions, so the list ends where the chart does (`periodEnd`). Taken
  from every expense with no cap, a transaction dated next month would head
  the list.
- **Empty messages.** "No transactions yet." under Recent Transactions, which
  says "No transactions this month." now. "No spending in the last 12
  months." in `DescriptionBreakdown`, which says "No transactions in this
  period."
- **The merged month card.** Drop the three coloured icon circles and keep
  the progress bar under vs Budget. The three figures sit in columns on
  desktop and in stacked rows on a phone.
- **Tests.** None added. The change swaps which transactions feed two panels,
  and the page has no test to extend. Pulling the grouping out of
  `DescriptionBreakdown` into `src/lib/` to test it is a larger change than
  this one.
- **Versions.** One per commit under Steps: 0.54.0 and 0.54.1. The session
  working on `balances.md` shares this working tree and also writes
  `package.json`, `package-lock.json` and `src/lib/changelog.ts`, so if it is
  staged first these each move up by whatever it took.

## Steps

Two commits. Each leaves the page working, carries its own changelog entry
and version bump, and is checked in a browser at phone and desktop widths
before it is staged.

### 1. `feat:` the two lists cover more than this month (0.54.0)

`detail.tsx`, `description-breakdown.tsx`, `changelog.ts`, `package.json`,
`package-lock.json`.

1. Feed Where It Went the chart's transactions (`chartTransactions`) and
   their total. Change the empty message in `DescriptionBreakdown`.
2. Take Recent Transactions from every expense in the category dated up to
   `periodEnd`, latest 10. Change its empty message.
3. Show "View all" unconditionally.
4. Add the period to the three headings: Monthly Spending, Where It Went and
   Recent Transactions.
5. Make the transaction count in the Spent card plain text and remove the
   `recent-transactions` id. It belongs here because this is the commit that
   makes the link point at a list the count no longer describes.

Check with a category that has transactions in earlier months and none this
month, and with one that has none at all.

### 2. `fix:` cards for bills, allowance and this month (0.54.1)

`detail.tsx`, `docs/work/wrong-links.md`, `changelog.ts`, `package.json`,
`package-lock.json`, `docs/BACKLOG.md`, and this file deleted.

1. Replace the line under the title with the "Bills due this month" and
   "Allowance" cards.
2. Point "Set one" at `/budget?section=expenses`.
3. Merge Spent, vs Budget and vs Last Month into one card, without the icon
   circles.
4. Move the month label into the card.
5. In `wrong-links.md`, take the category detail page out of the `?tab=plan`
   bullet, and out of the bullet about links to Budget, which calls "No
   budget set" a link when it is plain text.
6. Remove this work file and its line in `BACKLOG.md`.

Check with a category that has bills only, an allowance only, both, neither,
one allowance that is not monthly, and several allowances. Check the month
card with a category over its budget, under it, and with no budget.

## Not in this plan

- The same two-part display on the Budget page and Cash Flow, in
  `bills-and-allowance-parts.md`. Use the same words for the two parts on
  all three screens.
- Delete on this page ignoring allowances and bills, in `delete-cascades.md`.
- Rule start and end dates in the limit, in `category-limit-loose-ends.md`.
- "View all" landing on the Transactions page with its filter in the URL.
  The page reads `?category=` on load today, so the link works. Keeping
  filters in the URL as they change is its own line in `BACKLOG.md`.

Read in the code on 2026-10-13, not seen in a browser: that the panels are
scoped to the month, that `DescriptionBreakdown` has no other caller, that
the Transactions page reads `?category=` on load, and that the Budget page
accepts `?section=expenses`. Not checked: how the merged card and the two new
cards sit at phone width, and whether a transaction can be dated in the
future through the app's own forms or only through import.
