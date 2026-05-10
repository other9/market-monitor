import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";
import { fileURLToPath } from "node:url";

// GitHub Pages (project page) 用に BASE_URL を環境変数で切り替え
//   - 本番:   BASE_URL=/market-monitor/   (例: https://<user>.github.io/market-monitor/)
//   - ローカル: 未設定なら '/' (vite dev)
const base = process.env.BASE_URL || "/";

// v13.1: '@/' を src/ に解決するエイリアスを追加。
// import { fmt } from "@/utils" のように書けるようになる。
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    // data/ ディレクトリを build 時に dist/data/ へコピー
    viteStaticCopy({
      targets: [
        { src: "data/*.json", dest: "data" },
        { src: "data/archive/**/*.json", dest: "data/archive" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
