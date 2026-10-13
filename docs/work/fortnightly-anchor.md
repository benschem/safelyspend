# A fortnightly rule does not know which week it lands in

- **Status:** not started. Raised 2026-10-13.
- **Goal:** a fortnightly rule lands on the real pay or bill days, not on a week
  counted from January 2020.
- **Touches:** `src/components/dialogs/forecast-rule-dialog.tsx`, `src/lib/cadence.ts`,
  `src/lib/types.ts`, `src/lib/import-schema.ts`.

Noticed 2026-10-13 while moving rule expansion into `src/lib/cadence.ts`.

The dialog saves only a day of the week for a fortnightly rule
(`forecast-rule-dialog.tsx`), and no dialog sets a start date. With no start
date, `expandForecastRule` counts fortnights from the first matching weekday of
January 2020. So whether the app's pay days match the real ones is a coin flip
per rule. The maintainer's own Thursday pay happens to match (1, 15 and 29
October 2026).

When it does not match, every dated figure for that rule is a week out: Cash
Flow's expected income today, and any fortnightly bill once category limits use
due dates. A month can show three pays where there are two. The Budget page
averages, so it is not affected.

Proposed, not confirmed: for a fortnightly rule, the dialog asks for any date
the rule lands on, such as the next pay day, stored as a new optional field and
used as the anchor in both directions. Not the existing start date, which also
means "nothing before this" and would empty the planned figures of past months.
A new field is not indexed, so no schema version bump; add it to
`import-schema.ts`. Existing fortnightly rules keep the 2020 anchor until
edited.
