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

interface DateRangeBannerProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '1 Week', value: '1week' },
  { label: '1 Month', value: '1month' },
  { label: '3 Months', value: '3months' },
  { label: '6 Months', value: '6months' },
  { label: '1 Year', value: '1year' },
  { label: 'Financial Year', value: 'financialYear' },
];

export function DateRangeBanner({
  startDate,
  endDate,
  onDateRangeChange,
}: DateRangeBannerProps) {
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
    <div className="flex items-center justify-center border-b border-border bg-muted/50 px-4 py-1.5 text-sm">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 rounded px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Viewing:{' '}
              <span className="font-medium text-foreground">
                {formatDateRange(startDate, endDate)}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="center">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Select</h4>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset.value)}
                    className="justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Custom Range</h4>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
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
                    End Date
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
    </div>
  );
}
