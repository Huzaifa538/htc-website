/**
 * Sentry client-side error monitoring (free tier).
 *
 * No-op when no DSN is configured: the build and runtime must never fail
 * just because monitoring is absent. Set NEXT_PUBLIC_SENTRY_DSN (same
 * value as SENTRY_DSN) to enable browser error reporting.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Free tier: errors only — no performance tracing or session replay.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    debug: false,
  });
}
