import { Loader2 } from 'lucide-react';

/**
 * Page-level loading indicator shown while data is being fetched.
 * Displays a centered spinner to indicate loading without layout shift.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
    </div>
  );
}
