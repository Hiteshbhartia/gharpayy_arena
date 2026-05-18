// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Static SPA for Vercel — client bundle + prerendered index.html (no Worker/SSR deploy).
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: {
        outputPath: "/index",
        crawlLinks: false,
        retryCount: 2,
        failOnError: true,
      },
    },
    prerender: {
      enabled: true,
      failOnError: true,
    },
  },
});
