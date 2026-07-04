import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Aliases for the browser app project only — so node tests keep the real fs/crypto.
const webAlias = {
  "@": r("./src/web-app"),
  "@src": r("./src"),
  "@core": r("./src/core"),
  "@web": r("./src/web"),
  fs: r("./src/web/fs-shim.ts"),
  crypto: r("./src/web/crypto-shim.ts"),
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/cli.ts",
        "src/web/browser-entry.ts",
        "src/web/fs-shim.ts",
        "src/web/crypto-shim.ts",
        "src/core/model.ts",
        "src/storage/s3-storage.ts",
        "src/web-app/components/ui/**",
        "src/web-app/main.tsx",
      ],
      thresholds: { lines: 90, branches: 80 },
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        resolve: { alias: webAlias },
        test: {
          name: "web",
          include: ["src/web-app/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/web-app/test/setup.ts"],
        },
      },
    ],
  },
});
