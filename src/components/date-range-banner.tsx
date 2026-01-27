import { formatDateRange } from '@/lib/utils';

interface DateRangeBannerProps {
  startDate: string;
  endDate: string;
}

export function DateRangeBanner({ startDate, endDate }: DateRangeBannerProps) {
  return (
    <div className="flex items-center justify-center border-b border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
      <span>
        Viewing: <span className="font-medium text-foreground">{formatDateRange(startDate, endDate)}</span>
      </span>
    </div>
  );
}
