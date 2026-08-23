import path from "node:path";
import { defineConfig } from "@playwright/test";

const ROOT = import.meta.dirname;

// Where this run's reports are written. `npm run test:e2e` (scripts/run-tests.cjs)
// points this at a timestamped folder under test-reports/runs/ and keeps a rolling
// history; running `npx playwright test` directly falls back to
// test-reports/runs/adhoc so it never overwrites a recorded run.
const REPORT_DIR = process.env.DWC_REPORT_DIR || path.join(ROOT, "test-reports", "runs", "adhoc");

// Headed mode. `--headed` on the CLI also works, but it cannot reach the `workers`
// expression below, so scripts/run-tests.cjs detects it and sets this too.
const HEADED = process.env.DWC_HEADED === "1" || process.env.DWC_HEADED === "true";

// Milliseconds to pause between actions. Only useful with a visible browser -- at 0
// (the default) a headed run is far too fast to follow by eye.
const SLOW_MO = Number(process.env.DWC_SLOWMO) || 0;

export default defineConfig({
  testDir: "./tests/e2e",
  // A turn with 200+ AI countries is not fast, and the first navigation builds the
  // whole territory model.
  timeout: 120_000,
  expect: { timeout: 15_000 },

  // Headed always means ONE browser to watch, never several racing each other.
  //
  // The brief asked for up to 8 headless workers. Measured on this machine, 8 is
  // NOT stable for this suite: at 8 the run drops from 27/28 to 15/28, with pages
  // failing to finish building the territory model before the assertions run. At
  // 4 and at 6 it is clean, and 4 costs only ~10s more than 8 would. Raise it
  // deliberately if the hardware changes:  DWC_WORKERS=8 npm run test:e2e
  workers: HEADED ? 1 : Number(process.env.DWC_WORKERS) || 4,

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

  // Tests run against the production build, so a build regression fails the suite
  // rather than passing in dev and breaking on deploy.
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
