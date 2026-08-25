import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      // Pre-built webpack UMD bundles for three/cannon/buffer-utils. Vendor code.
      "dist/**",
      // Game assets, plus one vendored library (SVGPathData.cjs). Not our source.
      "resources/**",
      // lz-string, copied in byte-for-byte so the browser can load it without a
      // bundler (Phase 7.3). Not our source, and linting it would only report the
      // upstream author's style.
      "src/platform/vendor/**",
      "test-reports/**",
      "playwright-report/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Set as window globals by the UMD bundles in dist/, loaded as classic
        // scripts from index.html before any module runs. dices.js uses both at
        // module-evaluation time.
        CANNON: "readonly",
        THREE: "readonly",
        BufferGeometryUtils: "readonly",
      },
    },
    rules: {
      // --- Correctness. These catch real defects; see docs/01-codebase-audit.md.
      //
      // no-shadow catches audit 5.2-I (an inner `for (let i ...)` shadowing the
      // outer loop index, so the wrong territory gets written) and 5.2-M (a local
      // `let updatedProbability` shadowing the module binding it meant to read).
      "no-shadow": "error",
      // Catches audit 5.1-H: `for (country of turnGainsArrayAi)` with no
      // declaration keyword.
      "no-undef": "error",
      "no-fallthrough": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-self-assign": "error",
      "no-unsafe-negation": "error",
      "no-unreachable": "error",
      "no-constant-binary-expression": "error",
      "no-implicit-globals": "error",
      "valid-typeof": "error",

      // --- Hygiene. Warnings so the errors above stay legible in the output.
      // These are expected to be noisy against the pre-refactor codebase; the
      // baseline count is recorded in docs/03-refactor-plan.md Phase 0.
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": "warn",
    },
  },

  // Node-side tooling: config files, scripts, and (later) the Playwright runner.
  {
    files: [
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "scripts/**",
      "tools/**",
      "app.js",
      "webpack-*.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-implicit-globals": "off",
    },
  },

  {
    files: ["app.js", "webpack-*.config.js", "**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },

  // Must stay last: turns off every rule that would fight Prettier.
  prettier,
];
