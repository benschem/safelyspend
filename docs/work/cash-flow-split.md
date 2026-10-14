# Split the Cash Flow page, and one table in place of four near-copies

- **Status:** not started. As the 2026-10-13 code review reported it, with
  0.44.7 line numbers; confirm before planning.
- **Goal:** the Cash Flow page is made of components small enough to read,
  its breakdown is one table, and every figure it works out is a tested
  function in `src/lib/`.
- **Touches:** `src/routes/cash-flow/index.tsx`,
  `src/components/charts/burn-rate-chart.tsx`.

- `CashFlowContent` (`:150-1160`) is a 1,000-line component.
- `BreakdownTable` (`:1198-1713`) renders four near-identical layouts. The
  pill-toggle class string appears seven times in the file.
- `TwoColRow` and `ThreeColRow` (`:1793-1959`) duplicate each other.
- Logic with no test: remaining flows, pace status and projections at
  `:253-289` and `:407-582`. Projection maths also sits inside
  `burn-rate-chart.tsx:211`, and the burn rate chart's day-by-day maths has
  no test.

## Related work

These fix figures on the same page. Moving a figure into `src/lib/` with a
test is the step that would let each be fixed and checked on its own:

- `cash-flow-averages.md`
- `future-month-end.md`
- `cash-card-no-plan.md`
- `fortnightly-anchor.md`
- `category-limit-loose-ends.md`
- `balances-from-anchors.md`
