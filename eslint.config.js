import js from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import pluginRouter from "@tanstack/eslint-plugin-router"
import boundaries from "eslint-plugin-boundaries"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

/**
 * Architecture layers (see .claude/frontend-plan.md §4.1).
 * Order matters: the first matching descriptor classifies a file.
 * src/main.tsx and the generated route tree stay unclassified on purpose.
 */
const elements = [
  { type: "app", pattern: "src/app" },
  { type: "routes", pattern: "src/routes" },
  {
    type: "feature-mocks",
    pattern: "src/features/*/mocks",
    capture: ["featureName"],
  },
  { type: "feature", pattern: "src/features/*", capture: ["featureName"] },
  {
    type: "module-mocks",
    pattern: "src/modules/*/mocks",
    capture: ["moduleName"],
  },
  { type: "module", pattern: "src/modules/*", capture: ["moduleName"] },
  { type: "engine", pattern: "src/engine" },
  { type: "components", pattern: "src/components" },
  { type: "hooks", pattern: "src/hooks" },
  { type: "lib", pattern: "src/lib" },
  { type: "locales", pattern: "src/locales" },
  { type: "mocks", pattern: "src/mocks" },
  { type: "test", pattern: "src/test" },
]

const toTypes = (...types) => ({ to: { element: { types: { anyOf: types } } } })
/** Other features/modules may only be imported through their public `index.ts`. */
const toPublicApi = (...types) => ({
  to: {
    element: { types: { anyOf: types }, fileInternalPath: "index.{ts,tsx}" },
  },
})

const policies = [
  {
    from: { element: { type: "app" } },
    allow: toTypes(
      "app",
      "routes",
      "feature",
      "module",
      "engine",
      "components",
      "hooks",
      "lib",
      "locales",
      "mocks"
    ),
  },
  {
    from: { element: { type: "routes" } },
    allow: [
      toTypes("routes", "engine", "components", "hooks", "lib"),
      toPublicApi("feature", "module"),
    ],
  },
  {
    from: { element: { type: "feature" } },
    allow: [
      toTypes("engine", "components", "hooks", "lib"),
      toPublicApi("feature"),
    ],
  },
  {
    from: { element: { type: "feature-mocks" } },
    allow: [
      toTypes("feature-mocks", "mocks", "engine", "lib"),
      toPublicApi("feature"),
      {
        to: {
          element: {
            type: "feature",
            captured: {
              featureName: "{{ from.element.captured.featureName }}",
            },
          },
        },
      },
    ],
  },
  {
    // Seed data and handlers of a module (its "backend" part): never part of
    // the module's public API, so they stay out of the production bundle.
    from: { element: { type: "module-mocks" } },
    allow: [
      toTypes("module-mocks", "mocks", "feature-mocks", "engine", "lib"),
      toPublicApi("feature", "module"),
      {
        to: {
          element: {
            type: "module",
            captured: { moduleName: "{{ from.element.captured.moduleName }}" },
          },
        },
      },
    ],
  },
  {
    from: { element: { type: "module" } },
    allow: [
      toTypes("engine", "components", "hooks", "lib"),
      toPublicApi("feature"),
    ],
  },
  {
    from: { element: { type: "engine" } },
    allow: toTypes("engine", "components", "hooks", "lib"),
  },
  {
    from: { element: { type: "components" } },
    allow: toTypes("components", "hooks", "lib"),
  },
  { from: { element: { type: "hooks" } }, allow: toTypes("hooks", "lib") },
  { from: { element: { type: "lib" } }, allow: toTypes("lib", "locales") },
  {
    from: { element: { type: "mocks" } },
    allow: [
      toTypes(
        "mocks",
        "feature-mocks",
        "module-mocks",
        "engine",
        "components",
        "hooks",
        "lib"
      ),
      toPublicApi("feature", "module"),
    ],
  },
  // Test utilities and test files may import anything.
  {
    from: { element: { type: "test" } },
    allow: { to: { element: { type: "*" } } },
  },
  {
    from: { file: { categories: "test" } },
    allow: { to: { element: { type: "*" } } },
  },
]

export default defineConfig([
  globalIgnores([
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "src/routeTree.gen.ts",
    "public/mockServiceWorker.js",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      pluginQuery.configs["flat/recommended"],
      pluginRouter.configs["flat/recommended"],
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true, project: "./tsconfig.app.json" },
      },
      "boundaries/include": ["src/**/*.{ts,tsx}"],
      "boundaries/elements": elements,
      "boundaries/files": [
        { category: "test", pattern: "**/*.test.{ts,tsx}" },
        { category: "test", pattern: "**/__tests__/**" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Architecture boundary: '{{ from.element.type }}' cannot import '{{ to.element.type }}' here. Import other features/modules only via their index.ts (see .claude/frontend-plan.md §4.1).",
          policies,
        },
      ],
    },
  },
  {
    files: ["*.config.ts", "e2e/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Playwright fixtures call `use()`, which is not a React hook.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
])
