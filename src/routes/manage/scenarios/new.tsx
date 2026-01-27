import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function ScenarioNewPage() {
  const navigate = useNavigate();
  const { scenarios, addScenario } = useScenarios();
  const { duplicateToScenario: duplicateForecastsToScenario } = useForecasts(null);
  const { duplicateToScenario: duplicateBudgetsToScenario } = useBudgetRules(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const scenario = addScenario({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      isDefault: scenarios.length === 0,
    });

    // Copy rules from another scenario if selected
    if (copyFrom) {
      duplicateForecastsToScenario(copyFrom, scenario.id);
      duplicateBudgetsToScenario(copyFrom, scenario.id);
    }

    navigate(`/manage/scenarios/${scenario.id}`);
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage/scenarios">
            <ArrowLeft className="h-4 w-4" />
            Back to Scenarios
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">New Scenario</h1>
      <p className="text-muted-foreground">Create a new budget scenario for what-if planning.</p>

      {error && <div className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Scenario Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Base Budget, Optimistic, What-if: New Job"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this scenario..."
            rows={3}
          />
        </div>

        {scenarios.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="copyFrom">Copy rules from (optional)</Label>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger>
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
            <p className="text-xs text-muted-foreground">
              Copy budget rules and forecast rules from an existing scenario
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit">Create Scenario</Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/manage/scenarios">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
