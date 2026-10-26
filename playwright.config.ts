import { defineConfig } from "@playwright/test";

/**
 * Visual regression tests of the SFZ design layer (R3.4, ADR 0019). They run against a production
 * build (`npm run build` first) with ENABLE_DEV_PAGES=1, so /dev/ukazky exists. Baseline screenshots
 * are generated on Linux in CI (fonts differ on macOS); local runs only create missing ones.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  updateSnapshots: process.env.CI ? "none" : "missing",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  use: { baseURL: `http://127.0.0.1:${PORT}`, browserName: "chromium" },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    // CI has no database, so wait for the showcase (needs none) rather than the health check
    url: `http://127.0.0.1:${PORT}/dev/ukazky`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ENABLE_DEV_PAGES: "1" },
  },
});
