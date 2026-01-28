import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  formatDateRange,
  getDateRangePreset,
  type DateRangePreset,
} from '@/lib/utils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  dataRange?: { startDate: string; endDate: string } | null;
}

const PRESET_SECTIONS: { title: string; presets: { label: string; value: DateRangePreset }[] }[] = [
  {
    title: 'Past',
    presets: [
      { label: 'Last 7 days', value: 'last7days' },
      { label: 'Last 30 days', value: 'last30days' },
      { label: 'Last 3 months', value: 'last3months' },
      { label: 'Last year', value: 'lastYear' },
    ],
  },
  {
    title: 'Current',
    presets: [
      { label: 'This week', value: 'thisWeek' },
      { label: 'This month', value: 'thisMonth' },
      { label: 'This quarter', value: 'thisQuarter' },
      { label: 'Financial year', value: 'thisFinancialYear' },
    ],
  },
  {
    title: 'Future',
    presets: [
      { label: 'Next 7 days', value: 'next7days' },
      { label: 'Next 30 days', value: 'next30days' },
      { label: 'Next 3 months', value: 'next3months' },
      { label: 'Next 12 months', value: 'next12months' },
    ],
  },
  {
    title: 'Rolling',
    presets: [
      { label: '± 30 days', value: 'rolling30days' },
      { label: '± 3 months', value: 'rolling3months' },
      { label: '± 6 months', value: 'rolling6months' },
      { label: '± 12 months', value: 'rolling12months' },
    ],
  },
];

export function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
  dataRange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = getDateRangePreset(preset);
    onDateRangeChange(range.startDate, range.endDate);
    setCustomStart(range.startDate);
    setCustomEnd(range.endDate);
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onDateRangeChange(customStart, customEnd);
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCustomStart(startDate);
      setCustomEnd(endDate);
    }
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Calendar className="h-4 w-4" />
          <span>{formatDateRange(startDate, endDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96" align="end">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {PRESET_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <h4 className="px-2 text-xs font-medium text-muted-foreground">{section.title}</h4>
                <div className="flex flex-col gap-0.5">
                  {section.presets.map((preset) => (
                    <Button
                      key={preset.value}
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePresetClick(preset.value)}
                      className="h-7 w-full justify-start px-2 text-xs font-normal"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {dataRange && (
            <>
              <Separator />
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDateRangeChange(dataRange.startDate, dataRange.endDate);
                    setCustomStart(dataRange.startDate);
                    setCustomEnd(dataRange.endDate);
                    setOpen(false);
                  }}
                  className="h-8 w-full justify-start px-2 text-sm font-normal"
                >
                  All Data
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDateRange(dataRange.startDate, dataRange.endDate)}
                  </span>
                </Button>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground">Custom Range</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="start-date" className="text-xs">
                  Start
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="end-date" className="text-xs">
                  End
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleApplyCustom}
              disabled={!customStart || !customEnd || customStart > customEnd}
              className="w-full"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
