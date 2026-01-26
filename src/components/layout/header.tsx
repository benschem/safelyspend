import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import type { Period } from '@/lib/types';

interface HeaderProps {
  periods: Period[];
  activePeriodId: string | null;
  onPeriodChange: (periodId: string) => void;
}

export function Header({ periods, activePeriodId, onPeriodChange }: HeaderProps) {
  // Build select props conditionally to handle controlled/uncontrolled state
  const selectProps = activePeriodId
    ? { value: activePeriodId, onValueChange: onPeriodChange }
    : { onValueChange: onPeriodChange };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Active time period:</span>
        {periods.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">No time periods created</span>
        ) : (
          <Select {...selectProps}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a time period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
