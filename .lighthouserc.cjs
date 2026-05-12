// .lighthouserc.cjs — Lighthouse CI 設定 (v13.5 で導入)
//
// CI ワークフロー内で Vite ビルド成果物 (dist/) に対して
// パフォーマンス / アクセシビリティ / ベストプラクティス / SEO をスコア化する。
//
// 方針:
//   - 厳格な enforce はせず、まず可視化のみ
//   - performance / accessibility / best-practices / seo の 4 カテゴリすべて 0.5 以上を warn
//   - 段階的に閾値を上げる予定 (v13.5 着地後の状態を見て決める)
//
// 参考: https://github.com/GoogleChrome/lighthouse-ci

module.exports = {
  ci: {
    collect: {
      // Vite preview (vite preview --port 4173) で dist/ をサーブ
      startServerCommand: "npm run preview -- --port 4173",
      url: ["http://localhost:4173/market-monitor/"],
      numberOfRuns: 1,
      settings: {
        // CI 環境では throttling の差で結果が揺らぐので preset を固定
        preset: "desktop",
      },
    },
    assert: {
      // 個人プロジェクトとしての現実的な warning 閾値
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.85 }],
      },
    },
    upload: {
      // free な Lighthouse CI server (temporary public storage、kk が見られればよい)
      target: "temporary-public-storage",
    },
  },
};
