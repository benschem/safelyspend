import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { RootLayout } from '@/components/layout/root-layout';
import { ErrorBoundary } from '@/components/error-boundary';

// Dev-only: style guide and error preview not bundled in production
const devOnlyRoutes = import.meta.env.DEV
  ? [
      {
        path: 'style-guide',
        lazy: () => import('@/routes/style-guide').then((m) => ({ Component: m.StyleGuidePage })),
      },
      {
        path: 'error',
        lazy: () =>
          import('@/routes/error-preview').then((m) => ({ Component: m.ErrorPreviewPage })),
      },
    ]
  : [];

const router = createBrowserRouter([
  // Landing page (outside of RootLayout - no sidebar/header)
  {
    path: '/landing',
    lazy: () =>
      import('@/components/first-run-wizard').then((m) => ({ Component: m.FirstRunWizard })),
    errorElement: <ErrorBoundary />,
  },
  // Check-in wizard (outside of RootLayout - full screen)
  {
    path: '/check-in',
    lazy: () =>
      import('@/components/check-in-wizard').then((m) => ({ Component: m.CheckInWizard })),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Redirect root to cash flow
      { index: true, element: <Navigate to="/cash-flow" replace /> },

      // Cash Flow (monthly overview)
      {
        path: 'cash-flow',
        lazy: () =>
          import('@/routes/cash-flow/index').then((m) => ({ Component: m.CashFlowPage })),
      },

      // Budget (plan tab only)
      {
        path: 'budget',
        lazy: () => import('@/routes/budget').then((m) => ({ Component: m.BudgetPage })),
      },

      // Transactions (standalone page)
      {
        path: 'transactions',
        lazy: () =>
          import('@/routes/transactions/index').then((m) => ({ Component: m.TransactionsPage })),
      },

      // Net Wealth (balances overview)
      {
        path: 'net-wealth',
        lazy: () => import('@/routes/net-wealth').then((m) => ({ Component: m.NetWealthPage })),
      },

      // Legacy redirects
      { path: 'snapshot', element: <Navigate to="/cash-flow" replace /> },
      // check-in route now lives outside RootLayout
      { path: 'spending', element: <Navigate to="/cash-flow" replace /> },
      { path: 'money', element: <Navigate to="/transactions" replace /> },
      { path: 'net-worth', element: <Navigate to="/net-wealth" replace /> },
      { path: 'forecasts', element: <Navigate to="/budget?tab=plan" replace /> },
      {
        path: 'forecasts/recurring',
        element: <Navigate to="/budget?tab=plan" replace />,
      },
      { path: 'recurring', element: <Navigate to="/budget?tab=plan" replace /> },

      // Transactions new page (still needed for direct navigation)
      {
        path: 'transactions/new',
        lazy: () =>
          import('@/routes/transactions/new').then((m) => ({ Component: m.TransactionNewPage })),
      },

      // Categories - redirect to budget, keep detail page
      { path: 'categories', element: <Navigate to="/budget" replace /> },
      {
        path: 'categories/:id',
        lazy: () =>
          import('@/routes/categories/detail').then((m) => ({ Component: m.CategoryDetailPage })),
      },
      {
        path: 'categories/import-rules',
        lazy: () =>
          import('@/routes/categories/import-rules').then((m) => ({
            Component: m.CategoryImportRulesPage,
          })),
      },

      // Savings (track)
      {
        path: 'savings',
        lazy: () =>
          import('@/routes/savings/index').then((m) => ({ Component: m.SavingsIndexPage })),
      },

      // Insights (track)
      {
        path: 'insights',
        lazy: () => import('@/routes/insights').then((m) => ({ Component: m.InsightsPage })),
      },

      // Scenarios (plan)
      {
        path: 'scenarios',
        lazy: () =>
          import('@/routes/scenarios/index').then((m) => ({ Component: m.ScenariosIndexPage })),
      },

      // Settings
      {
        path: 'settings',
        lazy: () => import('@/routes/settings').then((m) => ({ Component: m.SettingsPage })),
      },
      {
        path: 'changelog',
        lazy: () => import('@/routes/changelog').then((m) => ({ Component: m.ChangelogPage })),
      },

      // Dev-only routes
      ...devOnlyRoutes,
    ],
  },
]);

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  );
}
