import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "resources/**",
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
        CANNON: "readonly",
        THREE: "readonly",
        BufferGeometryUtils: "readonly",
      },
    },
    rules: {
      "no-shadow": "error",
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

      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": "warn",
    },
  },

  {
    files: [
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "tests/run-e2e.mjs",
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

  prettier,
];
