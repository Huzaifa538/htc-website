"use client";

/**
 * ErrorBoundary — per-section React error boundary.
 *
 * Wrap one major page section each (shop, product detail, checkout, admin
 * content) so a crash in one area shows a friendly fallback instead of
 * whitescreening the whole page. Caught errors are reported to Sentry
 * (a no-op when Sentry isn't configured) and logged to the console.
 */
import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  /** Human label for logs/Sentry, e.g. "Checkout". */
  section: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry.captureException is a safe no-op when Sentry has no DSN.
    Sentry.captureException(error, {
      extra: {
        section: this.props.section,
        componentStack: info.componentStack,
      },
    });
    console.error(`[ErrorBoundary:${this.props.section}]`, error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
            <TriangleAlert size={28} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This part of the page hit an unexpected error. Your data is safe —
            try again, or come back in a bit.
          </p>
          <Button
            onClick={this.handleRetry}
            className="mt-6 rounded-full bg-[#D21F26] px-8 font-bold hover:bg-[#a8161c]"
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
