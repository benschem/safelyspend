# Remove the What If sliders and keep scenarios as plain plans

- **Status:** parked. Raised 2026-10-13 by the maintainer, who asked whether
  What If causes more trouble than it solves. Leaning towards removal. Not to
  be mixed into the figure fixes: decide after the app has been used on the
  default plan and safe to spend exists (`bills-set-aside.md`, steps 5 and 6).
- **Goal:** the sliders, What If mode, the violet difference figures and the
  comparison against the default plan are gone, and scenarios remain as named
  plans that can be copied, edited and switched between.
- **Touches:** `src/contexts/what-if-context.tsx`,
  `src/hooks/use-adjusted-values.ts`, `src/hooks/use-scenario-diff.ts`, the
  nine other files that call the What If hooks, and the two that mount
  `WhatIfProvider` without calling them: `src/components/layout/root-layout.tsx`
  and `src/components/check-in-wizard.tsx`.

Every rule carries a `scenarioId` and scenarios are in the export format, so
keeping them means no schema or import migration.

## Why

- **Users would not touch the sliders.** Reported by the maintainer: they were
  hesitant, not knowing whether moving one would mess up their figures. The
  worry is partly right. Moving a slider stores nothing, but the header then
  offers "Save", which writes the adjusted amounts over the scenario's real
  rules (`saveToCurrentScenario` in `what-if-context.tsx`), behind a confirm.
  Nothing on the page says the sliders are a sandbox.
- **Every figure has to be right three times**: on the default plan, on
  another scenario, and with sliders moved. Twelve files define or call the
  What If hooks. 0.44.1 fixed rows that ignored the sliders, and the What If
  differences in `cash-flow-averages.md` are wrong today.
- **Safe to spend answers the same question more directly.** "Can we afford
  this?" is what the sliders were for.

Removing them would close the What If half of `cash-flow-averages.md`, the
What If fallback names in `bills-rename-loose-ends.md`, and the uncalled
`useAdjustedScenarioData`.

## Not checked

- Whether "Save" is offered while on the default plan.
- Whether slider adjustments survive a reload.
- Whether the adjusted hooks hand rules back unchanged when no slider has
  moved. If they do, none of this affects the default plan's figures, and the
  feature is not what stands in the way of using the app.
- What the landing page promises about What If, and what would need rewording.
