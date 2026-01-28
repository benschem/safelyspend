import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { RootLayout } from '@/components/layout/root-layout';
import { FirstRunWizard } from '@/components/first-run-wizard';
import { ErrorBoundary } from '@/components/error-boundary';

// Route components
import { DashboardPage } from '@/routes/dashboard';
import { ForecastIndexPage } from '@/routes/forecasts/index';
import { ForecastNewPage } from '@/routes/forecasts/new';
import { ForecastDetailPage } from '@/routes/forecasts/detail';
import { RecurringIndexPage } from '@/routes/forecasts/recurring/index';
import { RecurringNewPage } from '@/routes/forecasts/recurring/new';
import { RecurringDetailPage } from '@/routes/forecasts/recurring/detail';
import { BudgetPage } from '@/routes/budget';
import { TransactionsIndexPage } from '@/routes/transactions/index';
import { TransactionNewPage } from '@/routes/transactions/new';
import { TransactionDetailPage } from '@/routes/transactions/detail';
import { CategoriesIndexPage } from '@/routes/categories/index';
import { SavingsIndexPage } from '@/routes/savings/index';
import { SavingsNewPage } from '@/routes/savings/new';
import { SavingsDetailPage } from '@/routes/savings/detail';
import { ReportsPage } from '@/routes/reports';
import { ScenariosIndexPage } from '@/routes/manage/scenarios/index';
import { ScenarioNewPage } from '@/routes/manage/scenarios/new';
import { ScenarioDetailPage } from '@/routes/manage/scenarios/detail';
import { SettingsPage } from '@/routes/settings';
import { CategoryRulesPage } from '@/routes/settings/category-rules';

const router = createBrowserRouter([
  // Landing page (outside of RootLayout - no sidebar/header)
  { path: '/landing', element: <FirstRunWizard />, errorElement: <ErrorBoundary /> },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Redirect root to dashboard
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Dashboard
      { path: 'dashboard', element: <DashboardPage /> },

      // Forecasts (plan)
      { path: 'forecasts', element: <ForecastIndexPage /> },
      { path: 'forecasts/new', element: <ForecastNewPage /> },
      { path: 'forecasts/:id', element: <ForecastDetailPage /> },
      { path: 'forecasts/recurring', element: <RecurringIndexPage /> },
      { path: 'forecasts/recurring/new', element: <RecurringNewPage /> },
      { path: 'forecasts/recurring/:id', element: <RecurringDetailPage /> },

      // Budget (plan)
      { path: 'budget', element: <BudgetPage /> },

      // Transactions (track)
      { path: 'transactions', element: <TransactionsIndexPage /> },
      { path: 'transactions/new', element: <TransactionNewPage /> },
      { path: 'transactions/:id', element: <TransactionDetailPage /> },

      // Categories (track)
      { path: 'categories', element: <CategoriesIndexPage /> },

      // Savings (track)
      { path: 'savings', element: <SavingsIndexPage /> },
      { path: 'savings/new', element: <SavingsNewPage /> },
      { path: 'savings/:id', element: <SavingsDetailPage /> },

      // Reports (track)
      { path: 'reports', element: <ReportsPage /> },

      // Manage - Scenarios
      { path: 'manage/scenarios', element: <ScenariosIndexPage /> },
      { path: 'manage/scenarios/new', element: <ScenarioNewPage /> },
      { path: 'manage/scenarios/:id', element: <ScenarioDetailPage /> },


      // Settings
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/category-rules', element: <CategoryRulesPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
