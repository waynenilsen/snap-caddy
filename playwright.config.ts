import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Snap Caddy E2E tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [["html", { open: "never" }], ["list"]],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:56577",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Take screenshots on failure
    screenshot: "only-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run your local dev server before starting the tests
  // The orchestration script handles this, but this provides a fallback
  webServer: {
    command: "npm run dev",
    url: "http://localhost:56577",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
