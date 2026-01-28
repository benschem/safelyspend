import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useScenarios } from '@/hooks/use-scenarios';

export function ScenarioSelector() {
  const { scenarios, activeScenarioId, setActiveScenarioId } = useScenarios();

  if (scenarios.length === 0) {
    return null;
  }

  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: setActiveScenarioId }
    : { onValueChange: setActiveScenarioId };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Scenario:</span>
      <Select {...selectProps}>
        <SelectTrigger className="w-40 cursor-pointer">
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
