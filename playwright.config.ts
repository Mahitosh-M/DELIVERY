import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  globalTimeout: 180000,
  maxFailures: 1,
  use: {
    baseURL: "http://127.0.0.1:4183",
    actionTimeout: 12000,
    reducedMotion: "reduce",
    navigationTimeout: 20000,
    launchOptions: {
      executablePath: existsSync(resolve(".browser/chrome-win/chrome.exe"))
        ? resolve(".browser/chrome-win/chrome.exe")
        : undefined,
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -- --port 4183 --strictPort",
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
