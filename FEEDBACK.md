# Beta Feedback

Organized feedback from early usage testing. Items marked ✅ are already implemented.

---

## 🔴 Bugs & Broken Behavior

### Data Display Issues
- [x] **Snapshot**: Month end card shows "in the red" when monthly plan is $0 or doesn't exist ✅ 0.3.1
  - *Fixed: Shows "No plan set" message when no budget/forecast exists*

- [x] **Spending**: Month end card shows income as $0 when forecast is $0 (should show actual income) ✅ 0.3.1
  - *Fixed: Shows actual income with "X earned" when no forecast*

- [x] **Spending**: Month end card shows "$9,017 below $13,954 plan" with no plan set - unclear source ✅ 0.3.1
  - *Fixed: Only shows plan comparison when plan actually exists*

- [x] **Savings**: Due date calculation broken when no income forecast (showed "8 years late") ✅ 0.3.1
  - *Fixed: Shows "Unable to estimate" for estimates >5 years out*

### Input Validation
- [x] **Balance anchors**: Should handle commas in amount input ✅ 0.3.1
  - *Fixed: Strips commas, dollar signs, and whitespace before parsing*

- [x] **Balance anchors**: Should validate if user enters 0 or includes dollar sign ✅ 0.3.1
  - *Fixed: Cleans input and validates properly*

- [x] **Recurring rules**: Day 31 selection - user doesn't know it rolls to last day of month ✅ 0.3.1
  - *Fixed: Shows helper text "For shorter months, uses last day of month" when day > 28*

---

## 🟡 UX Improvements

### Terminology & Consistency
- [x] **App-wide**: Use "Spending" consistently (not "Expenses" in some places) ✅ 0.3.2
  - *Fixed: Cash flow chart legend uses "Spending", period averages use "Earned/Spent/Saved"*

- [x] **App-wide**: Expand shorthand labels (/fn → /fortnight, /wk → /week, etc.) ✅ 0.3.2
  - *Fixed: CADENCE_SHORT_LABELS now uses /week, /fortnight, /month, /quarter, /year*

- [ ] **Forecasts**: Use "Expected" not "Projected/Plan" (budget is the plan)
  - *Idea: Forecasts = "Expected" (known/fixed), Budgets = "Planned" (targets/limits)*

- [x] **Insights**: Cash flow terms should be "Earned, Spent, Saved" ✅ 0.3.2
  - *Fixed: Updated chart tooltips, legends, and period averages card*

- [ ] **Insights**: "Actual this month" → "Saved this month" on savings graph
  - *Idea: Label change on savings chart*

- [ ] **Insights**: Spending graph hover tooltips should only show selected categories
  - *Idea: Filter tooltip data based on visible/selected legend items*

- [ ] **Spending**: "Unplanned" → "Uncategorised" on category chart
  - *Idea: Terminology consistency - "Uncategorised" is clearer*

- [ ] **Add transaction**: "Deposit" → "Contribute" for savings
  - *Idea: "Contribute" / "Withdraw" feels more natural for savings goals*

### Confusing UI Elements
- [ ] **Snapshot**: Average card confusing when net negative but saved positive
  - *Idea: Rethink the math or add explanatory text; maybe show income/spending/savings separately*

- [ ] **Savings goal cards**: "Target vs Overdue date" unclear what they represent
  - *Idea: Better labels - "Target amount", "Target date", "On track?" with color indicator*

- [ ] **Budget**: When adding yearly cadence, why show day selection? Is this reset day?
  - *Idea: May not need day/month for budgets at all - budgets are limits, not scheduled events; simplify UI*

- [ ] **Budget**: No way on page to see if total budgets exceed income; when adding new budget should indicate "room in budget"
  - *Ideas:*
    - *Summary row at bottom of budget table: "Total: $X/mo budgeted of $Y/mo income"*
    - *Progress bar or percentage indicator*
    - *Color warning if over 100% of income*
    - *In add/edit dialog: "Unallocated: $Z/mo remaining" helper text*
    - *Consider: Should this compare to forecasted income or actual average income?*

- [ ] **Misc**: Unclear difference between forecast vs budget - needs explanation somewhere
  - *Ideas:*
    - *Add info tooltip/popover on each page explaining the concept*
    - *Onboarding tour for new users*
    - *Forecast = "I WILL spend $X on rent" (known, fixed)*
    - *Budget = "I WANT to spend max $X on dining" (target, variable)*

### Layout & Arrangement
- [ ] **Spending page**: Rearrange - Cash flow graph top right, same row as month end card, burn rate below full width
  - *Idea: CSS grid rearrangement; may need responsive breakpoints*

- [ ] **Spending page**: Add "Actual spend by category" chart (like planned allocation but for actuals)
  - *Idea: Pie/donut chart of actual spending by category; place before the budget comparison chart*

- [ ] **Add transaction dialog**: Reorder fields - Amount + Type same row first, then Description
  - *Idea: Amount is most important, type determines other fields; description can come after*

### Form Improvements
- [ ] **Add transaction (savings)**: Show savings goal selector right after type, before date/amount
  - *Idea: When type="savings", reorder: Type → Goal → Deposit/Withdraw → Amount → Date*

- [ ] **Add transaction (savings)**: Hide "Create savings goal" option when Withdraw selected
  - *Idea: Can't withdraw from a goal that doesn't exist; conditional rendering*

- [ ] **Add transaction (savings)**: Add colored chevrons (red/green) to deposit/withdraw options
  - *Idea: Match the table display; green ChevronUp for contribute, red ChevronDown for withdraw*

- [ ] **Category select**: Can't scroll properly in dialog popovers
  - *Idea: Check SelectContent max-height and overflow settings; may need portal or z-index fix*

### Navigation
- [ ] **Category detail page**: Back button always goes to /categories, should go to previous page
  - *Idea: Use `useNavigate(-1)` or track referrer; fallback to /categories if no history*

---

## 🟢 New Features

### High Priority
- [ ] **Categories**: Bulk apply - apply category to all matching transaction descriptions
  - *Ideas:*
    - *Button on category page: "Apply to all matching transactions"*
    - *Or when categorizing one transaction: "Apply to all with same description?"*
    - *This is essentially what import rules do but retroactively*

- [ ] **Budget page**: Add "Create Scenario" button
  - *Idea: Quick access without going to Scenarios page; opens scenario dialog*

- [ ] **Budget breakdown**: Add hide/show all toggle
  - *Idea: Collapse/expand all categories at once; useful for long lists*

- [ ] **Savings anchors**: Like balance anchors but for savings (e.g., "$8,405.89 as at 1 Jan 2025")
  - *Ideas:*
    - *New entity type: SavingsAnchor { savingsGoalId, date, balanceCents }*
    - *Per-goal anchors so each savings goal can have its own starting point*
    - *UI in savings goal detail or settings*

### Import Improvements
- [ ] **CSV Import**: Preview auto-categories before importing
  - *Ideas:*
    - *Show "Category Rules Preview" step before final import*
    - *Table showing: Description → Matched Rule → Category*
    - *Allow overriding individual matches*

- [ ] **CSV Import**: Allow skipping individual transactions in preview
  - *Idea: Checkbox column in preview table; unchecked items won't be imported*

### Transaction Entry UX
- [ ] **Forecasts + Transactions**: Consider combining into one page with tabs/filters
  - *Ideas:*
    - *Single "Transactions" page with tabs: "Past" / "Expected"*
    - *Or filter toggle: "Show: All | Past | Future"*
    - *Reduces navigation, shows full picture*

- [ ] **Add buttons**: Combine one-time/recurring into single dialog with toggle
  - *Idea: Toggle at top of dialog: "One-time / Recurring" - shows relevant fields based on selection*

- [ ] **Add buttons**: Rename to "+Add Forecasted", "+Add Past", "Import Past From CSV"
  - *Idea: Clearer terminology; "Forecasted" vs "Past" is more intuitive than "Forecast" vs "Transaction"*

- [ ] **Import rules**: Move under Import button; Manage recurring under Forecasts button
  - *Idea: Group related actions together; reduces cognitive load*

### Tooltips & Help
- [x] **Table badges**: Tooltips on +$50/-$70/^$120 explaining earned/spent/saved ✅ 0.3.2
  - *Fixed: Amount badges now show tooltips like "Income earned", "Amount spent", "Contributed to savings"*

- [ ] **Transaction notes**: Where are notes visible? Add tooltip or make more prominent
  - *Ideas:*
    - *Currently shown in tooltip on description hover - make this more discoverable*
    - *Maybe show note icon indicator if note exists*
    - *Or expand row to show notes below*

### Savers/Interest
- [ ] **Savings goals**: Handle interest rate changes over time
  - *Ideas:*
    - *Complex: Array of { date, rate } for historical rates*
    - *Simple: Just use current rate, accept inaccuracy for past*
    - *May be over-engineering for MVP*

### Setup Experience
- [ ] **First-run wizard**: Overhaul - talks about "current balance" when date could be in past
  - *Ideas:*
    - *Step 1: "When do you want to start tracking?" (date picker)*
    - *Step 2: "How much cash did you have on [date]?"*
    - *Step 3: Optional - "Do you have any savings to track?"*
    - *Clearer language throughout*

---

## ✅ Already Implemented

- [x] Budget prompt when creating recurring expenses
- [x] "Add to Budget" action on transactions page
- [x] Convert one-time forecasts to recurring ("Make Recurring" button)
- [x] Table pagination preservation when editing
- [x] Search functionality fix
- [x] Mobile layout fixes
- [x] Bug fixes (0.3.1): Spending page $0 plan handling, savings estimates, input validation, day 31 helper

---

## 💡 Additional Suggestions (Not in Original Feedback)

### Consistency & Polish
- [ ] **Empty states**: Review all pages for helpful empty state messages
  - *Idea: Each empty state should explain what goes here and have a CTA to add first item*

- [ ] **Loading states**: Ensure skeleton loaders on all data-heavy pages
  - *Idea: Audit pages; add Skeleton components where data loads*

- [ ] **Error messages**: User-friendly error messages on all forms
  - *Idea: Replace technical errors with actionable messages*

### Data Validation
- [ ] **All amount inputs**: Handle currency symbols, commas, negative signs gracefully
  - *Idea: Create shared `parseAmount()` util that handles all edge cases*

- [ ] **Date inputs**: Validate date ranges make sense (end after start, not in far future/past)
  - *Idea: Add validation in date range picker component*

### Accessibility
- [ ] **Keyboard navigation**: Ensure all dialogs and forms are keyboard accessible
  - *Idea: Test with Tab key; ensure focus trapping in dialogs*

- [ ] **Focus management**: Return focus to trigger element when dialogs close
  - *Idea: Radix Dialog should handle this; verify it's working*

### Quality of Life
- [ ] **Duplicate detection**: Warn when creating forecast/transaction similar to existing
  - *Idea: Check for same description + amount + date within ±3 days; show warning not blocker*

- [ ] **Undo actions**: Allow undo after delete operations
  - *Ideas:*
    - *Toast with "Undo" button that appears for 5 seconds*
    - *Soft delete with cleanup, or keep item in memory briefly*

- [ ] **Keyboard shortcuts**: Quick-add transaction (e.g., Cmd+N)
  - *Idea: Global keyboard listener; Cmd+N opens add dialog, Cmd+K for search*

---

## Suggested Priority Order

**Quick Wins (terminology, labels, tooltips):** ✅ All done in 0.3.2
1. ~~Terminology consistency (Spending, Earned/Spent/Saved)~~
2. ~~Expand shorthand labels~~
3. ~~Add tooltips to table badges~~

**Bug Fixes:** ✅ All done in 0.3.1
4. ~~Month end card $0 income display~~
5. ~~Month end card with no plan~~
6. ~~Balance anchor input validation~~

**High-Value Features:**
7. Bulk category apply
8. Savings anchors
9. Import preview improvements

**UX Polish:**
10. Form field reordering
11. Spending page layout
12. Navigation back button fix
