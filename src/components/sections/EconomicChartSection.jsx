// =====================================================
// EconomicChartSection.jsx — Economic Indicator (日替わり FRED)
// =====================================================
//
// 日替わりの経済指標 1 本を 5〜10 年の時系列で表示する大判チャート。
// data/economic.json の `chart` オブジェクトを受け取って描く。
//
// props:
//   econ — economic.json オブジェクト (`chart` プロパティを持つ想定)
//
// v13.1.2 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt, fmtSigned, tone } from "@/utils";

export function EconomicChartSection({ econ }) {
  if (!econ || !econ.chart || !econ.chart.history || econ.chart.history.length === 0) return null;
  const c = econ.chart;

  const MAX_POINTS = 400;
  const stride = Math.max(1, Math.floor(c.history.length / MAX_POINTS));
  const sampled = c.history.length > MAX_POINTS
    ? c.history.filter((_, i) => i % stride === 0 || i === c.history.length - 1)
    : c.history;

  const vals = sampled.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08;

  const tickFormat = (v) => {
    const p = v.split("-");
    return p.length >= 2 ? `${p[0].slice(2)}/${p[1]}` : v;
  };

  return (
    <div className="mm-econ-wrap">
      <div className="mm-econ-kicker">▲ Economic Indicator · 今日の経済指標</div>
      <div className="mm-econ-title">{c.title}</div>
      <div className="mm-econ-subtitle">
        {c.subtitle || c.units} · {c.frequency} · FRED: {c.series_id}
      </div>
      {c.rationale && <div className="mm-econ-rationale">{c.rationale}</div>}

      <div className="mm-econ-last">
        <span className="mm-econ-last-val">{fmt(c.last, 3)}</span>
        {c.diff != null && (
          <span className="mm-econ-last-diff" style={{ color: tone(c.diff) }}>
            {fmtSigned(c.diff, 3)} (前回比)
          </span>
        )}
      </div>

      <div style={{ height: 240, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sampled} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              tickFormatter={tickFormat}
              interval={Math.max(1, Math.floor(sampled.length / 8))}
            />
            <YAxis
              tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              domain={[min - pad, max + pad]}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg }}
              labelStyle={{ color: PALETTE.muted }}
              formatter={(v) => [fmt(v, 3), c.title]}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={PALETTE.accent2}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: PALETTE.accent2, stroke: PALETTE.panel }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mm-econ-meta">
        期間 {c.period_years}年 · 取得 {c.asOf} · {c.official_title || "FRED"}
      </div>
    </div>
  );
}
