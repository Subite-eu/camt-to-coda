import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/web/**", "src/core/model.ts", "src/storage/s3-storage.ts"],
      thresholds: { lines: 80, branches: 75 },
    },
  },
});
