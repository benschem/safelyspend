import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RootLayout } from '@/components/layout/root-layout';
import { FirstRunWizard } from '@/components/first-run-wizard';
import { ErrorBoundary } from '@/components/error-boundary';

// Route components
import { SnapshotPage } from '@/routes/overview';
import { ForecastIndexPage } from '@/routes/forecasts/index';
import { RecurringIndexPage } from '@/routes/forecasts/recurring/index';
import { BudgetPage } from '@/routes/budget';
import { SpendingPage } from '@/routes/spending';
import { TransactionsIndexPage } from '@/routes/transactions/index';
import { TransactionNewPage } from '@/routes/transactions/new';
import { CategoriesIndexPage } from '@/routes/categories/index';
import { CategoryDetailPage } from '@/routes/categories/detail';
import { CategoryImportRulesPage } from '@/routes/categories/import-rules';
import { SavingsIndexPage } from '@/routes/savings/index';
import { InsightsPage } from '@/routes/insights';
import { ScenariosIndexPage } from '@/routes/scenarios/index';
import { SettingsPage } from '@/routes/settings';

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

      // Forecasts (plan)
      { path: 'forecasts', element: <ForecastIndexPage /> },
      { path: 'forecasts/recurring', element: <RecurringIndexPage /> },

      // Budget - spending limits (plan)
      { path: 'budget', element: <BudgetPage /> },

      // Spending - period view (track)
      { path: 'spending', element: <SpendingPage /> },

      // Transactions (track)
      { path: 'transactions', element: <TransactionsIndexPage /> },
      { path: 'transactions/new', element: <TransactionNewPage /> },

      // Categories (track)
      { path: 'categories', element: <CategoriesIndexPage /> },
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
