# Feedback

## Setup Experience
- *Onboarding tour for new users explaining the concept*
- *First-run wizard*: current needs overhaul - talks about "current balance" when date could be in past
  - Ideas for new:
    - When do you want to start tracking?" (date picker)
    - How much cash did you have on [date]?
    - Optional - "Do you have any savings to track?"
    - how often do you get paid?
    - How much do you get paid?
    - *Clearer language throughout*


## Misc
- Always display scroll bar on tables when rows are overflow hidden

- Forms on mobile, when clicking amount field it zooms in, maybe happens on other forms too.

User answered Claude's questions:
  ⎿  · Should the cash surplus be a running balance (opening balance + all income - all expenses - all savings to date), or more of a
     'what's left after committed obligations' number? → Available after obligations
     · How should savings fit into this? Right now savings is subtracted from surplus. In your model, is savings an allocation FROM the
     surplus (i.e., surplus = cash before savings, then you choose how much goes to savings)? → Surplus before savings
     · Should we keep the monthly breakdown view alongside this, or fully replace it with the cumulative surplus as the primary lens? →
     Both equal

      The shift in savings framing:
  - Currently: surplus = income - expenses - savings (savings is a cost)
  - New: surplus = income - expenses (savings is an allocation from surplus)

  Monthly Net (existing, stays as co-equal):
  - Per-period flow: income - expenses for the month
  - Answers: "How is this month contributing to my cash position?"
