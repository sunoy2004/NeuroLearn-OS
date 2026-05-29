import React from "react";
import { Brain, AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { useAppStore } from "@/store/appStore";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

/**
 * Global ErrorBoundary — catches render errors in any route component
 * and displays a styled recovery screen instead of a blank white page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 gap-6">
          {/* Error Icon */}
          <div className="relative">
            <div className="size-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="size-10 text-destructive" />
            </div>
            <div className="absolute -top-1 -right-1 size-6 rounded-full bg-destructive/20 flex items-center justify-center">
              <Brain className="size-3.5 text-destructive" />
            </div>
          </div>

          {/* Error Message */}
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A rendering error occurred in this workspace module. 
              The NeuroLearn cognitive engine is still running — you can recover by 
              navigating to another page or reloading this module.
            </p>
            {this.state.error && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50 text-left">
                <p className="text-[11px] font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
          </div>

          {/* Recovery Actions */}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                // Navigate to dashboard via store
                try {
                  useAppStore.getState().setPage("dashboard");
                } catch {
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                bg-muted text-foreground border border-border/50 hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="size-3.5" />
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
