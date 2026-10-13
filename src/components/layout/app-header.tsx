import { Link } from 'react-router';
import { Sparkles, Star } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useScenarios } from '@/hooks/use-scenarios';
import { MobileNav } from './sidebar';

export function AppHeader() {
  const { scenarios, activeScenarioId, activeScenario, setActiveScenarioId } = useScenarios();

  const isDefaultSelected = activeScenario?.isDefault ?? true;

  // Build select props conditionally to avoid passing undefined value
  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: setActiveScenarioId }
    : { onValueChange: setActiveScenarioId };

  // Purple styling is the sign that a scenario other than the default is showing
  const showPurple = !isDefaultSelected;

  const headerBgClass = showPurple
    ? 'border-violet-500/50 bg-violet-500/10'
    : 'border-border bg-background';

  const iconClass = showPurple ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground';

  const selectTriggerClass = showPurple
    ? 'border-violet-500 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-400 dark:bg-violet-600 dark:hover:bg-violet-700 [&>svg]:text-white'
    : 'border-border bg-background hover:bg-muted';

  // Don't render scenario controls if no scenarios exist, but still show the header
  const hasScenarios = scenarios.length > 0;

  return (
    <header className={`flex h-14 shrink-0 items-center gap-3 border-b px-4 ${headerBgClass}`}>
      {/* Left: hamburger + branding */}
      <div className="flex items-center gap-2">
        <MobileNav />
        <Link
          to="/welcome"
          className="text-lg font-semibold transition-colors hover:text-muted-foreground"
        >
          SafelySpend
        </Link>
      </div>

      {hasScenarios && (
        <div className="flex flex-1 items-center justify-center gap-2 pr-3">
          <Sparkles className={`h-4 w-4 shrink-0 ${iconClass}`} />
          <span className="hidden font-medium sm:inline">Scenario:</span>
          <Select {...selectProps}>
            <SelectTrigger className={`h-7 w-auto gap-1 text-sm sm:gap-2 ${selectTriggerClass}`}>
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {[...scenarios]
                .sort((a, b) => {
                  if (a.isDefault) return -1;
                  if (b.isDefault) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    <span className="flex items-center gap-1.5">
                      {scenario.isDefault && (
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      )}
                      {scenario.name}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </header>
  );
}
