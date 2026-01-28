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

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
          Reload page
        </Button>
        <Button asChild>
          <Link to="/overview">
            <Home className="h-4 w-4" />
            Go to overview
          </Link>
        </Button>
      </div>
      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <details className="mt-8 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Error details (development only)
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
