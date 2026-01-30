import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppConfig } from '@/hooks/use-app-config';
import { useBalanceAnchors } from '@/hooks/use-balance-anchors';
import { useScenarios } from '@/hooks/use-scenarios';
import { today } from '@/lib/utils';
import { loadDemoDataToStorage } from '@/lib/demo-data';
import { FormField, FormError } from '@/components/form-field';
import { firstRunSetupSchema, parseCents } from '@/lib/schemas';
import { debug } from '@/lib/debug';
import { LandingPage } from '@/components/landing-page';

type WizardStep = 'choose' | 'setup';

export function FirstRunWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { markInitialized } = useAppConfig();
  const { addAnchor } = useBalanceAnchors();
  const { scenarios, addScenario, setActiveScenarioId } = useScenarios();

  // Start at setup step if ?setup=1 is in URL
  const [step, setStep] = useState<WizardStep>(() =>
    searchParams.get('setup') ? 'setup' : 'choose',
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayDate = today();

  const form = useForm({
    defaultValues: {
      spendingBalance: '',
      balanceDate: todayDate,
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = firstRunSetupSchema.safeParse(value);
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

      const balanceCents = parseCents(value.spendingBalance);
      if (balanceCents < 0) {
        setSubmitError('Balance cannot be negative');
        return;
      }

      try {
        // Create default scenario if none exists
        if (scenarios.length === 0) {
          const scenario = await addScenario({
            name: 'Main Budget',
            description: 'My primary budget scenario',
            isDefault: true,
          });
          await setActiveScenarioId(scenario.id);
        }

        // Create balance anchor (even if 0, as it sets the anchor date)
        await addAnchor({
          date: value.balanceDate,
          balanceCents: balanceCents,
          label: 'Opening balance',
        });

        await markInitialized(false);
        navigate('/');
      } catch (error) {
        debug.error('db', 'Setup failed', error);
        setSubmitError('Setup failed. Please try again.');
      }
    },
  });

  const handleStartDemo = async () => {
    await loadDemoDataToStorage();
    // Force reload to pick up the new data
    window.location.href = '/';
  };

  if (step === 'choose') {
    return <LandingPage onViewDemo={handleStartDemo} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Set up your budget</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your current total cash on hand balance to get started.
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

          <form.Field name="spendingBalance">
            {(field) => (
              <FormField
                field={field}
                label="Current Spending Balance ($)"
                description="Enter the amount of money you have available to spend right now."
                optional
              >
                <Input
                  id={field.name}
                  type="number"
                  step="0.01"
                  min="0"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="0.00"
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="balanceDate">
            {(field) => (
              <FormField
                field={field}
                label="As of Date"
                description="The date this balance was accurate."
              >
                <Input
                  id={field.name}
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FormField>
            )}
          </form.Field>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('choose')}
              className="flex-1"
            >
              Back
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Setting up...' : 'Get Started'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </div>
  );
}
