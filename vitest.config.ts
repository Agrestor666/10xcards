// Standalone Vitest config (not Astro getViteConfig): getViteConfig pulls in the
// Cloudflare adapter and fails with resolve.external incompatibility. Revisit when
// tests need astro:env, React islands, or other Astro/Vite plugins.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
