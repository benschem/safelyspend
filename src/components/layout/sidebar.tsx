import { NavLink, useLocation } from 'react-router';
import {
  Camera,
  Telescope,
  Receipt,
  Target,
  Tags,
  PiggyBank,
  Layers,
  Settings,
  ChartSpline,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useEffect, useState } from 'react';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: (() => void) | undefined;
  end?: boolean;
}

function NavItem({ to, icon, children, onClick, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      onClick={onClick}
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

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <NavSection>
        <NavItem to="/snapshot" icon={<Camera className="h-4 w-4" />} onClick={onNavigate}>
          Snapshot
        </NavItem>
        <NavItem to="/insights" icon={<ChartSpline className="h-4 w-4" />} onClick={onNavigate}>
          Insights
        </NavItem>
      </NavSection>

      <Separator className="my-2" />

      <NavSection title="Monitor">
        <NavItem to="/spending" icon={<Receipt className="h-4 w-4" />} onClick={onNavigate}>
          Spending
        </NavItem>
        <NavItem to="/savings" icon={<PiggyBank className="h-4 w-4" />} onClick={onNavigate}>
          Savings
        </NavItem>
      </NavSection>

      <Separator className="my-2" />

      <NavSection title="Plan">
        <NavItem to="/budget" icon={<Target className="h-4 w-4" />} onClick={onNavigate}>
          Budget
        </NavItem>
        <NavItem to="/scenarios" icon={<Layers className="h-4 w-4" />} onClick={onNavigate}>
          Scenarios
        </NavItem>
      </NavSection>

      <Separator className="my-2" />

      <NavSection title="Track">
        <NavItem to="/transactions" icon={<Receipt className="h-4 w-4" />} onClick={onNavigate}>
          Transactions
        </NavItem>
        <NavItem to="/forecasts" icon={<Telescope className="h-4 w-4" />} onClick={onNavigate}>
          Forecasts
        </NavItem>
      </NavSection>

      <Separator className="my-2" />

      <NavSection title="Manage">
        <NavItem to="/categories" icon={<Tags className="h-4 w-4" />} onClick={onNavigate}>
          Categories
        </NavItem>
      </NavSection>

      <div className="flex-1" />

      <Separator />

      <NavSection>
        <NavItem to="/settings" icon={<Settings className="h-4 w-4" />} onClick={onNavigate}>
          Settings
        </NavItem>
      </NavSection>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-semibold">SafelySpend</span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-2">
        <SidebarNav />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close sheet when route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>SafelySpend</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col overflow-y-auto py-2">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
