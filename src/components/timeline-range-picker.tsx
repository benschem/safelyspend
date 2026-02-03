import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatCompactDate, TIMELINE_UNIT_BOUNDS } from '@/lib/utils';
import type { TimelineMode, TimelineUnit } from '@/lib/types';

interface TimelineRangePickerProps {
  mode: TimelineMode;
  amount: number;
  unit: TimelineUnit;
  lastPresetMode: 'past' | 'around-present' | 'future';
  startDate: string;
  endDate: string;
  onModeChange: (mode: TimelineMode) => void;
  onAmountChange: (amount: number) => void;
  onUnitChange: (unit: TimelineUnit) => void;
  onCustomDateChange: (startDate: string, endDate: string) => void;
}

const MODES: { value: TimelineMode; label: string }[] = [
  { value: 'past', label: 'Past' },
  { value: 'around-present', label: 'Present' },
  { value: 'future', label: 'Future' },
];

const UNITS: { value: TimelineUnit; label: string; pluralLabel: string }[] = [
  { value: 'months', label: 'month', pluralLabel: 'months' },
  { value: 'years', label: 'year', pluralLabel: 'years' },
];

function formatTimelineDescription(amount: number, unit: TimelineUnit, mode: TimelineMode): string {
  const unitLabel =
    amount === 1
      ? UNITS.find((u) => u.value === unit)?.label
      : UNITS.find((u) => u.value === unit)?.pluralLabel;

  switch (mode) {
    case 'past':
      return `${amount} ${unitLabel} before now`;
    case 'around-present':
      return `${amount} ${unitLabel} around now`;
    case 'future':
      return `${amount} ${unitLabel} after now`;
    case 'custom':
      return 'Custom range';
  }
}

export function TimelineRangePicker({
  mode,
  amount,
  unit,
  lastPresetMode,
  startDate,
  endDate,
  onModeChange,
  onAmountChange,
  onUnitChange,
  onCustomDateChange,
}: TimelineRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [customFocused, setCustomFocused] = useState(false);

  const isCustomMode = mode === 'custom';
  const isCustomActive = isCustomMode || customFocused;
  const bounds = TIMELINE_UNIT_BOUNDS[unit];

  // Show computed dates when not actively editing custom range
  const displayStartDate = isCustomActive ? tempStartDate : startDate;
  const displayEndDate = isCustomActive ? tempEndDate : endDate;

  // Format description for button
  const description = isCustomMode
    ? `${formatCompactDate(startDate, true)} → ${formatCompactDate(endDate, true)}`
    : formatTimelineDescription(amount, unit, mode);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    } else {
      setCustomFocused(false);
    }
    setOpen(newOpen);
  };

  const handleStartDateChange = (value: string) => {
    setTempStartDate(value);
    setCustomFocused(true);
    // Apply immediately if valid
    if (value && tempEndDate && value <= tempEndDate) {
      onCustomDateChange(value, tempEndDate);
    }
  };

  const handleEndDateChange = (value: string) => {
    setTempEndDate(value);
    setCustomFocused(true);
    // Apply immediately if valid
    if (tempStartDate && value && tempStartDate <= value) {
      onCustomDateChange(tempStartDate, value);
    }
  };

  const handleAmountChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= bounds.min && num <= bounds.max) {
      setCustomFocused(false);
      onAmountChange(num);
    }
  };

  const handleUnitChange = (newUnit: TimelineUnit) => {
    setCustomFocused(false);
    onUnitChange(newUnit);
  };

  const handleModeClick = (newMode: TimelineMode) => {
    if (newMode !== 'custom') {
      setCustomFocused(false);
      onModeChange(newMode);
    }
  };

  // Generate amount options based on current unit bounds
  const amountOptions = [];
  for (let i = bounds.min; i <= bounds.max; i++) {
    amountOptions.push(i);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          <span>{description}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit min-w-72" align="start">
        <div className="space-y-4">
          {/* Preset controls */}
          <div className={cn('flex items-center gap-2', isCustomActive && 'opacity-50')}>
            <Select
              value={isCustomActive ? '' : amount.toString()}
              onValueChange={handleAmountChange}
            >
              <SelectTrigger className="w-16 cursor-pointer">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {amountOptions.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={isCustomActive ? '' : unit}
              onValueChange={(v) => handleUnitChange(v as TimelineUnit)}
            >
              <SelectTrigger className="w-24 cursor-pointer">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {amount === 1 ? u.label : u.pluralLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Direction Toggle */}
            <div className="inline-flex h-9 flex-1 rounded-md border border-input bg-background p-1 shadow-sm">
              {MODES.map((m) => {
                const isSelected = isCustomActive ? m.value === lastPresetMode : m.value === mode;
                return (
                  <button
                    key={m.value}
                    onClick={() => handleModeClick(m.value)}
                    className={cn(
                      'flex flex-1 cursor-pointer items-center justify-center rounded-sm px-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected
                        ? isCustomActive
                          ? 'bg-primary/50 text-primary-foreground/70 shadow-sm'
                          : 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date inputs - always visible, synced with current range */}
          <div className={cn('grid grid-cols-2 gap-2', !isCustomActive && 'opacity-50')}>
            <div className="grid gap-1">
              <Label htmlFor="timeline-range-start" className="text-xs text-muted-foreground">
                Start
              </Label>
              <Input
                id="timeline-range-start"
                type="date"
                value={displayStartDate}
                max={displayEndDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                onFocus={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setCustomFocused(true);
                }}
                className="h-8 cursor-pointer"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="timeline-range-end" className="text-xs text-muted-foreground">
                End
              </Label>
              <Input
                id="timeline-range-end"
                type="date"
                value={displayEndDate}
                min={displayStartDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                onFocus={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setCustomFocused(true);
                }}
                className="h-8 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
