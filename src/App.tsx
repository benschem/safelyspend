import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RootLayout } from '@/components/layout/root-layout';
import { FirstRunWizard } from '@/components/first-run-wizard';
import { ErrorBoundary } from '@/components/error-boundary';

// Route components
import { SnapshotPage } from '@/routes/overview';
import { MoneyIndexPage } from '@/routes/money/index';
import { BudgetPage } from '@/routes/budget';
import { SpendingPage } from '@/routes/spending';
import { TransactionNewPage } from '@/routes/transactions/new';
import { CategoryDetailPage } from '@/routes/categories/detail';
import { CategoryImportRulesPage } from '@/routes/categories/import-rules';
import { SavingsIndexPage } from '@/routes/savings/index';
import { InsightsPage } from '@/routes/insights';
import { ScenariosIndexPage } from '@/routes/scenarios/index';
import { SettingsPage } from '@/routes/settings';
import { ChangelogPage } from '@/routes/changelog';

// Dev-only: style guide and error preview not bundled in production
const devOnlyRoutes = import.meta.env.DEV
  ? [
      { path: 'style-guide', lazy: () => import('@/routes/style-guide').then(m => ({ Component: m.StyleGuidePage })) },
      { path: 'error', lazy: () => import('@/routes/error-preview').then(m => ({ Component: m.ErrorPreviewPage })) },
    ]
  : [];

const router = createBrowserRouter([
  // Landing page (outside of RootLayout - no sidebar/header)
  { path: '/landing', element: <FirstRunWizard />, errorElement: <ErrorBoundary /> },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Redirect root to snapshot
      { index: true, element: <Navigate to="/snapshot" replace /> },

      // Snapshot (current position)
      { path: 'snapshot', element: <SnapshotPage /> },

      // Money In/Out (combined transactions + forecasts + recurring)
      { path: 'money', element: <MoneyIndexPage /> },

      // Legacy redirects
      { path: 'transactions', element: <Navigate to="/money" replace /> },
      { path: 'forecasts', element: <Navigate to="/money?tab=expected" replace /> },
      { path: 'forecasts/recurring', element: <Navigate to="/money?tab=recurring" replace /> },
      { path: 'recurring', element: <Navigate to="/money?tab=recurring" replace /> },

      // Budget - spending limits (plan)
      { path: 'budget', element: <BudgetPage /> },

      // Spending - period view (track)
      { path: 'spending', element: <SpendingPage /> },

      // Transactions new page (still needed for direct navigation)
      { path: 'transactions/new', element: <TransactionNewPage /> },

      // Categories - redirect to budget, keep detail page
      { path: 'categories', element: <Navigate to="/budget" replace /> },
      { path: 'categories/:id', element: <CategoryDetailPage /> },
      { path: 'categories/import-rules', element: <CategoryImportRulesPage /> },

      // Savings (track)
      { path: 'savings', element: <SavingsIndexPage /> },

      // Insights (track)
      { path: 'insights', element: <InsightsPage /> },

      // Scenarios (plan)
      { path: 'scenarios', element: <ScenariosIndexPage /> },


      // Settings
      { path: 'settings', element: <SettingsPage /> },
      { path: 'changelog', element: <ChangelogPage /> },

      // Dev-only routes
      ...devOnlyRoutes,
    ],
  },
]);

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
