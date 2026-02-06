import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <span className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Light
          </span>
        </SelectItem>
        <SelectItem value="dark">
          <span className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Dark
          </span>
        </SelectItem>
        <SelectItem value="system">
          <span className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Simple icon button alternative
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={`Theme: ${theme}`}>
      {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
