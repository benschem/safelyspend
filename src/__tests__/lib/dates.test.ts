import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  addDays,
  daysBetween,
  formatISODate,
  formatYearMonth,
  isRealDate,
  parseLocalDate,
  today,
} from '@/lib/dates';

const JANUARY = 0;
const SYDNEY_SUMMER_OFFSET_MINUTES = -11 * 60;

describe('the test timezone', () => {
  it('is Sydney, so the local date and the UTC date differ for part of each day', () => {
    expect(new Date(2026, JANUARY, 15).getTimezoneOffset()).toBe(SYDNEY_SUMMER_OFFSET_MINUTES);
  });
});

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the local date while UTC is still on the day before', () => {
    vi.useFakeTimers();
    // 7am on 16 January in Sydney
    vi.setSystemTime(new Date('2026-01-15T20:00:00Z'));

    expect(today()).toBe('2026-01-16');
  });

  it('is the local date once UTC has caught up', () => {
    vi.useFakeTimers();
    // 3pm on 16 January in Sydney
    vi.setSystemTime(new Date('2026-01-16T04:00:00Z'));

    expect(today()).toBe('2026-01-16');
  });
});

describe('parseLocalDate', () => {
  it('gives midnight on that day, local time', () => {
    const date = parseLocalDate('2026-01-15');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(JANUARY);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
  });

  it('keeps the day in a timezone west of UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');

    expect(parseLocalDate('2025-07-01').getDate()).toBe(1);

    vi.unstubAllEnvs();
  });
});

describe('formatISODate', () => {
  it('pads the month and the day', () => {
    expect(formatISODate(new Date(2026, JANUARY, 5))).toBe('2026-01-05');
  });

  it('uses the local day just after midnight', () => {
    expect(formatISODate(new Date(2026, JANUARY, 16, 0, 30))).toBe('2026-01-16');
  });

  it('round-trips with parseLocalDate', () => {
    expect(formatISODate(parseLocalDate('2024-02-29'))).toBe('2024-02-29');
  });
});

describe('formatYearMonth', () => {
  it('pads the month', () => {
    expect(formatYearMonth(new Date(2026, JANUARY, 31))).toBe('2026-01');
  });
});

describe('daysBetween', () => {
  it('is zero for the same day', () => {
    expect(daysBetween('2026-01-15', '2026-01-15')).toBe(0);
  });

  it('counts forward across a month end', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-02-02', '2026-01-30')).toBe(-3);
  });

  it('counts a 23-hour day as a day when daylight saving starts', () => {
    // Sydney clocks go forward on 4 October 2026
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2);
  });

  it('counts a 25-hour day as a day when daylight saving ends', () => {
    // Sydney clocks go back on 5 April 2026
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2);
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('counts back with a negative number', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('gives each day of October once, across the start of daylight saving', () => {
    const daysOfOctober = Array.from({ length: 31 }, (_, index) => addDays('2026-10-01', index));

    expect(daysOfOctober[3]).toBe('2026-10-04');
    expect(daysOfOctober[30]).toBe('2026-10-31');
    expect(new Set(daysOfOctober).size).toBe(31);
  });
});

describe('isRealDate', () => {
  it('accepts a leap day in a leap year', () => {
    expect(isRealDate('2024-02-29')).toBe(true);
  });

  it('rejects a leap day in any other year', () => {
    expect(isRealDate('2025-02-29')).toBe(false);
  });

  it('rejects a day the month does not have', () => {
    expect(isRealDate('2025-02-31')).toBe(false);
  });

  it('rejects a month that does not exist', () => {
    expect(isRealDate('2025-13-01')).toBe(false);
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(isRealDate('2025-2-3')).toBe(false);
    expect(isRealDate('15 Jan 2026')).toBe(false);
    expect(isRealDate('')).toBe(false);
  });
});
