import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full p-8 glass space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-display">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                The application encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-xs font-mono text-left overflow-auto max-h-32 text-destructive border border-destructive/20">
              {this.state.error?.message}
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full gradient-primary shadow-soft"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
