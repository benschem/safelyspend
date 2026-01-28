import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useScenarios } from '@/hooks/use-scenarios';
import { useForecasts } from '@/hooks/use-forecasts';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { FormField, FormError } from '@/components/form-field';
import { scenarioFormSchema } from '@/lib/schemas';

export function ScenarioNewPage() {
  const navigate = useNavigate();
  const { scenarios, addScenario } = useScenarios();
  const { duplicateToScenario: duplicateForecastsToScenario } = useForecasts(null);
  const { duplicateToScenario: duplicateBudgetsToScenario } = useBudgetRules(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      copyFromId: '',
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = scenarioFormSchema.safeParse(value);
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

      const scenario = addScenario({
        name: value.name.trim(),
        ...(value.description.trim() ? { description: value.description.trim() } : {}),
        isDefault: scenarios.length === 0,
      });

      // Copy rules from another scenario if selected
      if (value.copyFromId && value.copyFromId !== '__none__') {
        duplicateForecastsToScenario(value.copyFromId, scenario.id);
        duplicateBudgetsToScenario(value.copyFromId, scenario.id);
      }

      navigate(`/scenarios/${scenario.id}`);
    },
  });

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

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New Scenario</h1>
        <p className="mt-1 text-muted-foreground">
          Create a new budget scenario for what-if planning.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        noValidate
        className="space-y-6"
      >
        <FormError error={submitError} />

        <form.Field name="name">
          {(field) => (
            <FormField field={field} label="Scenario Name">
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g., Base Budget, Optimistic, What-if: New Job"
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
                placeholder="Describe this scenario..."
                rows={3}
              />
            </FormField>
          )}
        </form.Field>

        {scenarios.length > 0 && (
          <form.Field name="copyFromId">
            {(field) => (
              <FormField
                field={field}
                label="Copy rules from"
                description="Copy budget rules and forecast rules from an existing scenario"
                optional
              >
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Start fresh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Start fresh</SelectItem>
                    {scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </form.Field>
        )}

        <div className="flex gap-3 pt-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Scenario'}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" asChild>
            <Link to="/scenarios">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
