import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Star, Sparkles, Play } from 'lucide-react';
import { PageLoading } from '@/components/page-loading';
import { Alert } from '@/components/ui/alert';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { db } from '@/lib/db';
import { ScenarioDialog } from '@/components/dialogs/scenario-dialog';
import type { Scenario } from '@/lib/types';

export function ScenariosIndexPage() {
  const {
    scenarios,
    activeScenarioId,
    isLoading: scenariosLoading,
    setActiveScenarioId,
    addScenario,
    updateScenario,
    deleteScenario,
  } = useScenarios();
  const { duplicateToScenario: duplicateForecastsToScenario } = useForecasts(null);
  const { duplicateToScenario: duplicateBudgetsToScenario } = useBudgetRules(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get rule counts per scenario
  const rawBudgetRules = useLiveQuery(() => db.budgetRules.toArray(), []);
  const rawForecastRules = useLiveQuery(() => db.forecastRules.toArray(), []);
  const allBudgetRules = useMemo(() => rawBudgetRules ?? [], [rawBudgetRules]);
  const allForecastRules = useMemo(() => rawForecastRules ?? [], [rawForecastRules]);

  // Combined loading state
  const isLoading =
    scenariosLoading || rawBudgetRules === undefined || rawForecastRules === undefined;

  // Find default (Current Plan) and other scenarios
  const defaultScenario = useMemo(() => scenarios.find((s) => s.isDefault) ?? null, [scenarios]);
  const otherScenarios = useMemo(() => scenarios.filter((s) => !s.isDefault), [scenarios]);

  // Build counts map
  const countsByScenario = useMemo(() => {
    const counts: Record<string, { budgets: number; forecasts: number }> = {};
    for (const s of scenarios) {
      counts[s.id] = { budgets: 0, forecasts: 0 };
    }
    for (const rule of allBudgetRules) {
      if (counts[rule.scenarioId]) {
        counts[rule.scenarioId]!.budgets++;
      }
    }
    for (const rule of allForecastRules) {
      if (counts[rule.scenarioId]) {
        counts[rule.scenarioId]!.forecasts++;
      }
    }
    return counts;
  }, [scenarios, allBudgetRules, allForecastRules]);

  const openAddDialog = useCallback(() => {
    setEditingScenario(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((scenario: Scenario) => {
    setEditingScenario(scenario);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingScenario(null);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (deletingId === id) {
        deleteScenario(id);
        setDeletingId(null);
      } else {
        setDeletingId(id);
      }
    },
    [deletingId, deleteScenario],
  );

  // Close delete confirmation on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deletingId) {
        setDeletingId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingId]);

  // Check if viewing current plan
  const isViewingCurrentPlan = defaultScenario?.id === activeScenarioId;

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            <div className="page-title-icon bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            What If
          </h1>
          <p className="page-description">
            Explore different budget scenarios to see how changes affect your finances.
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add Scenario
        </Button>
      </div>

      <Alert variant="info" className="mb-6">
        Each scenario has its own budget and savings plan. Use the sliders on the{' '}
        <Link
          to="/budget?tab=plan"
          className="underline hover:text-blue-900 dark:hover:text-blue-100"
        >
          Budget page
        </Link>{' '}
        to explore &quot;what if&quot; questions, then save your adjustments as a new scenario.
      </Alert>

      {isLoading ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          {/* Current Plan Section */}
          {defaultScenario && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Current Plan</h3>
              <div
                className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                  isViewingCurrentPlan
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-muted-foreground/30 bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <h2 className="text-lg font-semibold">{defaultScenario.name}</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {defaultScenario.description ||
                        'Your baseline budget - the plan you live by.'}
                    </p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <Link to="/budget?tab=plan" className="hover:text-foreground hover:underline">
                        {countsByScenario[defaultScenario.id]?.forecasts ?? 0} forecasts
                      </Link>
                      <span className="mx-2">·</span>
                      <Link to="/budget?tab=plan" className="hover:text-foreground hover:underline">
                        {countsByScenario[defaultScenario.id]?.budgets ?? 0} budgets
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveScenarioId(defaultScenario.id)}
                          disabled={isViewingCurrentPlan}
                        >
                          <Play
                            className={`h-4 w-4 ${isViewingCurrentPlan ? 'fill-amber-500 text-amber-500' : ''}`}
                          />
                          <span className="ml-1 hidden sm:inline">
                            {isViewingCurrentPlan ? 'Viewing' : 'View'}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isViewingCurrentPlan ? 'Currently viewing' : 'Switch to Current Plan'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(defaultScenario)}
                          aria-label="Edit Current Plan"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit Current Plan</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Scenarios */}
          {otherScenarios.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">What-If Scenarios</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {otherScenarios.map((scenario) => {
                  const isActive = scenario.id === activeScenarioId;
                  const isDeleting = deletingId === scenario.id;
                  const counts = countsByScenario[scenario.id];

                  return (
                    <div
                      key={scenario.id}
                      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                        isActive
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-transparent bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDialog(scenario)}
                              className="cursor-pointer text-left font-medium hover:underline"
                            >
                              {scenario.name}
                            </button>
                          </div>
                          {scenario.description && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {scenario.description}
                            </p>
                          )}
                          <div className="mt-1 text-xs text-muted-foreground">
                            <Link
                              to="/budget?tab=plan"
                              className="hover:text-foreground hover:underline"
                            >
                              {counts?.forecasts ?? 0} forecasts
                            </Link>
                            <span className="mx-2">·</span>
                            <Link
                              to="/budget?tab=plan"
                              className="hover:text-foreground hover:underline"
                            >
                              {counts?.budgets ?? 0} budgets
                            </Link>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setActiveScenarioId(isActive ? defaultScenario!.id : scenario.id)
                                }
                                aria-label={isActive ? 'Back to Current Plan' : 'Explore this scenario'}
                              >
                                <Play
                                  className={`h-4 w-4 ${isActive ? 'fill-violet-500 text-violet-500' : ''}`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isActive ? 'Back to Current Plan' : 'Explore this scenario'}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateScenario(scenario.id, { isDefault: true })}
                                aria-label="Make Current Plan"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Make Current Plan</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(scenario)}
                                aria-label="Edit scenario"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit scenario</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={isDeleting ? 'destructive' : 'ghost'}
                                size="sm"
                                onClick={() => handleDelete(scenario.id)}
                                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                                aria-label={isDeleting ? 'Confirm delete' : 'Delete scenario'}
                              >
                                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isDeleting ? 'Click to confirm' : 'Delete scenario'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {otherScenarios.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No what-if scenarios yet. Create one to explore budget alternatives.
              </p>
              <Button variant="outline" className="mt-3" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Create Scenario
              </Button>
            </div>
          )}
        </div>
      )}

      <ScenarioDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        scenario={editingScenario}
        scenarios={scenarios}
        addScenario={addScenario}
        updateScenario={updateScenario}
        duplicateForecastsToScenario={duplicateForecastsToScenario}
        duplicateBudgetsToScenario={duplicateBudgetsToScenario}
      />
    </div>
  );
}
