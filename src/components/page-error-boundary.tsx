import { Component, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { debug } from '@/lib/debug';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debug.error('ui', 'Page error caught by boundary', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
  }

  override render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const errorStack = this.state.error?.stack;

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
              <Button
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Reload
              </Button>
              <Button asChild onClick={() => this.setState({ hasError: false, error: null })}>
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </Button>
            </div>

            {isDev && errorStack && (
              <div className="mt-8 w-full text-left">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Error details (dev only)
                </p>
                <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
                  {errorStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
