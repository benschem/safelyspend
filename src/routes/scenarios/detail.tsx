import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { formatDate } from '@/lib/utils';
import { FormField, FormError } from '@/components/form-field';
import { scenarioEditSchema } from '@/lib/schemas';

export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scenarios, updateScenario, deleteScenario, duplicateScenario } = useScenarios();
  const { duplicateToScenario: duplicateForecastsToScenario, rules: forecastRules } = useForecasts(
    id ?? null,
  );
  const { duplicateToScenario: duplicateBudgetsToScenario, budgetRules } = useBudgetRules(
    id ?? null,
  );

  const scenario = scenarios.find((s) => s.id === id);

  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm({
    defaultValues: {
      name: scenario?.name ?? '',
      description: scenario?.description ?? '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = scenarioEditSchema.safeParse(value);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (path) {
              fieldErrors[path] = issue.message;
            }
          }
          return fieldErrors;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (!scenario) return;

      updateScenario(scenario.id, {
        name: value.name.trim(),
        ...(value.description.trim() ? { description: value.description.trim() } : {}),
      });
      setEditing(false);
    },
  });

  // Reset form when scenario changes
  useEffect(() => {
    if (scenario) {
      form.reset();
      form.setFieldValue('name', scenario.name);
      form.setFieldValue('description', scenario.description ?? '');
    }
  }, [scenario?.id]);

  if (!scenario) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/scenarios">
              <ArrowLeft className="h-4 w-4" />
              Back to Scenarios
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Scenario not found.</p>
      </div>
    );
  }

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteScenario(scenario.id);
    navigate('/scenarios');
  };

  const handleDuplicate = () => {
    const newScenario = duplicateScenario(scenario.id, `${scenario.name} (Copy)`);
    if (newScenario) {
      // Also copy the forecast and budget rules
      duplicateForecastsToScenario(scenario.id, newScenario.id);
      duplicateBudgetsToScenario(scenario.id, newScenario.id);
      navigate(`/scenarios/${newScenario.id}`);
    }
  };

  const handleSetDefault = () => {
    updateScenario(scenario.id, { isDefault: true });
  };

  const startEditing = () => {
    form.reset();
    form.setFieldValue('name', scenario.name);
    form.setFieldValue('description', scenario.description ?? '');
    setEditing(true);
  };

  const createdDate = scenario.createdAt.split('T')[0];
  const updatedDate = scenario.updatedAt.split('T')[0];

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/scenarios">
            <ArrowLeft className="h-4 w-4" />
            Back to Scenarios
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{scenario.name}</h1>
            {scenario.isDefault && <Badge variant="secondary">Default</Badge>}
          </div>
          {scenario.description && (
            <p className="text-muted-foreground">{scenario.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Budget Rules</p>
          <p className="text-2xl font-bold">{budgetRules.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Forecast Rules</p>
          <p className="text-2xl font-bold">{forecastRules.length}</p>
        </div>
      </div>

      {submitError && (
        <div className="mt-4">
          <FormError error={submitError} />
        </div>
      )}

      <Separator className="my-6" />

      {/* Edit Section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Scenario Details</h2>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            noValidate
            className="mt-4 space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Name">
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FormField>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <FormField field={field} label="Description" optional>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    rows={3}
                  />
                </FormField>
              )}
            </form.Field>

            <div className="flex gap-3 pt-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </form.Subscribe>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {scenario.name}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span>{' '}
              {scenario.description || 'None'}
            </p>
            <p>
              <span className="text-muted-foreground">Created:</span>{' '}
              {createdDate ? formatDate(createdDate) : '-'}
            </p>
            <p>
              <span className="text-muted-foreground">Last updated:</span>{' '}
              {updatedDate ? formatDate(updatedDate) : '-'}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* Actions */}
      <section>
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="mt-4 space-y-4">
          {!scenario.isDefault && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-medium">Set as Default</h3>
                <p className="text-sm text-muted-foreground">
                  Make this the default scenario for planning.
                </p>
              </div>
              <Button variant="outline" onClick={handleSetDefault}>
                Set Default
              </Button>
            </div>
          )}
        </div>
      </section>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="mt-4 rounded-lg border border-destructive/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Delete Scenario</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this scenario and all its rules.
              </p>
            </div>
            <div className="flex gap-2">
              {confirmingDelete && (
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={scenario.isDefault}
              >
                {confirmingDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
            </div>
          </div>
          {scenario.isDefault && (
            <p className="mt-2 text-sm text-muted-foreground">
              Cannot delete the default scenario. Set another scenario as default first.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
