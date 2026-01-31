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
    version: '1.1.0',
    date: '2026-01-31',
    changes: [
      'Added budget suggestions when creating recurring expenses',
      'New "Add to Budget" action on transactions to quickly create budgets',
      'Choose between one-time budget allowances or recurring budgets from transactions',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-31',
    changes: [
      'Initial release',
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
