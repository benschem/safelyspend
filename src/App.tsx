import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { RootLayout } from '@/components/layout/root-layout';

// Route components
import { DashboardPage } from '@/routes/dashboard';
import { ForecastIndexPage } from '@/routes/forecast/index';
import { ForecastNewPage } from '@/routes/forecast/new';
import { ForecastDetailPage } from '@/routes/forecast/detail';
import { BudgetPage } from '@/routes/budget';
import { TransactionsIndexPage } from '@/routes/transactions/index';
import { TransactionNewPage } from '@/routes/transactions/new';
import { TransactionDetailPage } from '@/routes/transactions/detail';
import { CategoriesIndexPage } from '@/routes/categories/index';
import { CategoryNewPage } from '@/routes/categories/new';
import { CategoryDetailPage } from '@/routes/categories/detail';
import { SavingsIndexPage } from '@/routes/savings/index';
import { SavingsNewPage } from '@/routes/savings/new';
import { SavingsDetailPage } from '@/routes/savings/detail';
import { ScenariosIndexPage } from '@/routes/manage/scenarios/index';
import { ScenarioNewPage } from '@/routes/manage/scenarios/new';
import { ScenarioDetailPage } from '@/routes/manage/scenarios/detail';
import { RulesIndexPage } from '@/routes/manage/rules/index';
import { RuleNewPage } from '@/routes/manage/rules/new';
import { RuleDetailPage } from '@/routes/manage/rules/detail';
import { SettingsPage } from '@/routes/settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Redirect root to dashboard
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Dashboard
      { path: 'dashboard', element: <DashboardPage /> },

      // Forecast (plan)
      { path: 'forecast', element: <ForecastIndexPage /> },
      { path: 'forecast/new', element: <ForecastNewPage /> },
      { path: 'forecast/:id', element: <ForecastDetailPage /> },

      // Budget (plan)
      { path: 'budget', element: <BudgetPage /> },

      // Transactions (track)
      { path: 'transactions', element: <TransactionsIndexPage /> },
      { path: 'transactions/new', element: <TransactionNewPage /> },
      { path: 'transactions/:id', element: <TransactionDetailPage /> },

      // Categories (track)
      { path: 'categories', element: <CategoriesIndexPage /> },
      { path: 'categories/new', element: <CategoryNewPage /> },
      { path: 'categories/:id', element: <CategoryDetailPage /> },

      // Savings (track)
      { path: 'savings', element: <SavingsIndexPage /> },
      { path: 'savings/new', element: <SavingsNewPage /> },
      { path: 'savings/:id', element: <SavingsDetailPage /> },

      // Manage - Scenarios
      { path: 'manage/scenarios', element: <ScenariosIndexPage /> },
      { path: 'manage/scenarios/new', element: <ScenarioNewPage /> },
      { path: 'manage/scenarios/:id', element: <ScenarioDetailPage /> },

      // Manage - Forecast Rules
      { path: 'manage/rules', element: <RulesIndexPage /> },
      { path: 'manage/rules/new', element: <RuleNewPage /> },
      { path: 'manage/rules/:id', element: <RuleDetailPage /> },

      // Settings
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
