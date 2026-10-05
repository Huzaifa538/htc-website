import { createRequire } from "module";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Required on Next 14 for instrumentation.ts (Sentry server/edge init).
  experimental: {
    instrumentationHook: true,
  },
  // Dynamic llms.txt for AI crawlers — served from API route.
  async rewrites() {
    return [
      {
        source: "/llms.txt",
        destination: "/api/llms-txt",
      },
    ];
  },
};

// Sentry is only wired into the build when a DSN is configured — without
// one the wrapper (and the @sentry/nextjs module itself) is never loaded,
// so builds never depend on monitoring being present. @sentry/nextjs ships
// CommonJS, hence createRequire instead of a static ESM import.
let configWithMonitoring = nextConfig;
if (process.env.SENTRY_DSN) {
  const require = createRequire(import.meta.url);
  const { withSentryConfig } = require("@sentry/nextjs");
  configWithMonitoring = withSentryConfig(nextConfig, {
    // Free tier: error monitoring only, no performance tracing.
    silent: true,
    disableLogger: true,
  });
}

export default configWithMonitoring;
