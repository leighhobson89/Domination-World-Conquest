import path from "node:path";
import { defineConfig } from "@playwright/test";

const ROOT = import.meta.dirname;
const REPORT_DIR = process.env.DWC_REPORT_DIR || path.join(ROOT, "test-reports", "runs", "adhoc");
const HEADED = process.env.DWC_HEADED === "1" || process.env.DWC_HEADED === "true";
const SLOW_MO = Number(process.env.DWC_SLOWMO) || 0;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: HEADED ? 1 : Number(process.env.DWC_WORKERS) || 6,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  outputDir: path.join(REPORT_DIR, "artifacts"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(REPORT_DIR, "results.json") }],
    ["html", { outputFolder: path.join(REPORT_DIR, "html"), open: "never" }],
  ],

  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: !HEADED,
    launchOptions: SLOW_MO ? { slowMo: SLOW_MO } : {},
    viewport: { width: 1600, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
