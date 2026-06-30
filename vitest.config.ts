import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli.ts", // entrypoint (process.exit + argv parse); covered by test/integration/cli.test.ts as a subprocess
        "src/web/browser-entry.ts", // browser-only bundle entry
        "src/web/fs-shim.ts", // browser-only (esbuild --alias)
        "src/web/crypto-shim.ts", // browser-only (esbuild --alias)
        "src/core/model.ts", // pure type declarations (no executable code)
        "src/storage/s3-storage.ts", // network I/O; S3 integration tests require MinIO (skipped)
      ],
      thresholds: { lines: 90, branches: 80 },
    },
  },
});
