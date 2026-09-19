import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  // Next.js compiles JSX itself, so tsconfig says "preserve". Tests need it transformed.
  esbuild: { jsx: "automatic" },
  test: {
    // Logic tests run in Node. Component tests opt in to jsdom with a
    // "// @vitest-environment jsdom" comment at the top of the file.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
