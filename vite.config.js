import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// GitHub Pages (project page) 用に BASE_URL を環境変数で切り替え
//   - 本番:   BASE_URL=/market-monitor/   (例: https://<user>.github.io/market-monitor/)
//   - ローカル: 未設定なら '/' (vite dev)
const base = process.env.BASE_URL || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    // data/ ディレクトリを build 時に dist/data/ へコピー
    viteStaticCopy({
      targets: [
        { src: "data/*.json", dest: "data" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
