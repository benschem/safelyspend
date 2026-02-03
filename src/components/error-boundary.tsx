import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page not found';
      message = "The page you're looking for doesn't exist.";
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  const isDev = import.meta.env.DEV;
  const errorStack = error instanceof Error ? error.stack : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>

      {isDev && errorStack && (
        <div className="mt-8 w-full max-w-4xl text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Error details (dev only)
          </p>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {errorStack}
          </pre>
        </div>
      )}
    </div>
  );
}
