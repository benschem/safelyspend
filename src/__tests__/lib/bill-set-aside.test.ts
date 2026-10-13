import { describe, it, expect } from 'vitest';
import { calculateBillsSetAside, sumSetAsideCents } from '@/lib/bill-set-aside';
import type { ForecastRule } from '@/lib/types';

const MARCH = 2;

// Midday UTC, so the local date is the same day in any timezone
const LONG_AGO = '2020-01-01T12:00:00.000Z';

/** $900 car registration, due every 10 March, known about for years */
function registration(overrides: Partial<ForecastRule>): ForecastRule {
  return {
    id: 'registration',
    userId: 'local',
    createdAt: LONG_AGO,
    updatedAt: LONG_AGO,
    scenarioId: 'scenario-1',
    type: 'expense',
    description: 'Car registration',
    categoryId: 'car',
    savingsGoalId: null,
    amountCents: 90000,
    cadence: 'yearly',
    monthOfYear: MARCH,
    dayOfMonth: 10,
    ...overrides,
  };
}

function setAsideFor(forecastRule: ForecastRule, asOfDate: string): number | undefined {
  return calculateBillsSetAside([forecastRule], asOfDate)[0]?.setAsideCents;
}

describe('calculateBillsSetAside', () => {
  describe('a bill known about for more than a cycle', () => {
    it('sets aside the share of the year that has passed since it was last due', () => {
      // 10 March to 10 September is 184 of 365 days
      expect(setAsideFor(registration({}), '2026-09-10')).toBe(45370);
    });

    it('reports the full amount and the next due date', () => {
      expect(calculateBillsSetAside([registration({})], '2026-09-10')).toEqual([
        {
          ruleId: 'registration',
          description: 'Car registration',
          categoryId: 'car',
          amountCents: 90000,
          setAsideCents: 45370,
          nextDueDate: '2027-03-10',
        },
      ]);
    });

    it('has the whole amount set aside on the day it is due', () => {
      const dueToday = calculateBillsSetAside([registration({})], '2027-03-10');

      expect(dueToday[0]?.nextDueDate).toBe('2027-03-10');
      expect(dueToday[0]?.setAsideCents).toBe(90000);
    });

    it('starts again the day after it is due', () => {
      const dayAfter = calculateBillsSetAside([registration({})], '2027-03-11');

      // One day into a 366 day build-up, because 2028 is a leap year
      expect(dayAfter[0]?.nextDueDate).toBe('2028-03-10');
      expect(dayAfter[0]?.setAsideCents).toBe(246);
    });

    it('grows a little every day', () => {
      const yesterday = setAsideFor(registration({}), '2026-09-09') ?? 0;
      const today = setAsideFor(registration({}), '2026-09-10') ?? 0;

      // $900 over 365 days is about $2.47 a day
      expect(today - yesterday).toBe(247);
    });
  });

  describe('a bill added part-way through its cycle', () => {
    const addedInSeptember = registration({ createdAt: '2026-09-10T12:00:00.000Z' });

    it('has nothing set aside on the day it is added', () => {
      expect(setAsideFor(addedInSeptember, '2026-09-10')).toBe(0);
    });

    it('spreads the whole amount over the time left before it is due', () => {
      // 10 September to 10 March is 181 days; 10 December is 91 days in
      expect(setAsideFor(addedInSeptember, '2026-12-10')).toBe(45249);
      expect(setAsideFor(addedInSeptember, '2027-03-10')).toBe(90000);
    });

    it('goes back to building from its last due date after the first one', () => {
      // The same as a bill known about for years: 184 of 365 days
      expect(setAsideFor(addedInSeptember, '2027-09-10')).toBe(
        setAsideFor(registration({}), '2027-09-10'),
      );
    });
  });

  describe('a rule with a start date', () => {
    it('builds from the start date when that is later than the last due date', () => {
      const startsInJune = registration({ startDate: '2026-06-10' });

      // 10 June to 10 March is 273 days; 10 September is 92 days in
      expect(setAsideFor(startsInJune, '2026-09-10')).toBe(30330);
    });

    it('has nothing set aside before the rule starts', () => {
      const startsNextYear = registration({ startDate: '2027-01-01' });

      expect(setAsideFor(startsNextYear, '2026-09-10')).toBe(0);
    });
  });

  it('leaves out a bill that has no due date left before its end date', () => {
    const endsThisYear = registration({ endDate: '2026-12-31' });

    expect(calculateBillsSetAside([endsThisYear], '2026-09-10')).toEqual([]);
  });

  it('builds towards the occurrence after an excluded one', () => {
    const skipsNextYear = registration({ excludedDates: ['2027-03-10'] });

    const billsSetAside = calculateBillsSetAside([skipsNextYear], '2026-09-10');

    // 10 March 2026 to 10 March 2028 is 731 days; 184 have passed
    expect(billsSetAside[0]?.nextDueDate).toBe('2028-03-10');
    expect(billsSetAside[0]?.setAsideCents).toBe(22654);
  });

  it('builds a quarterly bill between its quarterly due dates', () => {
    const waterBill = registration({
      id: 'water',
      description: 'Water',
      categoryId: 'utilities',
      amountCents: 30000,
      cadence: 'quarterly',
      monthOfQuarter: 1,
      dayOfMonth: 15,
    });

    const billsSetAside = calculateBillsSetAside([waterBill], '2026-10-01');

    // 15 August to 15 November is 92 days; 1 October is 47 days in
    expect(billsSetAside[0]?.nextDueDate).toBe('2026-11-15');
    expect(billsSetAside[0]?.setAsideCents).toBe(15326);
  });

  it('leaves out weekly, fortnightly and monthly bills', () => {
    const shortCycleBills = [
      registration({ id: 'weekly', cadence: 'weekly', dayOfWeek: 4 }),
      registration({ id: 'fortnightly', cadence: 'fortnightly', dayOfWeek: 4 }),
      registration({ id: 'monthly', cadence: 'monthly', dayOfMonth: 28 }),
    ];

    expect(calculateBillsSetAside(shortCycleBills, '2026-09-10')).toEqual([]);
  });

  it('ignores income and savings rules', () => {
    const notBills = [
      registration({ id: 'bonus', type: 'income' }),
      registration({ id: 'holiday', type: 'savings' }),
    ];

    expect(calculateBillsSetAside(notBills, '2026-09-10')).toEqual([]);
  });

  it('works each bill out on its own, soonest due first', () => {
    const insurance = registration({
      id: 'insurance',
      description: 'Car insurance',
      amountCents: 120000,
      monthOfYear: 10,
      dayOfMonth: 1,
    });

    const billsSetAside = calculateBillsSetAside([registration({}), insurance], '2026-09-10');

    expect(billsSetAside.map((billSetAside) => billSetAside.ruleId)).toEqual([
      'insurance',
      'registration',
    ]);
    expect(billsSetAside[1]?.setAsideCents).toBe(45370);
  });

  it('scales with the amount', () => {
    const dearerRegistration = registration({ amountCents: 180000 });

    expect(setAsideFor(dearerRegistration, '2026-09-10')).toBe(90740);
  });
});

describe('sumSetAsideCents', () => {
  it('adds up what is set aside across every bill', () => {
    const insurance = registration({
      id: 'insurance',
      amountCents: 120000,
      monthOfYear: 10,
      dayOfMonth: 1,
    });
    const billsSetAside = calculateBillsSetAside([registration({}), insurance], '2026-09-10');

    const total = sumSetAsideCents(billsSetAside);

    expect(total).toBe((billsSetAside[0]?.setAsideCents ?? 0) + 45370);
    expect(total).toBeGreaterThan(45370);
  });

  it('is zero when nothing builds up', () => {
    expect(sumSetAsideCents([])).toBe(0);
  });
});
