import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Scenario } from '@/lib/types';

interface HeaderProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onScenarioChange: (scenarioId: string) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onResetDateRange: () => void;
}

export function Header({
  scenarios,
  activeScenarioId,
  onScenarioChange,
  startDate,
  endDate,
  onDateRangeChange,
  onResetDateRange,
}: HeaderProps) {
  // Build select props conditionally to handle controlled/uncontrolled state
  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: onScenarioChange }
    : { onValueChange: onScenarioChange };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Scenario:</span>
          {scenarios.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">No scenarios</span>
          ) : (
            <Select {...selectProps}>
              <SelectTrigger className="w-40">
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onDateRangeChange(e.target.value, endDate)}
            className="w-36 h-9"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onDateRangeChange(startDate, e.target.value)}
            className="w-36 h-9"
          />
          <Button variant="ghost" size="sm" onClick={onResetDateRange}>
            FY
          </Button>
        </div>
      </div>
    </header>
  );
}
