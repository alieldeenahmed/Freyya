import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/env";

// Locally, the test database's address comes from Backend/.env.test.
try {
  process.loadEnvFile("../Backend/.env.test");
} catch {
  // Already set by the environment, as in CI.
}

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. The end-to-end tests need a throwaway Postgres database " +
      "(see Backend/README.md, Tests)."
  );
}

const CI = Boolean(process.env.CI);
// Use the Chrome that is already installed unless running in CI, where Chromium is installed for it.
const browser = CI ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./e2e",
  // Every test shares one database, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E.webUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...browser },
      testIgnore: /responsive\.spec/,
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        ...browser,
        viewport: { width: 375, height: 812 },
      },
      testMatch: /responsive\.spec/,
    },
  ],
  webServer: [
    {
      // The API, against the throwaway database. It deliberately does not read Backend/.env.
      command: "npx tsx src/server.ts",
      cwd: "../Backend",
      url: `${E2E.apiUrl}/health`,
      reuseExistingServer: !CI,
      timeout: 90_000,
      env: {
        ...(process.env as Record<string, string>),
        NODE_ENV: "test",
        PORT: "4010",
        DATABASE_URL: databaseUrl,
        CORS_ORIGINS: E2E.webUrl,
        ADMIN_EMAIL: E2E.adminEmail,
        ADMIN_PASSWORD_HASH: E2E.adminPasswordHash,
        RATE_LIMIT: "false",
      },
    },
    {
      // The storefront, from a production build made by e2e/run.mjs (or the CI workflow).
      command: "npx next start -p 3010",
      url: E2E.webUrl,
      reuseExistingServer: !CI,
      timeout: 90_000,
      env: {
        ...(process.env as Record<string, string>),
        API_URL: E2E.apiUrl,
      },
    },
  ],
});
