import { useState } from 'react';
import {
  Calendar,
  ArrowLeftFromLine,
  SquareSplitHorizontal,
  ArrowRightFromLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TimelineMode, ZoomLevel } from '@/lib/types';

interface TimelinePickerProps {
  mode: TimelineMode;
  zoomLevel: ZoomLevel;
  startDate: string;
  endDate: string;
  customStartDate: string | undefined;
  customEndDate: string | undefined;
  onModeChange: (mode: TimelineMode) => void;
  onZoomLevelChange: (zoomLevel: ZoomLevel) => void;
  onCustomDateChange: (startDate: string, endDate: string) => void;
}

const MODES: { value: TimelineMode; label: string; icon: typeof ArrowLeftFromLine }[] = [
  { value: 'past', label: 'Past', icon: ArrowLeftFromLine },
  { value: 'around-present', label: 'Present', icon: SquareSplitHorizontal },
  { value: 'future', label: 'Future', icon: ArrowRightFromLine },
];

const ZOOM_LEVELS: { value: ZoomLevel; label: string }[] = [
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
  { value: 'quarters', label: 'quarters' },
  { value: 'years', label: 'years' },
  { value: 'decade', label: 'decade' },
];

export function TimelinePicker({
  mode,
  zoomLevel,
  startDate,
  endDate,
  customStartDate,
  customEndDate,
  onModeChange,
  onZoomLevelChange,
  onCustomDateChange,
}: TimelinePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(customStartDate || startDate);
  const [tempEndDate, setTempEndDate] = useState(customEndDate || endDate);

  const isCustomMode = mode === 'custom';

  const handleModeClick = (newMode: TimelineMode) => {
    if (newMode !== 'custom') {
      onModeChange(newMode);
    }
  };

  const handleCustomOpen = (open: boolean) => {
    if (open) {
      setTempStartDate(customStartDate || startDate);
      setTempEndDate(customEndDate || endDate);
    }
    setCustomOpen(open);
  };

  const handleApplyCustom = () => {
    if (tempStartDate && tempEndDate && tempStartDate <= tempEndDate) {
      onCustomDateChange(tempStartDate, tempEndDate);
      setCustomOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Mode Toggle Group + Custom Button */}
      <div className="flex items-center gap-2">
        <div className="inline-flex flex-1 rounded-md border border-input bg-background p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                onClick={() => handleModeClick(m.value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  mode === m.value && !isCustomMode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Button */}
        <Popover open={customOpen} onOpenChange={handleCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={isCustomMode ? 'default' : 'outline'}
              size="sm"
              className="h-9 gap-2"
            >
              <Calendar className="h-4 w-4" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Custom Date Range</h4>
                <p className="text-xs text-muted-foreground">
                  Select specific start and end dates
                </p>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="timeline-start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="timeline-start-date"
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="timeline-end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="timeline-end-date"
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!tempStartDate || !tempEndDate || tempStartDate > tempEndDate}
                className="w-full"
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Zoom Level Buttons */}
      <div className="inline-flex w-full rounded-md border border-input bg-background p-1">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z.value}
            onClick={() => onZoomLevelChange(z.value)}
            disabled={isCustomMode}
            className={cn(
              'flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              zoomLevel === z.value && !isCustomMode
                ? 'bg-secondary text-secondary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {z.label}
          </button>
        ))}
      </div>
    </div>
  );
}
