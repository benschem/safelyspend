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
    version: '0.13.1',
    date: '2026-02-02',
    changes: [
      'What-If adjustments now update the Budget page cards, chart, and all other pages in real-time',
      'See how your budget changes affect all parts of the app before saving',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-02-02',
    changes: [
      'Budget page now features sliders for exploring what-if scenarios',
      'Adjust income, expenses, and savings to see how changes affect your surplus',
      'What-If mode banner shows when you have unsaved adjustments',
      'Save your adjustments as a new preset to keep your changes',
      'Reset button discards adjustments and returns to baseline values',
    ],
  },
  {
    version: '0.12.2',
    date: '2026-02-02',
    changes: [
      'Spending pace chart now shows a Safe Limit line when you have surplus buffer',
      'Improved chart with clearer labels, colors, and complete legend',
      'Spending section now shows amounts against budgeted totals',
      'Pace text now clarifies when spending is against your budget',
    ],
  },
  {
    version: '0.12.1',
    date: '2026-02-02',
    changes: [
      'Spending pace chart now shows Expected Pace line in green for better visibility',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-02-02',
    changes: [
      'Budget page now shows your Track Record - historical averages alongside your plan',
      'Past Transactions section moved to Budget page for easy reference',
      'Summary cards show budget values with track record averages below',
      'Variable expenses card shows green/amber based on spending vs budget',
      'Removed Past Averages page - all functionality now in Budget',
    ],
  },
  {
    version: '0.11.1',
    date: '2026-02-02',
    changes: [
      'Cash Flow tab now warns when savings balances are missing',
      'Budget dialog now shows if adding a budget will overcommit your income',
      'Yearly frequency budgets now let you choose both month and day',
      'Snapshot sparkline now uses purple for future months (blue is for savings)',
      'Snapshot page now shows "Today" indicator with icon for consistency',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-02-02',
    changes: [
      'Renamed Money page to Past Averages for clearer terminology',
      'Renamed Net Worth page to Net Wealth',
      'Budget page now shows separate sections for Income, Fixed Expenses, Budgeted Expenses, and Savings',
      'Fixed Expenses section lists all recurring expense commitments with orange styling',
      'Budget page now shows budget status as a prominent hero display',
      'Past Averages page now shows net gain/loss as a prominent hero display',
      'Savings chart tooltip now says "Saved this month" instead of "Actual this month"',
      'Spending chart tooltips now only show selected categories',
      'Insights tabs now have colored icons',
      'Snapshot month view has improved compact layout',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-02-02',
    changes: [
      'Set starting balances for savings goals without entering past transactions',
      'New Savings Balances section in Settings for managing savings goal balances',
      'Creating a new savings goal with existing savings now uses balance anchors',
      'Savings starting balances now appear in the Cash Flow and Savings charts',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-02-01',
    changes: [
      'Renamed "Check-in" page to "Snapshot" for monthly/quarterly/yearly views',
      'Renamed "Snapshot" page to "Net Worth" for balance overview',
      'Added trend sparkline showing 12 months around current month',
      'Sparkline shows "Now" indicator and shaded future months',
      'Added year grid view to see all months at a glance',
      'Added quarter view to compare 3 months side-by-side',
      'Budget status card now shows spending pace chart',
      'Click any month in sparkline or grid to jump to that month',
    ],
  },
  {
    version: '0.8.3',
    date: '2026-02-01',
    changes: [
      'Money page redesigned with collapsible Past and Expected sections',
      'Section headers now show income, expenses, and savings totals at a glance',
      'Sections start collapsed and remember their open/closed state',
      'Date filters now prevent selecting invalid dates (past for expected, future for past)',
      'Tables show 10 rows per page with pagination',
      'Budget page Income and Savings sections also remember open/closed state',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-02-01',
    changes: [
      'Improved recurring item dialog layout with amount first',
      'Savings contributions no longer need a separate description',
      'Income and savings lists now show frequency in full words',
      'Renamed "Cadence" to "Frequency" throughout the app',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-02-01',
    changes: [
      'Budget table now has sortable columns',
      'Fixed expenses and variable budget use consistent red color scheme',
      'Unallocated income now shows as a blue info card',
      'Budget page shows overcommitted status even with no income set',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-02-01',
    changes: [
      'Simplified expected transactions to only support recurring items',
      'Removed one-off forecast events for a cleaner mental model',
      'Use actual transactions for one-time expenses instead',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-02-01',
    changes: [
      'Redesigned Budget page with new Fixed vs Variable expense model',
      'Fixed expenses (from recurring rules) now show separately from variable budgets',
      'Summary cards show Income, Fixed, Variable, and Savings at a glance',
      'New "Spending" renamed to "Check-in" for clearer purpose',
      'Check-in page shows checkmark for fixed-only categories instead of progress bars',
      'Category table now shows Fixed, Variable, and Total columns',
      'Fixed expenses now require a category to be assigned',
      'Collapsible Income and Savings sections on Budget page',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-02-01',
    changes: [
      'Budget breakdown chart now shows allocation relative to expected income',
      'Switch between weekly, fortnightly, monthly, quarterly, and yearly views',
      'New "Unbudgeted" card shows how much income remains after all budgets',
      'Over-budget indicator shows when spending plans exceed income',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-02-01',
    changes: [
      'Categories and Budget pages combined into a single Budget page',
      'Add categories with optional budget limits in one step',
      'See transaction and expected counts for each category at a glance',
      'Archive, restore, or delete categories directly from the Budget page',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-02-01',
    changes: [
      'New unified "Money" page with Past, Expected, and Recurring tabs',
      'Track actual transactions, expected future items, and recurring expectations in one place',
      'Add expected items (one-time or recurring) from a single dialog',
      'Clearer terminology: "Forecast" is now "Expected" throughout the app',
    ],
  },
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
      'Pre-fills recurring expectation with details from the one-time event',
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
      'Plan future finances with expected transactions',
      'Set and track savings goals',
      'Import transactions from CSV',
      'Export and backup your data',
    ],
  },
];

export const currentVersion = changelog[0]?.version ?? '1.0.0';
