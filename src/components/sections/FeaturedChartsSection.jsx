// =====================================================
// FeaturedChartsSection.jsx — 1. 本日の注目チャート
// =====================================================
//
// Claude が動的に選定した3本のチャートを1年日次データで表示。
//
// 子要素:
//   FeaturedChart — 1枚のチャートカード (内部 helper)
//
// props:
//   featured — featured.json オブジェクト (`featured` 配列を持つ想定)
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt } from "@/utils";
import { Pct } from "@/components/common";

function FeaturedChart({ pick }) {
  const data = pick.history || [];
  if (data.length === 0) {
    return (
      <div className="mm-featured-card">
        <div className="mm-featured-title">{pick.title}</div>
        <div style={{ padding: "40px 0", textAlign: "center", color: PALETTE.muted, fontFamily: FONT_MONO, fontSize: 12 }}>
          データ取得失敗
        </div>
      </div>
    );
  }
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08;
  const last = pick.last;
  const pct = pick.pct1y;

  return (
    <div className="mm-featured-card">
      <div className="mm-featured-head">
        <div className="mm-featured-title">{pick.title}</div>
        <div className="mm-featured-sub">{pick.name} · {pick.sub} · 1Y Daily</div>
      </div>
      <div style={{ height: 180, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              tickFormatter={(v) => v.slice(5, 7) + "/" + v.slice(8, 10)}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              domain={[min - pad, max + pad]}
              tickFormatter={(v) => v > 10000 ?
                `${(v / 1000).toFixed(0)}k` : fmt(v, 1)}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg }}
              labelStyle={{ color: PALETTE.muted }}
              formatter={(v) => [fmt(v, 2), pick.title]}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={PALETTE.accent}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: PALETTE.accent, stroke: PALETTE.panel }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mm-featured-last">
        <span>現在値 <strong>{fmt(last, 2)}</strong></span>
        <Pct n={pct} big />
      </div>
      {pick.rationale && <div className="mm-featured-rationale">{pick.rationale}</div>}
    </div>
  );
}

export function FeaturedChartsSection({ featured }) {
  if (!featured?.featured || featured.featured.length === 0) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div className="mm-section-tag">1. 本日の注目チャート</div>
      <div className="mm-section-head"><em>Claude AI が選ぶ、</em> 今日見るべき3本。</div>
      <div className="mm-section-lede">
        直近のニュース文脈から、今日のマーケットを理解するうえで押さえておくべきチャートを AI が選定。1年日次データで最近の動きを細かく表示。
      </div>
      <div className="mm-featured-grid">
        {featured.featured.map((p, i) => <FeaturedChart key={i} pick={p} />)}
      </div>
    </div>
  );
}
