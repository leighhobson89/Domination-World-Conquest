import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only. The Playwright e2e suite lives in tests/e2e and is run by
    // scripts/run-tests.cjs, not by Vitest -- excluded here so `npm run test:unit`
    // does not try to execute .spec.js files written against @playwright/test.
    include: ["tests/unit/**/*.{test,spec}.{js,mjs}"],
    environment: "node",
    globals: false,
    restoreMocks: true,
  },
});
