import { MobileNav } from './sidebar';

export function Header() {
  return (
    <header className="flex h-14 items-center border-b border-border bg-background px-4 md:hidden">
      <MobileNav />
    </header>
  );
}
