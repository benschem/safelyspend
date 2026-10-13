import { describe, it, expect } from 'vitest';
import {
  allowanceLabel,
  allowanceMatchKey,
  allowancesForCategory,
  expandBudgetsByCategory,
  isAllowanceNameTaken,
  sumAllowancesForPeriod,
} from '@/lib/allowances';
import { buildMonthlyLimitsByCategory } from '@/lib/category-limits';
import type { BudgetRule } from '@/lib/types';

function allowance(overrides: Partial<BudgetRule>): BudgetRule {
  return {
    id: 'allowance-1',
    userId: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'scenario-1',
    categoryId: 'health-and-beauty',
    amountCents: 10000,
    cadence: 'monthly',
    ...overrides,
  };
}

// Two allowances in one category at different frequencies, and one elsewhere.
// $80 a fortnight is $2,080 a year, so $173.33 a month. With $60 a month the
// category comes to $233.33 a month.
const LASHES = allowance({
  id: 'lashes',
  name: 'Lashes',
  amountCents: 8000,
  cadence: 'fortnightly',
});
const NAILS = allowance({ id: 'nails', name: 'Nails', amountCents: 6000, cadence: 'monthly' });
const GROCERIES = allowance({ id: 'groceries', categoryId: 'groceries', amountCents: 20000 });
const ALLOWANCES = [LASHES, NAILS, GROCERIES];

describe('allowanceLabel', () => {
  it('is the name of a named allowance', () => {
    expect(allowanceLabel(LASHES)).toBe('Lashes');
  });

  it('is "General spending" for an allowance with no name', () => {
    expect(allowanceLabel(GROCERIES)).toBe('General spending');
  });
});

describe('allowancesForCategory', () => {
  it('returns every allowance in the category', () => {
    expect(allowancesForCategory(ALLOWANCES, 'health-and-beauty')).toEqual([LASHES, NAILS]);
  });

  it('returns none for a category with no allowance', () => {
    expect(allowancesForCategory(ALLOWANCES, 'transport')).toEqual([]);
  });
});

describe('sumAllowancesForPeriod', () => {
  it('adds up allowances at different frequencies as an average for the period', () => {
    expect(sumAllowancesForPeriod([LASHES, NAILS], 'monthly')).toBe(17333 + 6000);
  });

  it('converts to a period other than a month', () => {
    // $2,080 a year for lashes plus $720 a year for nails
    expect(sumAllowancesForPeriod([LASHES, NAILS], 'yearly')).toBe(280000);
  });

  it('is zero for no allowances', () => {
    expect(sumAllowancesForPeriod([], 'monthly')).toBe(0);
  });
});

describe('isAllowanceNameTaken', () => {
  it('is true for a name another allowance in the category has', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', 'Lashes')).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', '  lashes ')).toBe(true);
  });

  it('is false for the same name in another category', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'groceries', 'Lashes')).toBe(false);
  });

  it('is false for a new name in the category', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', 'Hair')).toBe(false);
  });

  it('counts having no name as a name', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'groceries', undefined)).toBe(true);
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', undefined)).toBe(false);
  });

  it('does not compare the allowance being edited with itself', () => {
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', 'Lashes', LASHES)).toBe(false);
    expect(isAllowanceNameTaken(ALLOWANCES, 'health-and-beauty', 'Nails', LASHES)).toBe(true);
  });

  describe('when data already holds two allowances of one name', () => {
    // An itemised allowance could have two items called "Nails", and each
    // became an allowance
    const NAILS_TWIN = allowance({ id: 'nails-twin', name: 'Nails', amountCents: 4000 });
    const WITH_TWINS = [...ALLOWANCES, NAILS_TWIN];

    it('lets one be saved when its category and name are unchanged', () => {
      expect(isAllowanceNameTaken(WITH_TWINS, 'health-and-beauty', 'Nails', NAILS)).toBe(false);
      expect(isAllowanceNameTaken(WITH_TWINS, 'health-and-beauty', ' nails', NAILS_TWIN)).toBe(
        false,
      );
    });

    it('still refuses renaming another allowance to that name', () => {
      expect(isAllowanceNameTaken(WITH_TWINS, 'health-and-beauty', 'Nails', LASHES)).toBe(true);
    });

    it('still refuses moving one to a category that has the name', () => {
      const nailsElsewhere = allowance({ id: 'nails-elsewhere', name: 'Nails', categoryId: 'x' });

      expect(isAllowanceNameTaken(WITH_TWINS, 'health-and-beauty', 'Nails', nailsElsewhere)).toBe(
        true,
      );
    });
  });
});

describe('allowanceMatchKey', () => {
  it('pairs an allowance with its copy in another scenario', () => {
    const copyInAnotherScenario = { ...LASHES, id: 'lashes-copy', scenarioId: 'scenario-2' };

    expect(allowanceMatchKey(copyInAnotherScenario)).toBe(allowanceMatchKey(LASHES));
  });

  it('tells two allowances in one category apart', () => {
    expect(allowanceMatchKey(LASHES)).not.toBe(allowanceMatchKey(NAILS));
  });

  it('tells the same name in two categories apart', () => {
    const lashesElsewhere = { ...LASHES, categoryId: 'groceries' };

    expect(allowanceMatchKey(lashesElsewhere)).not.toBe(allowanceMatchKey(LASHES));
  });

  it('tells an unnamed allowance from a named one in the same category', () => {
    const generalSpending = allowance({ id: 'general' });

    expect(allowanceMatchKey(generalSpending)).not.toBe(allowanceMatchKey(LASHES));
  });
});

describe('expandBudgetsByCategory', () => {
  it('adds up every allowance in a category over the range', () => {
    // October 2026 is 31 days: three fortnights started, and one month
    const expanded = expandBudgetsByCategory(ALLOWANCES, '2026-10-01', '2026-10-31');

    expect(expanded).toEqual({
      'health-and-beauty': 8000 * 3 + 6000,
      groceries: 20000,
    });
  });
});

describe('a category with two allowances', () => {
  it('has the same monthly figure on the Budget page as in its Cash Flow limit', () => {
    const limits = buildMonthlyLimitsByCategory(ALLOWANCES, [], '2026-10-01', '2026-10-31');
    const budgetPageCents = sumAllowancesForPeriod(
      allowancesForCategory(ALLOWANCES, 'health-and-beauty'),
      'monthly',
    );

    expect(limits['health-and-beauty']?.allowanceCents).toBe(budgetPageCents);
  });
});
