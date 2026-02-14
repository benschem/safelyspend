import { Link } from 'react-router';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import type { AuthUser } from '@/lib/api-client';

interface SyncStatusProps {
  user: AuthUser | null;
  syncStatus: 'idle' | 'pushing' | 'pulling';
  lastSyncedAt: string | null;
  onNavigate?: (() => void) | undefined;
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  return `${diffDay}d ago`;
}

export function SyncStatus({ user, syncStatus, lastSyncedAt, onNavigate }: SyncStatusProps) {
  if (!user) return null;

  const isSyncing = syncStatus !== 'idle';

  let icon: React.ReactNode;
  let label: string;

  if (isSyncing) {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    label = 'Syncing...';
  } else if (lastSyncedAt) {
    icon = <Cloud className="h-3.5 w-3.5" />;
    label = `Synced ${formatRelativeTime(lastSyncedAt)}`;
  } else {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = 'Not synced';
  }

  return (
    <Link
      to="/settings"
      onClick={onNavigate}
      className="flex items-center gap-2 px-6 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
