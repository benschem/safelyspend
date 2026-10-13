import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScheduleDays } from '@/lib/cadence';
import type { Cadence } from '@/lib/types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Ordered Monday-first for display, with correct JS dayOfWeek values (0=Sun, 1=Mon, etc.)
const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);

function DayOfMonthSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (dayOfMonth: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(day) => onChange(parseInt(day, 10))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DAYS_OF_MONTH.map((day) => (
          <SelectItem key={day} value={String(day)}>
            {day}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ScheduleDayFieldsProps {
  cadence: Cadence;
  days: ScheduleDays;
  onChange: (days: ScheduleDays) => void;
}

/**
 * The pickers for the day a recurring rule lands on. Which ones show depends
 * on the cadence: a weekday for weekly and fortnightly, a day of the month for
 * the rest, with the month for yearly and the month of the quarter for
 * quarterly.
 */
export function ScheduleDayFields({ cadence, days, onChange }: ScheduleDayFieldsProps) {
  const setDayOfMonth = (dayOfMonth: number) => onChange({ ...days, dayOfMonth });

  if (cadence === 'weekly' || cadence === 'fortnightly') {
    return (
      <div className="space-y-2">
        <Label className="select-none">Day of Week</Label>
        <Select
          value={String(days.dayOfWeek)}
          onValueChange={(day) => onChange({ ...days, dayOfWeek: parseInt(day, 10) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((day) => (
              <SelectItem key={day.value} value={String(day.value)}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (cadence === 'monthly') {
    return (
      <div className="space-y-2">
        <Label className="select-none">Day of Month</Label>
        <DayOfMonthSelect value={days.dayOfMonth} onChange={setDayOfMonth} />
        {days.dayOfMonth > 28 && (
          <p className="text-xs text-muted-foreground">
            For shorter months, uses last day of month
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {cadence === 'yearly' ? (
        <div className="space-y-2">
          <Label className="select-none">Month</Label>
          <Select
            value={String(days.monthOfYear)}
            onValueChange={(month) => onChange({ ...days, monthOfYear: parseInt(month, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, monthIndex) => (
                <SelectItem key={name} value={String(monthIndex)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="select-none">Month of Quarter</Label>
          <Select
            value={String(days.monthOfQuarter)}
            onValueChange={(month) => onChange({ ...days, monthOfQuarter: parseInt(month, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">1st month</SelectItem>
              <SelectItem value="1">2nd month</SelectItem>
              <SelectItem value="2">3rd month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label className="select-none">Day</Label>
        <DayOfMonthSelect value={days.dayOfMonth} onChange={setDayOfMonth} />
      </div>
    </div>
  );
}
