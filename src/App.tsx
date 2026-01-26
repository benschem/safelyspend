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
import { PeriodsIndexPage } from '@/routes/manage/periods/index';
import { PeriodNewPage } from '@/routes/manage/periods/new';
import { PeriodDetailPage } from '@/routes/manage/periods/detail';
import { AccountsIndexPage } from '@/routes/manage/accounts/index';
import { AccountNewPage } from '@/routes/manage/accounts/new';
import { AccountDetailPage } from '@/routes/manage/accounts/detail';
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

      // Manage - Periods
      { path: 'manage/periods', element: <PeriodsIndexPage /> },
      { path: 'manage/periods/new', element: <PeriodNewPage /> },
      { path: 'manage/periods/:id', element: <PeriodDetailPage /> },

      // Manage - Accounts
      { path: 'manage/accounts', element: <AccountsIndexPage /> },
      { path: 'manage/accounts/new', element: <AccountNewPage /> },
      { path: 'manage/accounts/:id', element: <AccountDetailPage /> },

      // Settings
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
