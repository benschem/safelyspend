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
    version: '0.53.4',
    date: '2026-10-14',
    changes: [
      'Fixed the savings charts in Insights starting too high for a date range that ends in the past',
    ],
  },
  {
    version: '0.53.3',
    date: '2026-10-13',
    changes: [
      'Fixed Net Wealth leaving out savings balances you entered, so its savings now match the Savings page',
      'Fixed Net Wealth dropping after you deleted a savings goal that began with an entered balance',
    ],
  },
  {
    version: '0.53.2',
    date: '2026-10-13',
    changes: [
      'A transfer to savings on the same day as a savings balance you entered now counts towards that goal',
      'A transfer to savings dated in the future no longer counts towards a goal until its date arrives',
    ],
  },
  {
    version: '0.53.1',
    date: '2026-10-13',
    changes: [
      'Fixed the cash estimate in the check-in, shown when no cash balance has been set, leaving out money moved to savings',
    ],
  },
  {
    version: '0.53.0',
    date: '2026-10-13',
    changes: [
      'What If is now called Scenarios in the sidebar and on its page',
      'The Scenarios page now explains how to try an idea: copy a scenario, switch to it and change it on the Budget page',
    ],
  },
  {
    version: '0.52.1',
    date: '2026-10-13',
    changes: [
      'The category now comes last when you add or edit an expense',
      'The note saying how much room is left in your budget now sits under the amount, and says whether it is per week, month or year',
      'Fixed that note disappearing when an expense was set to zero, which made an overcommitted budget look fine',
    ],
  },
  {
    version: '0.52.0',
    date: '2026-10-13',
    changes: [
      'Income, expenses and savings on the Budget page are now tabs, each showing its total',
      'One Add button beside the tabs adds to whichever tab you are on',
    ],
  },
  {
    version: '0.51.0',
    date: '2026-10-13',
    changes: [
      'A scenario no longer shows purple differences from your current plan. Each page shows the figures for the scenario you have selected',
      'The purple header still tells you when you are looking at a scenario other than your current plan',
    ],
  },
  {
    version: '0.50.0',
    date: '2026-10-13',
    changes: [
      'Removed the sliders from the Budget page. Income, expenses and savings are now plain rows, and an amount changes only when you edit it',
      'Each expense category on the Budget page now has its own card, with the category name and total as its heading',
    ],
  },
  {
    version: '0.49.1',
    date: '2026-10-13',
    changes: [
      'Fixed new transactions, balances and check-ins defaulting to yesterday when added in the morning',
      'Fixed the spending pace chart leaving out today and showing days against the wrong date in October',
      'Fixed the year view on Cash Flow counting one day too many',
      'Fixed imported dates written in words, such as 15 Jan 2026, landing a day early',
      'An import now skips a row whose date does not exist, such as 31 February, and tells you which row',
    ],
  },
  {
    version: '0.49.0',
    date: '2026-10-13',
    changes: [
      'Bills and spending allowances are now listed together as Expenses on the Budget page, grouped by category with a total for each',
      'One Add Expense form covers both: turn on "Due on a set date" for a bill, or leave it off for an allowance',
      'An expense can gain or lose its due date when you edit it',
    ],
  },
  {
    version: '0.48.0',
    date: '2026-10-13',
    changes: [
      'A category can now have several allowances, each with its own name, amount and frequency, such as lashes every fortnight and nails every month',
      'Items you had split an allowance into are now allowances of their own, with the same amounts',
    ],
  },
  {
    version: '0.47.1',
    date: '2026-10-13',
    changes: [
      'Choosing a category on an iPad or phone no longer brings up the keyboard over the list',
    ],
  },
  {
    version: '0.47.0',
    date: '2026-10-13',
    changes: [
      'An allowance can now be split into named items, such as lashes and nails under one category, and the items add up to the allowance',
    ],
  },
  {
    version: '0.46.2',
    date: '2026-10-13',
    changes: [
      'Removed the "Add to allowance" button on transactions. Allowances are now set in one place, on the Budget page',
    ],
  },
  {
    version: '0.46.1',
    date: '2026-10-13',
    changes: [
      'Allowances no longer ask for a day or month, which never changed how an allowance was counted',
    ],
  },
  {
    version: '0.46.0',
    date: '2026-10-13',
    changes: [
      'Allowances on the Budget page now show what you have spent on average in that category, so you can tell whether an allowance is realistic',
    ],
  },
  {
    version: '0.45.0',
    date: '2026-10-13',
    changes: [
      'The Cash card on Cash Flow now shows how much of your month end balance should be set aside for quarterly and yearly bills that are not due yet',
      'Click that line to see each bill, how much is set aside for it and when it is next due',
    ],
  },
  {
    version: '0.44.7',
    date: '2026-10-13',
    changes: [
      'Paying a bill a few days early no longer makes Cash Flow think you are overspending for the rest of the month',
      'A bill that is overdue and not yet paid no longer hides your day-to-day spending on Cash Flow',
      'The Bills line under "Now" on Cash Flow shows what you have actually paid, not what was due',
    ],
  },
  {
    version: '0.44.6',
    date: '2026-10-13',
    changes: [
      'A quarterly or yearly bill now counts in full in the month it is due on Cash Flow, the category page and Insights, where before it was spread thinly across every month',
      'A weekly or fortnightly bill now counts each payment that actually falls in the month',
      "The chart on a category's page now shows each month's own limit",
    ],
  },
  {
    version: '0.44.5',
    date: '2026-10-13',
    changes: [
      'Interest earned on a savings goal is no longer counted as money you plan to set aside on Cash Flow and in the check-in, so the planned and projected month end no longer read too low',
    ],
  },
  {
    version: '0.44.4',
    date: '2026-10-13',
    changes: [
      'Fixed income on the Budget page reading too high in some months when you are paid weekly or fortnightly',
      'Interest earned on a savings goal is no longer counted as savings you set aside on the Budget page',
    ],
  },
  {
    version: '0.44.3',
    date: '2026-10-13',
    changes: ['Made the page you are on easier to pick out in the sidebar in light mode'],
  },
  {
    version: '0.44.2',
    date: '2026-10-12',
    changes: [
      'Fixed the popup for adding or editing income, a bill or savings briefly changing its title and fields as it closed',
    ],
  },
  {
    version: '0.44.1',
    date: '2026-10-12',
    changes: [
      'The planned day-to-day spending on Cash Flow now adds up to exactly what its category rows show',
      'Trying a change in What If now moves each category on Cash Flow and its category page, where before only the totals moved',
    ],
  },
  {
    version: '0.44.0',
    date: '2026-10-12',
    changes: [
      'Fixed Expenses are now called Bills, and budgets for a category are now called Spending Allowances',
    ],
  },
  {
    version: '0.43.4',
    date: '2026-10-12',
    changes: [
      "A category's budget now counts its fixed expenses everywhere, so the category page and Insights agree with Cash Flow",
    ],
  },
  {
    version: '0.43.3',
    date: '2026-10-12',
    changes: [
      'Fixed popups being hidden behind the on-screen keyboard on iPad and iPhone, and made tall popups scroll',
    ],
  },
  {
    version: '0.43.2',
    date: '2026-10-12',
    changes: [
      'Fixed an error page that could appear when moving between pages after the app had been updated while you had it open',
    ],
  },
  {
    version: '0.43.1',
    date: '2026-10-12',
    changes: [
      'Renaming a category to a name another category already has is now refused, where before it left you with two of the same name',
    ],
  },
  {
    version: '0.43.0',
    date: '2026-10-12',
    changes: [
      'Added a Categories page in the sidebar that lists every category with what uses it, where you can rename, archive or delete them',
      'The back button on a category now returns you to the page you came from, where before it always went to Budget',
    ],
  },
  {
    version: '0.42.4',
    date: '2026-10-12',
    changes: [
      'Fixed expenses on the cash flow page now show how much has been paid, such as "Paid $0 of $2,000", in place of a confusing "0% of budget"',
      'The bar beside a fixed expense now fills as it is paid, where before it always looked fully paid',
    ],
  },
  {
    version: '0.42.3',
    date: '2026-10-11',
    changes: [
      'Adding a fixed expense no longer creates a matching budget, which counted the expense twice in your plan',
    ],
  },
  {
    version: '0.42.2',
    date: '2026-10-11',
    changes: [
      'Adding or editing a budget now lets you search your existing categories, or type a new one',
      'Categories that already have a budget are left out of that list, so one cannot be replaced by accident',
      'Fixed adding a budget creating a second category with the same name',
    ],
  },
  {
    version: '0.42.1',
    date: '2026-10-11',
    changes: [
      'Fixed importing bank CSV files, which could fail with "No valid CSV files selected"',
      'Importing from Up Bank now tells apart matching transactions made in different accounts',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-10-10',
    changes: [
      'You can now invite one other person to share your budget, from Settings',
      'They get an emailed link to create their own account, and you approve them by checking a short safety number together',
      'Form fields now have a clearer outline',
      'The privacy page now explains how sharing works and what is stored when you invite someone',
    ],
  },
  {
    version: '0.41.0',
    date: '2026-09-16',
    changes: [
      'Forgotten your password? You can now use your twelve-word recovery phrase to set a new one',
      'Your recovery phrase keeps working afterwards, so you can use it again if you need to',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-09-15',
    changes: [
      'Setting up cloud sync now creates your account in one go: confirm your email, choose a password, save a recovery phrase, and your budget is uploaded straight away',
      'Your recovery phrase lets you back into your budget if you ever forget your password',
      'You can sign in from the setup screen to bring an existing budget onto a new device',
    ],
  },
  {
    version: '0.39.1',
    date: '2026-09-14',
    changes: ['Updated internal components to their latest supported versions'],
  },
  {
    version: '0.39.0',
    date: '2026-09-05',
    changes: [
      'Fixed signing in sending you back to the welcome page instead of into the app',
      'Signing in on a new device now offers to restore your synced budget',
      'The SafelySpend name in the top bar takes you back to the welcome page',
    ],
  },
  {
    version: '0.38.0',
    date: '2026-09-05',
    changes: [
      'Added a privacy page explaining what stays on your device and what does not',
      'Started counting visits to the welcome page. Nothing you do inside the app is measured',
    ],
  },
  {
    version: '0.37.1',
    date: '2026-05-22',
    changes: ['Fixed an issue that prevented the login email from sending on the Cloud Sync page'],
  },
  {
    version: '0.37.0',
    date: '2026-02-15',
    changes: [
      'Cloud sync lets you back up and restore your data across devices with end-to-end encryption',
      'Set a passphrase to protect your synced data. Only you can read it',
      'View and manage your active login sessions from Settings',
      'Revoke individual sessions or log out of all other devices at once',
      'Improved reliability and performance of the sync backend',
    ],
  },
  {
    version: '0.36.0',
    date: '2026-02-07',
    changes: [
      'New unified header bar with scenario selector always visible at the top of the app',
      'Net Wealth card headers now display inline with icons for a cleaner look',
      'Wealth percentile comparison now includes a tooltip explaining the data source',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-02-07',
    changes: [
      'Cash flow cards now show the right value for each period: actual for past months, projected for current, and planned for future',
      'Current month shows an "ahead" or "behind" indicator comparing your projected pace to your plan',
      'Cash flow breakdown table headers show your scenario name and columns are reordered for clarity',
      'You can now view future months on the cash flow page to preview your plan',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-02-07',
    changes: [
      'Dollar amounts that differ from your default plan now turn purple, making it easy to see what changed when comparing scenarios or using what-if adjustments',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-02-06',
    changes: [
      'Cash flow breakdown now color-codes expenses in red and savings in blue for easier scanning',
      'Added a "Savings growth" summary row to highlight how much you\'re building in savings each month',
    ],
  },
  {
    version: '0.32.2',
    date: '2026-02-06',
    changes: [
      'Wizards and import dialogs now load on demand for faster initial page loads',
      'Demo data and landing page are no longer included in the main app bundle',
    ],
  },
  {
    version: '0.32.1',
    date: '2026-02-06',
    changes: [
      'Pages now load faster with route-based code splitting',
      'Improved browser caching by splitting vendor dependencies into separate files',
      'Added page description for better search engine results',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-02-06',
    changes: [
      'Redesigned landing page with interactive budget sliders and product previews',
      'Fixed iOS Safari zoom issue when tapping on form fields',
      'Improved mobile layout for tables and breakdown views',
      'Deleting a category now properly handles linked transactions and budget rules',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-02-05',
    changes: [
      'Setup wizard now includes a transactions step where you can import CSV files, Up Bank exports, or add transactions manually',
      'Categories created during setup are now deduplicated with imported transaction categories',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-02-05',
    changes: [
      'New Check-in Wizard guides you through importing transactions, confirming savings, and verifying your cash balance',
      'Choose a check-in frequency (weekly, fortnightly, monthly, or quarterly) to get reminders in the sidebar',
      'Savings step lets you record contributions and withdrawals, then confirm balances for each goal',
      'Summary step shows your financial snapshot: cash balance, savings progress, budget status, and top spending',
      'Check-in preferences section added to Settings page',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-02-05',
    changes: [
      'Added a Budget/Income toggle to the spending breakdown on the cash flow page',
      'Spending bars now show proportions relative to total income when the Income view is selected',
      'Consistent labelling across all categories and savings: budget/planned amount next to the name, spent/saved amount with percentage on the right',
    ],
  },
  {
    version: '0.28.2',
    date: '2026-02-05',
    changes: [
      'Cash flow breakdown values now link to the relevant budget section or settings page for quick editing',
    ],
  },
  {
    version: '0.28.1',
    date: '2026-02-05',
    changes: [
      'Reorganized sidebar navigation into clearer sections: Overview, Plan, Track, and Analyse',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-02-05',
    changes: [
      'Cash Flow page now shows a summary card with large, scannable end-of-month projections',
      'Summary and breakdown cards sit side by side on larger screens',
      'Current month shows your cash balance right now separately from projections',
      'Pace comparison highlights when you are spending faster or slower than planned',
      'Current month breakdown shows Planned and Current columns for easy comparison',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-02-05',
    changes: [
      'Cash Flow page redesigned with a ledger view showing your month as a stacked equation',
      'Compare Budget Plan vs Current Pace side-by-side to see the impact of your spending',
      'Past months show Planned vs Actual columns for easy retrospective',
      'Mobile view switches between columns with tabs',
      'Burn rate chart now appears as its own section below the ledger',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-02-05',
    changes: [
      'Smarter spending pace projection that accounts for fixed expenses separately from variable spending',
      'Redesigned Cash Flow page with combined hero card and inline burn rate chart',
      'Burn rate chart now shows budget, surplus, and danger zones visually',
      'Improved spending status messages with more nuanced feedback',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-02-04',
    changes: [
      'Warnings appear when creating a transaction or forecast that looks like a duplicate',
      'Deleting transactions, categories, and forecast rules now shows an undo option for 5 seconds',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-02-04',
    changes: [
      'Schedule future interest rate changes on savings goals',
      'Interest forecasts, completion estimates, and annual interest reflect scheduled rate changes',
      'Savings goal dialog shows target amount and deadline side-by-side',
      'Simplified contribution and withdrawal forms with amount-first layout',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-02-04',
    changes: [
      'Redesigned savings page with a prominent total saved hero section',
      'Savings page now loads much faster',
      'Savings goal cards show target date and expected completion date with distinct icons',
      'Reached goals display a green progress bar and the date they were reached',
      'Separate buttons for contributing to and withdrawing from savings goals',
      'Deleting a savings goal now returns remaining funds to your cash balance',
      'Clear confirmation dialog when deleting a savings goal explains what will happen',
      'Category spending rows on the budget page now link to detailed category breakdowns',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-02-04',
    changes: [
      'Press Enter to submit any form dialog instead of clicking the button',
      'Dialogs now focus the primary input automatically when opened',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-02-04',
    changes: [
      'Adding a recurring expense now automatically creates or increases the budget for that category',
      'Edit and delete buttons on all plan items (income, fixed expenses, budgets, and savings)',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-02-04',
    changes: [
      'Renamed Overview tab to Pulse with a new Activity icon',
      'Redesigned Pulse tab with inline amounts, source counts, and % of income on summary cards',
      'Fixed expenses card now shows due-to-date progress based on actual recurring dates',
      'Spending section includes fixed expenses and savings contributions with progress bars',
      'Spending pace for past months now reads "Spent $X under/over budget"',
      'Scenario comparison text uses natural phrasing like "$200 more than current plan"',
      'History icon used consistently for all history-related sections',
      'Simplified income breakdown chart heading style',
      'Day-of-month selectors now allow days 29–31 in all budget and category dialogs',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-02-04',
    changes: [
      "After changing a transaction's category, you can now apply it to all matching transactions at once",
      'Optionally create an import rule for future imports when bulk-applying categories',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-02-04',
    changes: [
      'Import transactions from any bank using generic CSV import',
      'Map CSV columns to date, description, and amount fields',
      'Preview and categorise transactions before importing',
      'Skip individual transactions or assign categories inline during import',
      'Choose between single amount column or separate debit/credit columns',
      'Auto-detects common column names and date formats',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-02-04',
    changes: [
      'Simplified the Budget Overview to always show the month view',
      'Redesigned Overview with a larger surplus display and cleaner card layout',
      'Fixed date calculations that could show incorrect values near midnight',
      'Improved accuracy of budget charts for fortnightly, quarterly, and yearly budgets',
      'Updated historical data colors for better visual clarity',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-02-04',
    changes: [
      'Budget and Snapshot merged into a single Budget page with three tabs',
      'Overview tab shows your monthly spending tracker (formerly Snapshot)',
      'Plan tab lets you set up income, expenses, budgets, and savings',
      'History tab shows your transaction history with filters and averages',
      'Simplified navigation: Budget, Insights, and What If in one section',
    ],
  },
  {
    version: '0.15.7',
    date: '2026-02-04',
    changes: [
      'Improved accessibility for custom budget amount input',
      'Fixed various minor stability issues',
    ],
  },
  {
    version: '0.15.6',
    date: '2026-02-04',
    changes: [
      'What-If page redesigned with cleaner scenario cards',
      'Current Plan card shows amber/orange theme when active with "Planning" badge',
      'Alternative scenarios show purple theme when active with "Imagining" badge',
      'Forecasts and budgets counts now link to the Budget page sliders',
    ],
  },
  {
    version: '0.15.5',
    date: '2026-02-04',
    changes: [
      'Sliders now compare against Current Plan when viewing alternative scenarios',
      'Delta indicators show difference from plan (e.g., "spending $50 less from plan")',
      'Save button updates the current scenario with your adjustments (with confirmation)',
      'Save as New button creates a new scenario from your adjustments',
    ],
  },
  {
    version: '0.15.4',
    date: '2026-02-04',
    changes: [
      'Income breakdown shows delta inline: "How your $5,379 (+$645) income is allocated"',
      'What-If page now shows impact comparison when viewing any non-default scenario',
    ],
  },
  {
    version: '0.15.3',
    date: '2026-02-04',
    changes: [
      'Insights page graphs and tabs show purple indicator when exploring scenarios',
      'Budget page breakdown chart shows purple border and scenario indicator',
      'What-If page: Edit button added to Current Plan card',
      'What-If page: Star button on scenarios lets you make any scenario your Current Plan',
    ],
  },
  {
    version: '0.15.2',
    date: '2026-02-04',
    changes: [
      'Income breakdown chart legend shows deltas for each category when exploring scenarios',
      'Spending pace and category sections show purple border with scenario name indicator',
      'Clearer "Based on [scenario]" or "Based on your adjustments" text in Snapshot',
    ],
  },
  {
    version: '0.15.1',
    date: '2026-02-04',
    changes: [
      'Budget page cards and hero section show deltas from Current Plan',
      'Slider section headers show inline comparison with your Current Plan',
      'Deltas now appear when making What-If adjustments, even on your Current Plan',
      'Snapshot page cards, spending pace, and category progress show plan deltas',
      'Purple delta indicators (e.g., "+$100/mo from plan") appear where values differ',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-02-04',
    changes: [
      'What-If page now shows Current Plan as a separate card at the top',
      'Values that differ from your Current Plan now appear in purple',
      'Scenario banner turns purple when you make adjustments or explore alternatives',
      'Cleaner, more neutral default theme',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-02-03',
    changes: [
      'Renamed Scenarios page to "What If" for clearer purpose',
      'Scenario selector now appears in a banner on all pages',
      'Banner shows Reset and Save buttons when you have unsaved adjustments',
      'Option to save adjustments as a new scenario when switching scenarios',
      'New scenarios are now called "Current Plan" by default',
      'Purple theme applied site-wide when exploring non-default scenarios',
      'Collapse the banner to the sidebar using the X button',
    ],
  },
  {
    version: '0.13.2',
    date: '2026-02-02',
    changes: [
      'Improved What-If slider feedback with descriptive text like "spending $50 less (+28%) per month"',
      'Slider adjustments now show percentage change alongside dollar amounts',
      'Finer slider increments for more precise adjustments on smaller budgets',
      'Click on any slider amount to enter a custom value beyond slider limits',
      'Income sliders now allow adjusting down to $0',
      'Expense adjustments show green when spending less, red when spending more',
      'Savings adjustments always show in blue',
      'Reset button on adjusted sliders to quickly restore original value',
    ],
  },
  {
    version: '0.13.1',
    date: '2026-02-02',
    changes: [
      'What-If adjustments now update the Budget page cards, chart, and all other pages in real-time',
      'Sliders show a baseline marker indicating the original value when adjusted',
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
    changes: ['Spending pace chart now shows Expected Pace line in green for better visibility'],
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
    changes: ['Fixed tables jumping back to page 1 after editing items'],
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
