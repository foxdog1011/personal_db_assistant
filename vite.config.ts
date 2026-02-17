import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ✅ Vite 設定
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // 不要加 "./"
    },
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  base: "./", // ✅ 為了 Electron 正確載入本地資源
  build: {
    outDir: "dist", // 預設可改，但需與 Electron 打包一致
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
