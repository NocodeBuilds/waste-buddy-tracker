import { useErrorBoundary } from "react-error-boundary";
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fallback UI used when a render error is caught.
function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center gap-3">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        The app hit an unexpected error. Try reloading — if it persists, let your admin know.
      </p>
      {import.meta.env.DEV && (
        <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 max-w-md overflow-auto text-left">
          {error.message}
        </pre>
      )}
      <Button onClick={onReset} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" /> Reload
      </Button>
    </div>
  );
}

// Class-based error boundary — required because react-error-boundary's
// <ErrorBoundary> is a class component internally. We wrap it to provide
// the same API as before (children + fallback prop).
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (import.meta.env.DEV) {
      console.error("App crashed:", error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      if (this.state.error) {
        return <DefaultFallback error={this.state.error} onReset={this.handleReset} />;
      }
    }
    return this.props.children;
  }
}

// Hook version for catching errors in event handlers and async code.
// Usage: const handleError = useErrorBoundary();
export { useErrorBoundary };
