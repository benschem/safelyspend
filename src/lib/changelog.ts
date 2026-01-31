/**
 * Changelog for the application
 *
 * Format:
 * - version: Semantic version (MAJOR.MINOR.PATCH)
 * - date: Release date in YYYY-MM-DD format
 * - changes: Array of user-friendly change descriptions
 *
 * Guidelines:
 * - Write for non-technical users
 * - Focus on what users can do, not how it works
 * - Keep descriptions concise (one sentence)
 * - Don't include technical details or security-sensitive information
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.3.2',
    date: '2026-01-31',
    changes: [
      'Clearer terminology: Cash flow now shows "Earned, Spent, Saved"',
      'Expanded frequency labels: "/wk" is now "/week", "/fn" is now "/fortnight", etc.',
      'Amount badges in tables now show tooltips explaining the transaction type',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-01-31',
    changes: [
      'Fixed Spending page showing incorrect data when no budget or forecast is set',
      'Fixed savings goal showing unrealistic completion estimates',
      'Balance inputs now accept commas and dollar signs',
      'Added helper text when selecting day 29-31 for recurring items',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-01-31',
    changes: [
      'Convert one-time forecasts to recurring with the new "Make Recurring" button',
      'Pre-fills recurring rule with details from the one-time event',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-01-31',
    changes: [
      'Fixed search not finding items in tables',
      'Search now correctly resets to page 1 when typing',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-01-31',
    changes: [
      'Fixed tables jumping back to page 1 after editing items',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-31',
    changes: [
      'Added budget suggestions when creating recurring expenses',
      'New "Add to Budget" action on transactions to quickly create budgets',
      'Choose between one-time budget allowances or recurring budgets from transactions',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-31',
    changes: [
      'Initial beta release',
      'Track income, expenses, and savings',
      'Create budgets with flexible frequencies',
      'Plan future finances with forecasts',
      'Set and track savings goals',
      'Import transactions from CSV',
      'Export and backup your data',
    ],
  },
];

export const currentVersion = changelog[0]?.version ?? '1.0.0';
