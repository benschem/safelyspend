import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Scenario, CreateEntity } from '@/lib/types';

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: Scenario | null;
  scenarios: Scenario[];
  addScenario: (data: CreateEntity<Scenario>) => Promise<Scenario>;
  updateScenario: (id: string, updates: Partial<Omit<Scenario, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  duplicateForecastsToScenario: (fromScenarioId: string, toScenarioId: string) => Promise<void>;
  duplicateBudgetsToScenario: (fromScenarioId: string, toScenarioId: string) => Promise<void>;
}

export function ScenarioDialog({ open, onOpenChange, scenario, scenarios, addScenario, updateScenario, duplicateForecastsToScenario, duplicateBudgetsToScenario }: ScenarioDialogProps) {
  const isEditing = !!scenario;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFromId, setCopyFromId] = useState('__none__');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (scenario) {
        setName(scenario.name);
        setDescription(scenario.description ?? '');
        setCopyFromId('__none__');
      } else {
        setName('');
        setDescription('');
        setCopyFromId('__none__');
      }
      setFormError(null);
    }
  }, [open, scenario]);

  const handleSave = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a scenario name');
      return;
    }

    try {
      if (isEditing && scenario) {
        const updates: Parameters<typeof updateScenario>[1] = {
          name: name.trim(),
        };
        if (description.trim()) {
          updates.description = description.trim();
        }
        await updateScenario(scenario.id, updates);
      } else {
        const newScenario = await addScenario({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          isDefault: scenarios.length === 0,
        });

        // Copy rules from another scenario if selected
        if (copyFromId && copyFromId !== '__none__') {
          await duplicateForecastsToScenario(copyFromId, newScenario.id);
          await duplicateBudgetsToScenario(copyFromId, newScenario.id);
        }
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save scenario. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Scenario</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the scenario details.' : 'Create a new budget scenario for "what-if" planning.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="scenario-name" className="select-none">Scenario Name</Label>
            <Input
              id="scenario-name"
              placeholder="e.g., Base Budget, Optimistic"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-description" className="select-none">
              Description
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="scenario-description"
              placeholder="Describe this scenario..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {!isEditing && scenarios.length > 0 && (
            <div className="space-y-2">
              <Label className="select-none">
                Copy rules from
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select value={copyFromId} onValueChange={setCopyFromId}>
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
              <p className="text-xs text-muted-foreground select-none">
                Copy budget rules and forecast rules from an existing scenario.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save' : 'Create'} Scenario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
