/**
 * Sentry server-side (Node.js runtime) error monitoring.
 *
 * Loaded via instrumentation.ts. No-op when SENTRY_DSN is unset so the
 * build and runtime never depend on monitoring being configured.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Free tier: errors only — no performance tracing.
    tracesSampleRate: 0,
    debug: false,
  });
}
