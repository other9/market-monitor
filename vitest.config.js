// vitest.config.js — v13.4.1 で導入
//
// React コンポーネントのスナップショットテスト用設定。
// jsdom 環境で testing-library を使う標準構成。
//
// 実行:
//   npm run test           # watch モード
//   npm run test:ci        # 1 回だけ実行 (CI 用)
//   npm run test:ui        # ブラウザ UI で確認 (@vitest/ui)

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    css: false, // CSS の読み込みはスキップ (スナップショットには不要)
  },
});
