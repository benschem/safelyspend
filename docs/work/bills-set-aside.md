# Bills by due date, a "set aside for bills" figure, and safe to spend

- **Status:** in progress, steps 1 to 4 of 6 done (0.44.6, 0.44.7, the
  set-aside function, and the set-aside line on the cash card in 0.45.0).
  Steps 5 and 6, safe to spend, are parked until the app has been used with
  figures that can be trusted. Raised 2026-10-12. Decisions settled and the
  plan reworked 2026-10-13, apart from two details under "Proposed, not yet
  confirmed".
- **Goal:** a bill counts in the month it is actually due, at its real amount,
  on every screen. Cash Flow separately shows how much of the cash balance is
  already spoken for by bills that have not landed yet, and from that, what is
  safe to spend on top of the plan.
- **Touches:** `src/lib/bill-set-aside.ts`, `src/lib/category-limits.ts`,
  `src/lib/cadence.ts`, `src/hooks/use-budget-period-data.ts`,
  `src/hooks/use-cash-surplus.ts`, `src/routes/cash-flow/index.tsx`,
  `src/components/cash-flow/summary-cards.tsx`.

## Why

Until 0.44.6 a category's monthly limit averaged every bill to a monthly
figure. A $900 yearly car registration showed as "$75" in every month: "Paid
$0 of $75" in eleven of them, and twelve times over in the twelfth.

Fixing that alone loses something real. The average was standing in, badly,
for a second idea the maintainer does want: putting $75 aside each month so
the $900 does not come out of one month's spending.

These are separate questions, and each needs its own number:

- **"Did I pay what was due this month?"** follows dates. Registration is $900
  in March and nothing in the other eleven months.
- **"Will the money be there in March?"** follows a reserve that builds up
  between due dates.
- **"We want to buy something we did not plan for. Can we afford it?"** needs
  both. It is the app's name and the landing page's promise ("the number left
  over is safe to spend"), and nothing calculates it today. The answer the
  maintainer wants is "yes, there is an extra $200 this month" or "no, the plan
  is already short, and groceries probably need cutting too".

## Decided

Stated by the maintainer, 2026-10-12:

- **Both dated rows and a set-aside figure are wanted.**
- **This is not savings.** A savings goal is money you choose to keep; this is
  money already owed at a later date. Modelling it as a goal would also inflate
  the savings total. So no savings goal, no new entity, and no money moved.

Settled with the maintainer, 2026-10-13:

- **The reserve is not taken off the balance on the cash card.** The
  set-aside line sits beneath the balance and leaves it unchanged. The card
  has no balance for today: its one figure is the month end (projected,
  planned or actual), so the line is measured at the month's last day. That
  departs from the earlier decision that the real balance stays the headline,
  which assumed the card showed today's balance.
- **Only quarterly and yearly bills build a reserve.** More than a month passes
  between their due dates, so a month-by-month view cannot see them coming. A
  weekly, fortnightly or monthly bill comes round every month and is handled by
  looking ahead instead (step 5).
- **The reserve grows by the day**, not in a monthly jump.
- **A bill added mid-cycle is spread over the time left.** Add a $900 bill six
  months before it is due and the reserve is $0 that day, grows $150 a month,
  and reaches $900 on the due date. After that it settles to $75 a month. It
  does not show a $450 catch-up on day one.
- **Safe to spend is in this plan**, as its last figure, in place of a "spare
  cash" number.
- **Safe to spend means on top of the plan.** It is what is left once bills,
  savings and the rest of the month's allowances are all covered. Spending that
  an allowance already covers, such as a night out from Entertainment, is not
  what it measures; the category row shows that. This reverses an earlier
  answer the same day, where allowances were not subtracted. That figure meant
  "how much before a bill bounces" and included the grocery money.
- **No payday is picked as a horizon.** The figure is the lowest point the
  balance reaches when walked forward through every pay, bill, saving and
  allowance in date order. A pay only helps with what comes after it, which
  handles two incomes without choosing between them.
- **Every screen moves together.** The change went in the shared helper, not in
  Cash Flow alone, so the "one limit everywhere" property from 0.44.1 holds.
- **The projection uses the per-category rule** (step 2). The maintainer wants
  it to work this way and does not see it as a stopgap: it is the assumption
  the "Paid $A of $X" rows and the category limit already make.

## Proposed, not yet confirmed

- **How far ahead the walk goes.** Proposed: 31 days, so every pay cadence up
  to monthly appears at least once. That is also the line between the two
  tools: a bill inside the walk is trusted to the pays in the walk, and a
  quarterly or yearly bill beyond it is held in the reserve. A walk of a year
  would hand those bills to a forecast a year long and drop their reserve.
- **How the rest of an allowance is spread.** Proposed: what is left of each
  category's allowance this month, spread evenly over the days remaining, then
  the full allowance spread evenly over any days of next month inside the walk.

## The model

- **Set aside for a bill** = its amount × the share of the build-up period that
  has elapsed, counted in days. The build-up period ends on the next due date
  and starts on the latest of: the previous due date, the day the rule was
  created, and the rule's `startDate` if it has one.
- **Set aside for bills** = the sum of that across every quarterly and yearly
  bill in the active scenario.
- **Safe to spend** = the lowest point of the running balance over the walk
  − set aside for bills that are not inside the walk.

  The walk starts at today's cash balance and applies, in date order, every
  expected pay, every bill and planned saving, and each day's share of the
  allowances still to be spent.

Today is the first point of the walk, so the figure can never be more than the
balance: a future pay can cancel a later bill but cannot raise the answer.

It is a close relative of the projected month end, which is where the same
walk finishes if it stops on the last day of the month. Safe to spend is the
lowest point on the way, less the reserve.

Everything is derived from the forecast rules, the transactions and a date.
Nothing new is stored, so there is no schema version bump and no change to the
export format.

The balance follows real dates: it falls by $900 in March. The reserve rises a
little every day and drops to zero on the day the balance drops, so paying the
registration does not move safe to spend. Over a full cycle this agrees with
the Budget page's Income Breakdown, which plans $75 a month for that bill.

Personal spending money uses the same idea for its envelopes: cash that is in
the account and already has a claim on it (`household-personal-money.md`,
"An allowance is a transfer, not an expense"). When both exist they compose:
safe to spend also subtracts envelopes.

## What the code does now

Checked against the code 2026-10-13, as of 0.47.1.

- **Nothing links a transaction to a bill.** `Transaction` has no rule field.
  The category is the only join.
- **The Budget page's average is correct and must not change.** `plan-tab.tsx`
  converts to the period the user picks. That page is a plan, where an average
  is the right answer.
- **Expanding a rule.** `expandForecastRule` in `src/lib/cadence.ts` turns a
  rule into dated occurrences over a range, honouring `startDate`, `endDate`
  and `excludedDates`.
- **The summary cards use dates.** `calculatePeriodCashFlow` in
  `use-budget-period-data.ts` sums expanded forecasts by their `date`.
- **The cash balance.** `useCashSurplus` in `src/hooks/use-cash-surplus.ts`
  walks transactions forward from the active balance anchor. The planned and
  projected month ends are worked out in `cash-flow/index.tsx`.

## Steps

Each step is its own commit and can ship alone.

### 1. A category's limit uses what is due in the month

Done 2026-10-13, in 0.44.6. `buildMonthlyLimitsByCategory` in
`src/lib/category-limits.ts` now sums the bill occurrences that fall inside
the range it is given. Rule expansion moved to `src/lib/cadence.ts` in its own
refactor commit first. Tests are in `src/__tests__/lib/category-limits.test.ts`.

- A mixed category's limit is what is due this month plus its allowance.
- A category with a bill and nothing due this month has no bill amount this
  month. If it also has no allowance it has no entry, so Cash Flow does not
  list it unless it has spending.
- An occurrence removed with "delete this occurrence" (`excludedDates`) is not
  due.
- For a quarter or year the helper is given the whole range and returns every
  bill due in it, so the two callers add `billsCents` to the allowance times
  `periodMultiplier`. They do not loop over months. The allowance half is
  still approximate outside month view; see `category-limit-loose-ends.md`.
- Insights calls the helper once per month, so it followed without a change.
- The category page works out a limit per month, and the chart's limit line
  is stepped, not curved. Not yet looked at in a browser.
- The category page's wording changed from "a month in bills" to "in bills due
  this month".
- Not done: Cash Flow's savings progress still compares a dated month with a
  monthly average. See `cash-flow-averages.md`.
- A fortnightly bill lands in the right weeks only by chance. See
  `fortnightly-anchor.md`.
- The three checks for "is this rule active in a range" were not merged. See
  `category-limit-loose-ends.md`.
- Showing both parts on Cash Flow's rows is the same row and a separate
  display decision. See `bills-and-allowance-parts.md`.

### 2. The projection lets a category's spending fill its bills first

Done 2026-10-13, in 0.44.7. `calculatePeriodCashFlow` works out day-to-day
spending per category: spending in a category counts towards that category's
bills for the month first, and only the excess is day-to-day. It uses the
per-category dated figure from step 1. Tests are in
`src/__tests__/hooks/use-budget-period-data.test.ts`.

- The breakdown's "Now" column showed bills due so far. It now shows what was
  paid towards bills (`expenses.paidTowardsBills`, which replaces `dueToDate`),
  so its rows add up to what was actually spent.
- A bill with no category is taken off spending that has no category either,
  once it is due. The dialog does not allow such a bill, so this only arises
  from imports.

### 3. A pure function for what should be set aside

Done 2026-10-13. `calculateBillsSetAside` in `src/lib/bill-set-aside.ts` takes
the rules and an as-of date and returns, per quarterly or yearly bill, the
amount set aside, the bill's amount and its next due date. `sumSetAsideCents`
totals them. No React, no database. Tests are in
`src/__tests__/lib/bill-set-aside.test.ts`.

Choices made while building it:

- On the day a bill is due, the whole amount is still set aside. It starts
  again the day after.
- The day a rule was created is taken as a local date from `createdAt`.
- Due dates are searched three years either side of the date, which covers a
  yearly bill with one occurrence excluded.
- If the occurrence before today was excluded, the build-up runs from the one
  before that, so the reserve never drops on a date when nothing was paid.

Cases tested:

- **Mid-cycle.** $900 yearly is about $450 six months after the last due date.
- **Added mid-cycle.** Created six months before the due date: $0 on the day,
  $900 on the due date.
- **Last cycle.** After `endDate` there is no next due date, so nothing builds.
- **An excluded next occurrence.** Build towards the one after it.
- **Several bills.** Each builds on its own. The test does not put them in
  one category.
- **Weekly, fortnightly and monthly bills** return nothing.
- **The amount.** The reserve scales with it. No test edits an amount part
  way through a cycle; the function reads only the current amount, so an
  edited one is treated as if it had always been that amount.

### 4. Show the set-aside figure

Done 2026-10-13, in 0.45.0. Not yet looked at in a browser. The cash card
shows "of which $X will be set aside for bills" under the month end balance.
Display only: it does not change the planned or projected month end, or the
ahead/behind pill.

- X is measured at the month's last day, because the card's one figure is the
  month end. Step 5 still needs the figure as of today, which the function
  gives for any date.
- Not shown on a past month. The rules are today's rules, so a past figure
  would be invented.
- A bill due on the month's last day is left out. It has already come out of
  the month end balance, and the function counts a bill as owed in full on its
  due date. The filter is in the page (`billsSetAsideAtMonthEnd` in
  `cash-flow/index.tsx`), not in the function.
- When X is more than the month end balance the line turns amber and reads
  "$X needed for bills, $Z more than the balance".
- The line opens a popover listing each bill, soonest first, with how much is
  set aside of how much, when it is next due, and a total. A tooltip was too
  small for more than three or four bills.
- Shown at $0 when a bill exists but has only just been added. Hidden only
  when there is no quarterly or yearly bill.
- On a future month the balance it sits under leaves out the months in
  between. See `future-month-end.md`.
- No test added: the repo has no component tests and the function was already
  covered.

### 5. Safe to spend

A pure function first, then the figure on the cash card beside the balance.

- Walk forward from today's balance through the dated pays, bills and savings,
  which already exist as expanded forecasts, plus the allowance still to be
  spent. Take the lowest point. Length and allowance spread: see "Proposed, not
  yet confirmed".
- What is left of an allowance is the allowance less the category's day-to-day
  spending so far this month, which step 2 works out. Never less than zero: an
  overspent allowance has already lowered the balance.
- Subtract the set-aside figure from step 3, leaving out any bill that falls
  inside the walk.
- Show the working behind the figure: balance, less bills and savings coming
  up, less set aside for bills, less allowances for the rest of the month.

Cases to settle and test:

- Two pays of similar size on different days, with a bill between them.
- A pay and a bill on the same day. Apply the pay first.
- A bill inside the walk that is already paid. Use step 2's rule so it is not
  subtracted twice; the walk can cross a month boundary.
- A negative result. Show it as a shortfall, do not clamp to zero.
- No allowances at all: the figure is what is left after bills and savings.
- No income rules: the walk only falls, so the figure is its last point.
- No balance anchor: show nothing.

`net-wealth.tsx` and the check-in wizard keep showing the balance alone.

### 6. Say what the figures are

One sentence where each appears. Set aside: money for bills that are not due
yet. Safe to spend: what is left on top of the plan, once bills, savings and
allowances are covered. Goes with `bills-and-allowance-parts.md`, which is the
same confusion from the other side.

### Versioning

Step 5 puts a new figure on screen, so a minor bump. Step 6 needs no bump of
its own and can ride with step 5. No schema or data version change at any
step.

## Known limits

Nothing links a transaction to the bill it pays, so the category stands in.

- **A category with both a bill and day-to-day spending.** Anything spent before
  the bill is paid reads as progress on the bill, so the projection runs
  generous until the bill lands. Safe to spend is barely affected: the bill
  looks smaller and the allowance left looks bigger by the same amount.
- **Paid early.** Pay the registration two weeks before it is due and the
  balance falls by $900 while most of $900 is still shown as set aside.
- **Paid late.** After the due date the reserve resets to zero, but the money
  has not left.
- **Catching up costs more than the plan shows.** A bill added six months out
  claims $150 a month until its first due date, while the Budget page plans $75.
- **Safe to spend is only as good as the allowances.** An allowance set too low
  makes the figure read generous. With no allowances it is the "before a bill
  bounces" figure and includes the grocery money.

Storing which bill a transaction pays, suggested at import and editable by
hand, would remove the first three. It is a maybe, and only if the first limit
turns out to matter. It is the only version that knows and does not assume,
and it is large: import and export schema, the transaction dialog, the import
review, a backfill for existing transactions, and it would land in the middle
of the sync merge work (`sync-merge.md`).

## Holes found in safe to spend, not yet handled

Found 2026-10-13 while checking the design, after the steps were written. None
is reflected in step 5 yet. They matter only when step 5 is picked up.

- **The balance is only as fresh as the last import.** The most serious of
  the four. The walk starts from "today's balance", but the app knows the
  balance only up to the latest transaction entered or imported. A bill due
  since then is in neither the balance nor the walk, so the figure is too
  generous by the whole bill. A likely fix is to start the walk the day after
  the latest transaction, not today. Not checked: how the app tracks import
  dates. Not answered: how often the maintainer imports.
- **A pay that lands a day early is counted twice.** It is already in the
  balance and the walk still adds it on the rule's date. Bills are covered by
  step 2's per-category rule; pays are not. Cash Flow already works out
  expected income for the month less what has been received, and the walk can
  reuse that.
- **The reserve should be measured at the low point, not today.** If the low
  point is 20 days away, the reserve has to be 20 days bigger by then. Small
  for one bill, a few hundred dollars with several. Without it, safe to spend
  also jumps slightly on the day a yearly bill comes inside the walk.
- **The figure leans on future pay.** It can never exceed today's balance, but
  when the low point comes after a payday the answer assumes that pay arrives
  on time and in full. Fine for a salary, optimistic for irregular income.
  This is a known limit to record, not a case to fix.

## Not in this plan

- Linking a bill to a savings goal so a saver pays it.
- Moving real money anywhere.
- Storing a link between a transaction and a bill.
- Changing the Budget page.
- A separate "before a bill bounces" figure. It appears only as a line in safe
  to spend's working.
- The sample personas, which double every limit in a category with bills
  (`demo-personas-budgets.md`). Expect odd demo numbers.

## Not verified

- Steps 1 to 3 shipped with unit tests, and step 4 with none of its own. The
  stepped limit line on the category
  chart and the set-aside line on the cash card have not been looked at in a
  browser.
- Whether Cash Flow has quarter and year views that are reachable. Every
  caller in `src` passes `viewMode: 'month'` today.
- Nothing in steps 5 and 6 has been built or run.
