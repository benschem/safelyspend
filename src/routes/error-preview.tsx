import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/**
 * Dev-only page to preview the error boundary UI inside the app layout.
 */
export function ErrorPreviewPage() {
  const errorStack = `Error: Something went wrong
    at SomeComponent (src/components/SomeComponent.tsx:42:15)
    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)
    at mountIndeterminateComponent (node_modules/react-dom/cjs/react-dom.development.js:17811:13)
    at beginWork (node_modules/react-dom/cjs/react-dom.development.js:19049:16)
    at HTMLUnknownElement.callCallback (node_modules/react-dom/cjs/react-dom.development.js:3945:14)`;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            This page encountered an error. You can try reloading or navigate elsewhere.
          </p>
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

        <div className="mt-8 w-full text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Error details (dev only)
          </p>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {errorStack}
          </pre>
        </div>
      </div>
    </div>
  );
}
