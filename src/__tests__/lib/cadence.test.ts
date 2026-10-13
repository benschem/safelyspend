import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCHEDULE_DAYS,
  expandForecastRule,
  scheduleDaysForCadence,
  scheduleDaysOf,
} from '@/lib/cadence';
import type { ForecastRule } from '@/lib/types';

const THURSDAY = 4;
const MARCH = 2;

function rule(overrides: Partial<ForecastRule>): ForecastRule {
  return {
    id: 'rule-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    type: 'expense',
    description: 'Car registration',
    categoryId: 'car',
    savingsGoalId: null,
    amountCents: 90000,
    cadence: 'monthly',
    ...overrides,
  };
}

function datesOf(forecastRule: ForecastRule, rangeStart: string, rangeEnd: string): string[] {
  return expandForecastRule(forecastRule, rangeStart, rangeEnd).map((forecast) => forecast.date);
}

describe('expandForecastRule', () => {
  it('carries the rule into each occurrence', () => {
    const occurrences = expandForecastRule(rule({ dayOfMonth: 10 }), '2026-10-01', '2026-10-31');

    expect(occurrences).toEqual([
      {
        type: 'expense',
        date: '2026-10-10',
        amountCents: 90000,
        description: 'Car registration',
        categoryId: 'car',
        savingsGoalId: null,
        sourceType: 'rule',
        sourceId: 'rule-1',
      },
    ]);
  });

  describe('weekly', () => {
    it('lands on its day of the week, every week', () => {
      const weeklyRule = rule({ cadence: 'weekly', dayOfWeek: THURSDAY });

      expect(datesOf(weeklyRule, '2026-10-01', '2026-10-31')).toEqual([
        '2026-10-01',
        '2026-10-08',
        '2026-10-15',
        '2026-10-22',
        '2026-10-29',
      ]);
    });
  });

  describe('fortnightly', () => {
    it('counts fortnights from the rule start date', () => {
      const fortnightlyRule = rule({
        cadence: 'fortnightly',
        dayOfWeek: THURSDAY,
        startDate: '2026-10-01',
      });

      expect(datesOf(fortnightlyRule, '2026-10-01', '2026-11-30')).toEqual([
        '2026-10-01',
        '2026-10-15',
        '2026-10-29',
        '2026-11-12',
        '2026-11-26',
      ]);
    });

    it('lands on the same dates whatever range is asked for', () => {
      const fortnightlyRule = rule({ cadence: 'fortnightly', dayOfWeek: THURSDAY });

      const octoberAlone = datesOf(fortnightlyRule, '2026-10-01', '2026-10-31');
      const octoberWithinAYear = datesOf(fortnightlyRule, '2026-01-01', '2026-12-31').filter(
        (date) => date >= '2026-10-01' && date <= '2026-10-31',
      );

      expect(octoberAlone.length).toBeGreaterThan(0);
      expect(octoberAlone).toEqual(octoberWithinAYear);
    });

    it('is two weeks apart', () => {
      const fortnightlyRule = rule({ cadence: 'fortnightly', dayOfWeek: THURSDAY });

      const dates = datesOf(fortnightlyRule, '2026-01-01', '2026-12-31');
      const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
      const daysBetween = dates
        .slice(1)
        .map(
          (date, index) => (Date.parse(date) - Date.parse(dates[index]!)) / MILLISECONDS_PER_DAY,
        );

      expect(dates.length).toBeGreaterThan(1);
      expect(daysBetween.every((gap) => gap === 14)).toBe(true);
    });
  });

  describe('monthly', () => {
    it('lands on its day of the month', () => {
      expect(datesOf(rule({ dayOfMonth: 15 }), '2026-10-01', '2026-12-31')).toEqual([
        '2026-10-15',
        '2026-11-15',
        '2026-12-15',
      ]);
    });

    it('falls on the last day of a month that is too short', () => {
      expect(datesOf(rule({ dayOfMonth: 31 }), '2027-01-01', '2027-04-30')).toEqual([
        '2027-01-31',
        '2027-02-28',
        '2027-03-31',
        '2027-04-30',
      ]);
    });
  });

  describe('quarterly', () => {
    it('lands once a quarter, in its month of the quarter', () => {
      const quarterlyRule = rule({ cadence: 'quarterly', monthOfQuarter: 1, dayOfMonth: 15 });

      expect(datesOf(quarterlyRule, '2026-01-01', '2026-12-31')).toEqual([
        '2026-02-15',
        '2026-05-15',
        '2026-08-15',
        '2026-11-15',
      ]);
    });

    it('is not due in a month between its due dates', () => {
      const quarterlyRule = rule({ cadence: 'quarterly', monthOfQuarter: 1, dayOfMonth: 15 });

      expect(datesOf(quarterlyRule, '2026-10-01', '2026-10-31')).toEqual([]);
    });
  });

  describe('yearly', () => {
    it('lands once a year, in its month', () => {
      const yearlyRule = rule({ cadence: 'yearly', monthOfYear: MARCH, dayOfMonth: 10 });

      expect(datesOf(yearlyRule, '2026-01-01', '2027-12-31')).toEqual(['2026-03-10', '2027-03-10']);
    });

    it('is not due in any other month', () => {
      const yearlyRule = rule({ cadence: 'yearly', monthOfYear: MARCH, dayOfMonth: 10 });

      expect(datesOf(yearlyRule, '2026-10-01', '2026-10-31')).toEqual([]);
    });
  });

  describe('the rule start and end dates', () => {
    it('leaves out occurrences before the rule starts', () => {
      const startsInNovember = rule({ dayOfMonth: 1, startDate: '2026-11-01' });

      expect(datesOf(startsInNovember, '2026-10-01', '2026-12-31')).toEqual([
        '2026-11-01',
        '2026-12-01',
      ]);
    });

    it('leaves out occurrences after the rule ends', () => {
      const endsInOctober = rule({ dayOfMonth: 1, endDate: '2026-10-31' });

      expect(datesOf(endsInOctober, '2026-10-01', '2026-12-31')).toEqual(['2026-10-01']);
    });

    it('has no occurrences when the rule starts after the range', () => {
      const startsNextYear = rule({ dayOfMonth: 1, startDate: '2027-01-01' });

      expect(datesOf(startsNextYear, '2026-10-01', '2026-12-31')).toEqual([]);
    });

    it('treats an empty string as no date', () => {
      const emptyDates = rule({ dayOfMonth: 1, startDate: '', endDate: '' });

      expect(datesOf(emptyDates, '2026-10-01', '2026-10-31')).toEqual(['2026-10-01']);
    });
  });

  it('leaves out an excluded date', () => {
    const skipsNovember = rule({ dayOfMonth: 15, excludedDates: ['2026-11-15'] });

    expect(datesOf(skipsNovember, '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-15',
      '2026-12-15',
    ]);
  });
});

describe('scheduleDaysForCadence', () => {
  const days = { dayOfWeek: 5, dayOfMonth: 15, monthOfYear: 2, monthOfQuarter: 1 };

  it('keeps only the weekday for weekly and fortnightly rules', () => {
    expect(scheduleDaysForCadence('weekly', days)).toEqual({ dayOfWeek: 5 });
    expect(scheduleDaysForCadence('fortnightly', days)).toEqual({ dayOfWeek: 5 });
  });

  it('keeps the day of the month for monthly rules', () => {
    expect(scheduleDaysForCadence('monthly', days)).toEqual({ dayOfMonth: 15 });
  });

  it('adds the month of the quarter or of the year', () => {
    expect(scheduleDaysForCadence('quarterly', days)).toEqual({
      dayOfMonth: 15,
      monthOfQuarter: 1,
    });
    expect(scheduleDaysForCadence('yearly', days)).toEqual({ dayOfMonth: 15, monthOfYear: 2 });
  });
});

describe('scheduleDaysOf', () => {
  it('reads the days a rule stores and defaults the rest', () => {
    expect(scheduleDaysOf({ dayOfMonth: 20, monthOfYear: 6 })).toEqual({
      ...DEFAULT_SCHEDULE_DAYS,
      dayOfMonth: 20,
      monthOfYear: 6,
    });
  });
});
