import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  FolderTree,
  PiggyBank,
  Layers,
  Wallet,
  Repeat,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function NavItem({ to, icon, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

interface NavSectionProps {
  title?: string;
  children: React.ReactNode;
}

function NavSection({ title, children }: NavSectionProps) {
  return (
    <div className="px-3 py-2">
      {title && (
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      <nav className="flex flex-col gap-1">{children}</nav>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-semibold">Budget</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <NavSection>
          <NavItem to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Overview
          </NavItem>
        </NavSection>

        <Separator className="my-2" />

        <NavSection title="Plan">
          <NavItem to="/forecast" icon={<TrendingUp className="h-4 w-4" />}>
            Forecasts
          </NavItem>
          <NavItem to="/budget" icon={<FolderTree className="h-4 w-4" />}>
            Budgets
          </NavItem>
        </NavSection>

        <Separator className="my-2" />

        <NavSection title="Track">
          <NavItem to="/transactions" icon={<Receipt className="h-4 w-4" />}>
            Transactions
          </NavItem>
          <NavItem to="/categories" icon={<FolderTree className="h-4 w-4" />}>
            Categories
          </NavItem>
          <NavItem to="/savings" icon={<PiggyBank className="h-4 w-4" />}>
            Savings
          </NavItem>
        </NavSection>

        <Separator className="my-2" />

        <NavSection title="Manage">
          <NavItem to="/manage/accounts" icon={<Wallet className="h-4 w-4" />}>
            Bank Accounts
          </NavItem>
          <NavItem to="/manage/scenarios" icon={<Layers className="h-4 w-4" />}>
            Scenarios
          </NavItem>
          <NavItem to="/manage/rules" icon={<Repeat className="h-4 w-4" />}>
            Forecast Rules
          </NavItem>
        </NavSection>
      </div>

      <Separator />

      <NavSection>
        <NavItem to="/settings" icon={<Settings className="h-4 w-4" />}>
          Settings
        </NavItem>
      </NavSection>
    </aside>
  );
}
