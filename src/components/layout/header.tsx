import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MobileNav } from './sidebar';
import type { Scenario } from '@/lib/types';

interface HeaderProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onScenarioChange: (scenarioId: string) => void;
}

export function Header({
  scenarios,
  activeScenarioId,
  onScenarioChange,
}: HeaderProps) {
  // Build select props conditionally to handle controlled/uncontrolled state
  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: onScenarioChange }
    : { onValueChange: onScenarioChange };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-sm text-muted-foreground hidden sm:inline">Scenario:</span>
        {scenarios.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">No scenarios</span>
        ) : (
          <Select {...selectProps}>
            <SelectTrigger className="w-32 sm:w-40">
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
        )}
      </div>
    </header>
  );
}
