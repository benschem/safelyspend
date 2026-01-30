import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
  hasFilter: boolean;
  placeholder?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  hasFilter,
  placeholder = 'All dates',
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const getDisplayText = () => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && endDate) {
      return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    }
    if (startDate) return `From ${formatDate(startDate)}`;
    if (endDate) return `Until ${formatDate(endDate)}`;
    return placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-9 justify-start gap-2 font-normal ${!hasFilter ? 'text-muted-foreground' : ''}`}
        >
          <Calendar className="h-4 w-4" />
          <span className="truncate">{getDisplayText()}</span>
          {hasFilter && (
            <X
              className="ml-auto h-4 w-4 shrink-0 cursor-pointer opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <label htmlFor="date-filter-from" className="text-xs text-muted-foreground">From</label>
              <Input
                id="date-filter-from"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="h-9 w-36"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="date-filter-to" className="text-xs text-muted-foreground">To</label>
              <Input
                id="date-filter-to"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="h-9 w-36"
              />
            </div>
          </div>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
              Clear dates
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
