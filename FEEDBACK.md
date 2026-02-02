# Beta Feedback

Organized feedback from early usage testing. Items marked ✅ are already implemented.

---

## 🔴 Bugs & Broken Behavior

## 🟡 UX Improvements

### Confusing UI Elements
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
    - *Onboarding tour for new users explaining the concept*
    - *Forecast = "I WILL spend $X on rent" (known, fixed)*
    - *Budget = "I WANT to spend max $X on dining" (target, variable)*

### Layout & Arrangement

### Form Improvements
- [ ] **Add transaction (savings)**: Show savings goal selector right after type, before date/amount
  - *Idea: When type="savings", reorder: Type → Goal → Deposit/Withdraw → Amount → Date*

- [ ] **Add transaction (savings)**: Hide "Create savings goal" option when Withdraw selected
  - *Idea: Can't withdraw from a goal that doesn't exist; conditional rendering*

- [ ] **Add transaction (savings)**: Add colored chevrons (red/green) to deposit/withdraw options
  - *Idea: Match the table display; green ChevronUp for contribute, red ChevronDown for withdraw*

- [ ] **Category select**: Can't scroll properly in dialog popovers
  - *Idea: Check SelectContent max-height and overflow settings; may need portal or z-index fix*

---

## 🟢 New Features

### High Priority
- [ ] **Categories**: Bulk apply - apply category to all matching transaction descriptions
  - *Ideas:*
    - *Button on category page: "Apply to all matching transactions"*
    - *Or when categorizing one transaction: "Apply to all with same description?"*
    - *This is essentially what import rules do but retroactively*

### Import Improvements
- [ ] **CSV Import**: Preview auto-categories before importing
  - *Ideas:*
    - *Show "Category Rules Preview" step before final import*
    - *Table showing: Description → Matched Rule → Category*
    - *Allow overriding individual matches*

- [ ] **CSV Import**: Allow skipping individual transactions in preview
  - *Idea: Checkbox column in preview table; unchecked items won't be imported*


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

## 💡 Additional Suggestions (Not in Original Feedback)

- [ ] **Error messages**: User-friendly error messages on all forms
  - *Idea: Replace technical errors with actionable messages*

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

**High-Value Features:**
7. Bulk category apply
9. Import preview improvements

**UX Polish:**
10. Form field reordering
