// =====================================================
// FooterSection.jsx — 紙面末尾のフッター
// =====================================================
//
// シンプルな 2 行フッター。バージョン文字列は props で外から差し込めるが、
// 既定値は v13.0 (現状維持) — v13.1 系は内部リファクタなので見た目を変えない。
//
// props:
//   version — 表示するバージョン文字列 (default: "v13.0")
//
// v13.1.2 で MarketMonitor.jsx の inline JSX から切り出し。挙動・見た目は不変。
//

import React from "react";

export function FooterSection({ version = "v13.0" }) {
  return (
    <footer className="mm-footer">
      <div>Market Monitor · 東京版 · {version} · auto-updated 08:00 JST</div>
      <div>Data: yfinance / FRED / Anthropic Claude API</div>
    </footer>
  );
}
