import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Plus, Pencil, Trash2, Star, Layers } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { db } from '@/lib/db';
import { ScenarioDialog } from '@/components/dialogs/scenario-dialog';
import type { Scenario } from '@/lib/types';

interface ScenarioRow extends Scenario {
  budgetRuleCount: number;
  forecastRuleCount: number;
}

export function ScenariosIndexPage() {
  const { scenarios, addScenario, updateScenario, deleteScenario } = useScenarios();
  const { duplicateToScenario: duplicateForecastsToScenario } = useForecasts(null);
  const { duplicateToScenario: duplicateBudgetsToScenario } = useBudgetRules(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get rule counts per scenario
  const allBudgetRules = useLiveQuery(() => db.budgetRules.toArray(), []) ?? [];
  const allForecastRules = useLiveQuery(() => db.forecastRules.toArray(), []) ?? [];

  // Build scenario rows with counts
  const scenarioRows: ScenarioRow[] = useMemo(() => {
    const budgetCountByScenario = new Map<string, number>();
    const forecastCountByScenario = new Map<string, number>();

    for (const rule of allBudgetRules) {
      budgetCountByScenario.set(
        rule.scenarioId,
        (budgetCountByScenario.get(rule.scenarioId) ?? 0) + 1,
      );
    }

    for (const rule of allForecastRules) {
      forecastCountByScenario.set(
        rule.scenarioId,
        (forecastCountByScenario.get(rule.scenarioId) ?? 0) + 1,
      );
    }

    return scenarios.map((scenario) => ({
      ...scenario,
      budgetRuleCount: budgetCountByScenario.get(scenario.id) ?? 0,
      forecastRuleCount: forecastCountByScenario.get(scenario.id) ?? 0,
    }));
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

  const handleSetDefault = useCallback(
    (id: string) => {
      updateScenario(id, { isDefault: true });
    },
    [updateScenario],
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

  const columns: ColumnDef<ScenarioRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
        cell: ({ row }) => {
          const scenario = row.original;
          return (
            <button
              type="button"
              onClick={() => openEditDialog(scenario)}
              className="cursor-pointer text-left font-medium hover:underline"
            >
              {scenario.name}
            </button>
          );
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.getValue('description') || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'budgetRuleCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Budgets
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.getValue('budgetRuleCount')}</div>
        ),
      },
      {
        accessorKey: 'forecastRuleCount',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            Forecasts
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.getValue('forecastRuleCount')}</div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const scenario = row.original;
          const isDeleting = deletingId === scenario.id;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !scenario.isDefault && handleSetDefault(scenario.id)}
                title={scenario.isDefault ? 'Default scenario' : 'Set as default'}
                className={scenario.isDefault ? 'cursor-default' : ''}
              >
                <Star className={`h-4 w-4 ${scenario.isDefault ? 'text-blue-600' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(scenario)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={isDeleting ? 'destructive' : 'ghost'}
                size="sm"
                onClick={() => handleDelete(scenario.id)}
                onBlur={() => setTimeout(() => setDeletingId(null), 200)}
                disabled={scenario.isDefault}
                title={
                  scenario.isDefault
                    ? 'Cannot delete default scenario'
                    : isDeleting
                      ? 'Click again to confirm'
                      : 'Delete'
                }
              >
                {isDeleting ? 'Confirm' : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, openEditDialog, handleDelete, handleSetDefault],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <Layers className="h-5 w-5 text-slate-500" />
            </div>
            Scenarios
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage budget scenarios for &quot;what-if&quot; planning.
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add Scenario
        </Button>
      </div>

      <Alert variant="info">
        Switching scenarios changes your budget and forecasts. Your past transactions and categories stay the same.
      </Alert>

      {scenarios.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No scenarios yet.</p>
          <Button className="mt-4" onClick={openAddDialog}>
            Create your first scenario
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={scenarioRows}
            searchKey="name"
            searchPlaceholder="Search scenarios..."
            showPagination={false}
          />
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
