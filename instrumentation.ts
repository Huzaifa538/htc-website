/**
 * Next.js instrumentation hook: registers Sentry for the Node.js and
 * Edge runtimes. Requires `experimental.instrumentationHook: true` in
 * next.config.mjs (Next 14). Each config no-ops when SENTRY_DSN is unset.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
