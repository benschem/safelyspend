# Remove the What If sliders and keep scenarios as plain plans

- **Status:** in progress, step 2 done. Decisions made 2026-10-13.
- **Goal:** the sliders, What If mode, the violet difference figures and the
  comparison against the default plan are gone, and scenarios remain as named
  plans that can be copied, edited and switched between.
- **Touches:**
  - Deleted: `src/contexts/what-if-context.tsx`,
    `src/hooks/use-adjusted-values.ts`, `src/hooks/use-scenario-diff.ts`,
    `src/components/budget/budget-slider.tsx`,
    `src/components/ui/scenario-delta.tsx`, `src/components/ui/slider.tsx`.
  - Rewritten: `src/components/budget/slider-sections.tsx`,
    `src/routes/budget/plan-tab.tsx`, `src/components/layout/app-header.tsx`.
  - Callers of the adjusted hooks: `src/hooks/use-budget-period-data.ts`,
    `src/hooks/use-reports-data.ts`, `src/hooks/use-multi-period-summary.ts`,
    `src/routes/cash-flow/index.tsx`, `src/routes/categories/detail.tsx`.
  - Comparison props: `src/routes/insights.tsx`,
    `src/components/budget/status-hero.tsx`,
    `src/components/budget/summary-card.tsx`,
    `src/components/cash-flow/summary-cards.tsx`,
    `src/components/cash-flow/spending-pace-card.tsx`,
    `src/components/charts/spending-breakdown-chart.tsx`,
    `src/components/landing-fixtures.ts`.
  - Providers: `src/components/layout/root-layout.tsx`,
    `src/components/check-in-wizard.tsx`.
  - Copy: `src/routes/scenarios/index.tsx`,
    `src/components/dialogs/scenario-dialog.tsx`,
    `src/components/layout/sidebar.tsx`, `src/components/landing-page.tsx`,
    `index.html`, `README.md`.
  - `src/lib/allowances.ts`, `src/index.css`, `package.json`.

Every rule carries a `scenarioId` and scenarios are in the export format, so
keeping them means no schema or import migration.

## Why

- **Users would not touch the sliders.** They were hesitant, not knowing
  whether moving one would mess up their figures. The worry is partly right.
  Moving a slider stores nothing, but the header then offers "Save" on any
  scenario, the default plan included, which writes the adjusted amounts over
  the real rules (`saveToCurrentScenario` in `what-if-context.tsx`) behind a
  confirm. Nothing on the page says the sliders are a sandbox.
- **Every figure has to be right three times**: on the default plan, on
  another scenario, and with sliders moved. Nine files call the What If hooks.
  0.44.1 fixed rows that ignored the sliders, and the What If differences in
  `cash-flow-averages.md` are wrong today.
- **Safe to spend answers the same question more directly.** "Can we afford
  this?" is what the sliders were for.

Removal changes no figure on the default plan. `adjustAllowances` and
`useAdjustedForecasts` hand rules back unchanged when no slider has moved, and
adjustments live in `useState`, so they never survive a reload.

## Decided

- **Budget page rows are plain rows.** Label, hint, amount and cadence, with
  the edit and delete buttons each row already has. Amounts change only
  through `ExpenseDialog` and `ForecastRuleDialog`. The simplest layout that
  works; a table is fine if it is simpler.
- **The header tint is the only sign of a non-default scenario.** The violet
  header and scenario picker stay. Every difference figure and violet card
  border goes.
- **The sidebar and page say "Scenarios"**, not "What If".
- **The landing page's slider section is deleted**, with no replacement for
  now. The meta description and `README.md` are reworded.
- **The gap before safe to spend is accepted.** Until `bills-set-aside.md`
  lands, the way to ask "can we afford this?" is to copy a scenario and edit
  it.

Copying a scenario does not depend on the sliders: `ScenarioDialog` has a
"copy from" option that calls `duplicateToScenario` on both rule hooks.

- **The category headings in the expenses section are fixed in the same
  change.** Today the heading, its tag icon and the average spending line are
  `text-sm` or `text-xs` in `text-muted-foreground`, while the rows under them
  are full size in `font-medium`. The heading reads as less important than
  the items it groups. Each category becomes one bordered card. Its header
  holds the category name as a link in the foreground colour at
  `font-semibold`, with the category total opposite in the same weight. The
  average spending line sits under the name at `text-sm`, still muted. The
  rows follow inside the card, separated by `divide-y`, at normal weight so
  the heading outranks them. The tag icon goes.

- **Step 1 is 0.50.0.** It is the change a user sees. Steps 2 and 3 remove
  code that nothing can reach once the sliders are gone, so they are
  `refactor:` commits with no version bump.
- **The Income, Expenses and Savings sections become tabs**, as step 5. It
  comes after the comparison goes so the violet difference beside each
  section total is not carried into the tab labels first.

## Proposed

- **Versions.** 0.51.0 with step 4 (the comparison goes). The tabs in step 5
  and the rename in step 6 each need a version, or ride with whichever
  commit they are staged with.

## Steps

1. **Plain rows on the Budget page.** Replace `BudgetSlider` in
   `slider-sections.tsx` with a plain row and drop the `useWhatIf` and
   `useScenarioDiff` calls there. Rename the file and its three components so
   they no longer say "slider". Keep the collapsible sections, the category
   grouping and `SliderActions` under a new name. Restyle the category
   headings as described under Decided. Delete `budget-slider.tsx`.
2. **Strip the header.** In `AppHeader`, remove Reset, Save, Save as New, the
   four dialogs and "Exploring changes...". `showPurple` becomes
   `!isDefaultSelected`.
3. **Remove the adjustment layer.** Swap `useAdjustedBudgets` for
   `useBudgetRules` and `useAdjustedForecasts` for `useForecasts` in the six
   callers; the return shapes match. In `plan-tab.tsx` that leaves each hook
   called twice, so merge them and drop `clearAdjustment`. Remove
   `WhatIfProvider` from `root-layout.tsx` and `check-in-wizard.tsx`. Delete
   `what-if-context.tsx`, `use-adjusted-values.ts`, their two test files,
   `adjustAllowances` and its tests, and the unused `what-if` variant in
   `index.css`.
4. **Remove the comparison.** Delete `use-scenario-diff.ts`,
   `scenario-delta.tsx`, `allowanceMatchKey` and its tests. Remove
   `showDeltas`, `showDelta`, `differsFromPlan`, `delta`, `comparedToName`,
   `segmentDeltas` and the per-figure delta props from the components in
   Touches, from `landing-fixtures.ts`, and from Cash Flow, Insights and
   `plan-tab.tsx`, with the violet classes they switch on. `plan-tab.tsx`'s
   `monthly*` totals exist only for the comparison and go too.
5. **Tabs on the Budget page.** In `plan-sections.tsx` and `plan-tab.tsx`,
   replace the three collapsible sections with one set of tabs: Income,
   Expenses, Savings. The three open states in `plan-tab.tsx` become one
   selected tab, and clicking a summary card selects its tab where it now
   opens and scrolls to its section. Each section's total and Add button
   need a place once the collapsible header is gone.
6. **Copy and landing.** Sidebar label and page title to "Scenarios"; reword
   the info alert, the "What-If Scenarios" heading and the empty state in
   `scenarios/index.tsx`, and the description in `scenario-dialog.tsx`.
   Delete the slider section, `ScenarioSliderDemo` and its constants from
   `landing-page.tsx`, then `ui/slider.tsx` and `@radix-ui/react-slider`.
   Reword `index.html`'s meta description and the what-if line in
   `README.md`.
7. **Docs.** In `ARCHITECTURE.md`, delete the "What If system" section, the
   `WhatIfProvider` nodes in the state flow diagram, and the `WhatIfContext`
   lines. Fix `DEVELOPMENT.md` and `CLAUDE.md`. Create
   `docs/work/landing-rewrite.md`, link the Wishlist line to it, and note
   there that the landing page has no scenario demo. Then the work files:
   - `cash-flow-averages.md`: drop the What If half.
   - `bills-rename-loose-ends.md` and `dead-code.md`: drop the What If
     fallback names.
   - `review-findings.md`: drop the four copy-paste setters.
   - `bills-set-aside.md`: reword the lines about What-If-adjusted rules.
   - `household-personal-money.md`, `sync-merge.md`, `delete-cascades.md`:
     reword their mentions.
   - `docs/BACKLOG.md`: remove the three Inbox bugs about What If
     adjustments and sliders, and this item.

Each code step ends with `npm run lint`, `npm run build`, the tests, and
Prettier on the files touched.

## Not in this plan

- A scenario demo for the landing page. That belongs to the landing rewrite.
- Any redesign of the Budget page beyond plain rows, the category headings
  and the tabs: the summary cards and the breakdown chart keep their layout.
- Safe to spend (`bills-set-aside.md`).

## Not checked

- Why `check-in-wizard.tsx` mounts its own `WhatIfProvider`. Assumed: it sits
  outside `RootLayout` and uses hooks that call `useWhatIf`. If so the wrapper
  goes with step 3.
- Whether `duplicateScenario` in `use-scenarios.ts` has any caller.
- The other files that show violet (`year-grid.tsx`, `trend-sparkline.tsx`,
  the wizards) use it for "Projected" and icons, read from a search only.
  They are assumed unrelated and left alone.
- How the tabs in step 5 fit `plan-tab.tsx`. The open states and the
  scroll-to-section were seen in passing, not read through.
- Steps 2 onwards have not been run. The swap in step 3 is judged safe from reading the
  hooks, not from a build.
