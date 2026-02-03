import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { changelog, currentVersion } from '@/lib/changelog';

export function ChangelogPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">
          <div className="page-title-icon bg-slate-500/10">
            <Sparkles className="h-5 w-5 text-slate-500" />
          </div>
          What&apos;s New
        </h1>
        <p className="page-description">See what&apos;s changed in each version of the app.</p>
      </div>

      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, index) => (
          <div key={entry.version} className="panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Version {entry.version}</h2>
              {index === 0 && (
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  Current
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {new Date(entry.date).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {entry.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        Currently running version {currentVersion}
      </div>
    </div>
  );
}
