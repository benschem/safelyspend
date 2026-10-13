# "Today" is the UTC date, and dates are parsed two different ways

- **Status:** not started. Found in the 2026-10-13 code review. Steps to be
  written when this is picked up.
- **Goal:** one module owns "what is today" and "turn a `YYYY-MM-DD` string
  into a date", both in local time, and every hand-rolled copy uses it.
- **Touches:** a new `src/lib/dates.ts`, `src/lib/utils.ts`,
  `src/lib/cadence.ts`, `src/hooks/use-budget-period-data.ts`,
  `src/lib/csv-parser.ts`, `src/lib/up-csv-parser.ts`, and the call sites
  listed below.

## Why

Dates are stored as `YYYY-MM-DD` strings, which is right. The trouble is at
the two edges: working out today's string, and turning a string back into a
`Date`. Each is done in more than one way, and the ways disagree by a day
depending on the time and the timezone.

Line numbers are as of 0.44.7; re-check them.

## Confirmed in the code

- **`today()` returns the UTC date** (`src/lib/utils.ts:51`). It slices
  `new Date().toISOString()`, which is always UTC. In eastern Australia it
  gives yesterday until 10am, or 11am in daylight saving. 26 call sites in 9
  files used it at the time of the review, including the default date on a new
  transaction, anchor dates, and eight uses in the check-in wizard.
- **The year view's day count mixes UTC and local time**
  (`src/hooks/use-budget-period-data.ts:200`). `new Date('YYYY-MM-DD')` parses
  as UTC midnight, and the code subtracts a local midnight from it. The
  sub-review ran this with `TZ=Australia/Sydney` and got day 2 on 1 January
  and day 366 of 365 on 31 December.

## Reported by the sub-review, not checked

- Seven places hand-roll a correct local "today", among them
  `use-reports-data.ts:69`, `use-cash-surplus.ts:32` and
  `use-budget-period-data.ts:610`. Fourteen files format `YYYY-MM-DD` by hand.
- `getMonthsBetween` (`src/lib/utils.ts:147`) and `formatDate`
  (`src/lib/utils.ts:40`) parse with `new Date(isoDate)`. West of UTC,
  `2025-07-01` becomes June.
- **The CSV date fallback shifts a day** (`src/lib/csv-parser.ts:241`, same
  pattern at `src/lib/up-csv-parser.ts:62`). "15 Jan 2026" imports as
  2026-01-14 in AEST. `parseDate` also accepts "31/02/2025" without checking
  it, and `csv-parser.ts` has no test file.
- `src/lib/cadence.ts` already has a correct `parseLocalDate`. It is the one
  to export and reuse.
- `MONTHS` arrays are defined in four places.

## Not in this plan

- Balance maths, which has the same "no single home" problem. See
  `balances.md`.
- Data already saved with the wrong date. Decide when the fix is planned
  whether anything can or should be corrected.
