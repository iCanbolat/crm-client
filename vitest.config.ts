import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.ts"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      clearMocks: true,
      restoreMocks: true,
      unstubEnvs: true,
      css: false,
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            include: ["src/**/*.test.{ts,tsx}"],
            setupFiles: ["./src/test/setup.ts"],
            // Multi-step flows (onboarding, settings, quote builder) exceed
            // 15 s under coverage with every test file running in parallel.
            testTimeout: 30_000,
          },
        },
        {
          extends: true,
          test: {
            name: "architecture",
            environment: "node",
            include: ["tests/**/*.test.ts"],
            testTimeout: 30_000,
          },
        },
      ],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.d.ts",
          "src/**/*.test.{ts,tsx}",
          "src/**/__tests__/**",
          "src/components/ui/**",
          "src/routeTree.gen.ts",
          "src/main.tsx",
          "src/test/**",
          "src/mocks/browser.ts",
          "src/mocks/enable-mocking.ts",
        ],
        thresholds: {
          "src/lib/**": { lines: 90, functions: 90, statements: 90 },
          "src/engine/**": { lines: 90, functions: 90, statements: 90 },
          "src/features/**": { lines: 75, functions: 75, statements: 75 },
          "src/modules/**": { lines: 85, functions: 85, statements: 85 },
        },
      },
    },
  })
)
