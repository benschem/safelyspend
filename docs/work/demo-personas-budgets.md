# Demo personas count their bills twice

- **Status:** not started. Raised 2026-10-12.
- **Goal:** every demo persona's category limit is its bills plus an allowance for
  the rest, so Cash Flow, the Budget page and the category pages show the numbers
  the persona was written to have.
- **Touches:** the four persona files in `src/lib/demo-personas/personas/`.
  `src/lib/demo-personas/generators.ts` is right and is not changed.

## Why

Each persona's `budgets` list was written when a category's budget meant its whole
limit, bills included. The app's model is that an allowance sits on top of the bills.
So Paul's Rent, a $2,200 bill with a $2,200 budget, reads "Budgeted $4,400" on Cash
Flow, and every persona's plan is overcommitted by the size of its bills.

This is data only. The generator is right: it makes a bill from any expense pattern
that is monthly with a fixed day (`src/lib/demo-personas/generators.ts:590`), and a
budget rule from each `budgets` entry.

## The rule

New allowance = old budget minus that category's bills. This keeps each persona's
intended totals, and keeps the "spends about X, N% under" comments true, because
the category's limit ends up where the old budget was.

- Where the remainder is nothing, remove the budget entry. The category becomes
  bill-only.
- A scenario override for a category with no budget entry does nothing, because the
  generator only walks `budgets`. Remove those overrides with the entry.
- Bills are the same in every scenario. An override is the allowance only.

## The lines

Categories not listed have no bills and do not change.

### Paul, `professional-paul.ts`

- Rent: $2,200 bill, $2,200 budget. Remove the budget.
- Subscriptions: $57.46 of bills, $58 budget. Remove the budget.
- Utilities: $244 of bills, $250 budget. Reduce to $10.
- Health & Fitness: $70 gym bill, $100 budget. Reduce to $30.
- Save for House Deposit: remove the Subscriptions override.
- Made Redundant: remove the Subscriptions override. Health & Fitness $40 becomes $10.

### Sanjay, `struggling-sanjay.ts`

- Rent: $1,400 bill, $1,400 budget. Remove the budget.
- Subscriptions: $61.88 of bills, $62 budget. Remove the budget.
- Utilities: $130 of bills, $150 budget. Reduce to $20.
- Getting Serious: remove the Subscriptions override.
- Hours Slashed: remove the Rent and Subscriptions overrides. Utilities $120 becomes $0.

### Soo-Jin, `student-soo-jin.ts`

- Phone: $25 bill, $25 budget. Remove the budget.
- Entertainment: $13.49 of bills, $40 budget. Reduce to $27.
- Rent: no change. It is a weekly pattern, so the generator makes no bill for it and
  nothing is doubled.
- Summer Internship: Entertainment $60 becomes $47.
- Cafe Closes: remove the Phone override. Entertainment $13.50 becomes $0.

### Evie, `exec-evie.ts`

- Mortgage: $3,200 bill, $3,200 budget. Remove the budget.
- Subscriptions: $200.92 of bills, $201 budget. Remove the budget.
- Transport: $450 parking bill, $1,250 budget. Reduce to $800.
- Utilities: $330 of bills, $350 budget. Reduce to $20.
- Health & Wellness: $250 gym bill, $650 budget. Reduce to $400.
- Travel: $50 bill, $280 budget. Reduce to $230.
- Tighten Up: Health & Wellness $300 becomes $50. Travel $120 becomes $70.

Also reword the comment above each file's `budgets` to say the entries are
allowances on top of bills.

## Proposed, not yet confirmed

- **Utilities keeps a small allowance.** The power bill varies by 10 to 15 percent,
  so the remainder works as headroom. Paul's exact remainder is $6, rounded here to
  $10. The alternative is to remove all three and leave Utilities bill-only.
- **Scenarios that cut a bill lose that cut.** Several overrides meant "cancel some
  subscriptions" or "a cheaper phone plan". The generator cannot vary a bill by
  scenario, so those scenarios save slightly less than they did. Teaching it to is
  left out.
- **Scenario descriptions that quote figures.** Sanjay's say "overcommitted by
  $120" and "$400 in the red". After this fix his plan is about $92 over, and Hours
  Slashed comes out about $380 ahead. The second figure was already wrong against
  the intended numbers. Correct the text, or leave it.
- **Soo-Jin's rent stays an allowance** of $250 a week, unless the generator learns
  to make weekly bills.

## Notes for whoever does it

- The figures above are worked out by hand from the persona files as they stood on
  2026-10-12. Recheck each one against the file before editing.
- "Bill" and "allowance" are the words the app has used since the rename on
  2026-10-12. The persona files still call the list `budgets`, a code name that
  stays.
- Demo persona changes take no version bump and no changelog entry.
- Check it by loading each persona and reading Cash Flow's category rows: no
  category should show a limit of twice its bills.
