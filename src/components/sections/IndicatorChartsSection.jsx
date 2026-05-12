// =====================================================
// IndicatorChartsSection.jsx — 7. 重要指標・5年チャート
// =====================================================
//
// 6 つの主要指標 (日経/S&P/USD/JPY/米10年/WTI/金) の月末値推移を MiniChart で並べる。
// 2026年2月末 (米・イラン紛争開始点) に橙破線を入れる。
//
// props:
//   market — market.json オブジェクト (`history` プロパティを持つ想定)
//
// v13.1.3 で MarketMonitor.jsx の inline JSX から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE } from "@/theme";
import { MiniChart, SectionHeader} from "@/components/common";

const HIGHLIGHT_DATE = "2026-02-27"; // 米・イラン紛争開始点

const CHARTS = [
  // [title, sub, historyKey, decimals, unit?]
  ["日経平均",      "¥ · JPY",     "nikkei", 0, undefined],
  ["S&P 500",       "INDEX · USD", "sp500",  0, undefined],
  ["USD/JPY",       "ドル円",       "usdjpy", 1, undefined],
  ["米10年債利回り", "%",           "us10y",  2, undefined],
  ["WTI原油",       "$ / bbl",     "wti",    0, "$"],
  ["金 (COMEX)",    "$ / oz",      "gold",   0, "$"],
];

export function IndicatorChartsSection({ market }) {
  const h = market?.history || {};

  // 2 列ずつ並べる (デザイン上の制約: mm-chart-grid は 1 行 2 枚想定)
  const rows = [];
  for (let i = 0; i < CHARTS.length; i += 2) {
    rows.push(CHARTS.slice(i, i + 2));
  }

  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <SectionHeader>7. 重要指標・5年チャート</SectionHeader>
      <div className="mm-section-head"><em>俯瞰で見る、</em> 5年の地殻変動。</div>
      <div className="mm-section-lede">
        主要指標の月末値推移。<span style={{ color: PALETTE.accent, fontWeight: 600 }}>● 橙破線</span>
        は2026年2月末の米・イラン紛争開始点。
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="mm-chart-grid">
          {row.map(([title, sub, key, decimals, unit]) => (
            <MiniChart
              key={key}
              title={title}
              sub={sub}
              data={h[key]}
              current={h[key]?.at(-1)?.v}
              decimals={decimals}
              unit={unit}
              highlight={HIGHLIGHT_DATE}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
