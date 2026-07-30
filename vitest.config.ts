import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: false,
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false,
    reporters: ["default", "./scripts/test-tag-reporter.ts"],
    strictTags: true,
    tags: [{ name: "small" }, { name: "medium" }, { name: "large" }],
    testTimeout: 15_000,
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
