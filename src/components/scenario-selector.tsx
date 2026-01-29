import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useScenarios } from '@/hooks/use-scenarios';

interface ScenarioSelectorProps {
  hideLabel?: boolean;
}

export function ScenarioSelector({ hideLabel = false }: ScenarioSelectorProps) {
  const { scenarios, activeScenarioId, activeScenario, setActiveScenarioId } = useScenarios();
  const isDefaultSelected = activeScenario?.isDefault ?? true;

  if (scenarios.length === 0) {
    return null;
  }

  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: setActiveScenarioId }
    : { onValueChange: setActiveScenarioId };

  return (
    <div className="flex items-center gap-2">
      {!hideLabel && <span className="text-sm text-muted-foreground">Scenario:</span>}
      <Select {...selectProps}>
        <SelectTrigger className={`w-48 ${isDefaultSelected ? 'text-muted-foreground' : ''}`}>
          <SelectValue placeholder="Select scenario" />
        </SelectTrigger>
        <SelectContent>
          {scenarios.map((scenario) => (
            <SelectItem key={scenario.id} value={scenario.id}>
              {scenario.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
