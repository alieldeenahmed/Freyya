import { defineConfig, devices } from "@playwright/test";

// A short check of a deployed site, read-only: nothing here places an order or changes data.
// Unlike the main suite it starts no servers and touches no database, so it is safe to point at
// the live demo.
//
//   LIVE_URL=https://freyya.vercel.app npm run test:live
//
// To also test signing in to the admin, set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD.
const baseURL = (process.env.LIVE_URL ?? "https://freyya.vercel.app").replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // A site that has been quiet can need a few seconds to wake its API and database.
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "live",
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "chrome" as const }) },
    },
  ],
});
