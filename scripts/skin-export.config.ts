import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/export-skin-soft.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

