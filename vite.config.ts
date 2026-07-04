import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: "src/web-app",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./src/web-app"),
      "@src": r("./src"),
      "@core": r("./src/core"),
      "@web": r("./src/web"),
      // Reuse the existing browser shims so the in-browser core has no Node deps.
      fs: r("./src/web/fs-shim.ts"),
      crypto: r("./src/web/crypto-shim.ts"),
    },
  },
  build: { outDir: "../../dist-web", emptyOutDir: true },
});
