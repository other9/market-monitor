// =====================================================
// SectorHeatmapSection.jsx — 米セクター・ヒートマップ (Section 2 のサブ)
// =====================================================
//
// SPDR セクター ETF の 1日/1週/1ヶ月/年初来リターンをヒートマップ表示。
// タブで期間切替 (useState で内部状態管理)。
//
// props:
//   sectors — market.sectors (XLF/XLK/...) の配列
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React, { useState } from "react";
import { PALETTE } from "@/theme";
import { fmtPct } from "@/utils";
import { GroupHeader } from "@/components/common";

const PERIOD_TABS = [
  { k: "day",   l: "1日" },
  { k: "week",  l: "1週" },
  { k: "month", l: "1ヶ月" },
  { k: "ytd",   l: "年初来" },
];

const PERIOD_CAP = { day: 3, week: 5, month: 10, ytd: 30 };

export function SectorHeatmapSection({ sectors }) {
  const [period, setPeriod] = useState("day");

  if (!sectors || sectors.length === 0) return null;

  const colorFor = (v) => {
    if (v == null) return PALETTE.bg;
    const cap = PERIOD_CAP[period];
    const t = Math.max(-1, Math.min(1, v / cap));
    if (t > 0) {
      const a = Math.abs(t);
      return `rgba(45, 106, 79, ${0.18 + a * 0.7})`;
    } else if (t < 0) {
      const a = Math.abs(t);
      return `rgba(192, 57, 43, ${0.18 + a * 0.7})`;
    }
    return PALETTE.bg;
  };

  const textFor = (v) => {
    if (v == null) return PALETTE.muted;
    const cap = PERIOD_CAP[period];
    const t = Math.max(-1, Math.min(1, v / cap));
    return Math.abs(t) > 0.55 ? "#FFF" : PALETTE.fg;
  };

  return (
    <div style={{ marginTop: 28 }}>
      <GroupHeader title="米セクター・ヒートマップ" marker="▽ SPDR Sectors" />
      <div className="mm-heatmap-wrap">
        <div className="mm-heatmap-head">
          <div className="mm-heatmap-title">米セクター・ヒートマップ</div>
          <div className="mm-heatmap-legend">SPDRセクターETF · {sectors[0]?.asOf || "—"}</div>
        </div>
        <div className="mm-heatmap-tabs">
          {PERIOD_TABS.map((x) => (
            <div
              key={x.k}
              className={`mm-heatmap-tab ${period === x.k ? "active" : ""}`}
              onClick={() => setPeriod(x.k)}
            >
              {x.l}
            </div>
          ))}
        </div>
        <div className="mm-heatmap-grid">
          {sectors.map((s, i) => {
            const v = s[period];
            return (
              <div
                key={i}
                className="mm-heatmap-cell"
                style={{ background: colorFor(v), color: textFor(v) }}
                title={`${s.name} (${s.ticker}): ${fmtPct(v)}`}
              >
                <span className="mm-heatmap-cell-name">{s.short}</span>
                <span className="mm-heatmap-cell-val">{fmtPct(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
