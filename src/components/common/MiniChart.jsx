// =====================================================
// MiniChart — 5Y 日次チャートを描画する汎用コンポーネント
// =====================================================
//
// v13.1 で MarketMonitor.jsx から切り出し。
// IV 章「重要指標・5年チャート」で複数並べて使う。
//
// props:
//   title      — チャート上部の主題 (例 "日経平均")
//   sub        — 副題 (例 "Nikkei 225 · 東証")
//   data       — [{ d: "YYYY-MM-DD", v: number }, ...]
//   current    — 現在値の数値 (右上に表示)
//   decimals   — current/Y軸の小数桁
//   unit       — current の後ろに付ける単位 (例 "%", "bp")
//   highlight  — X 軸上に縦線を引きたい日付 (任意、地政学イベント等のマーカー用)
//   freqLabel  — チャート右上に表示する頻度ラベル (例 "5Y Daily")
//

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { fmt } from "@/utils";
import { PALETTE, FONT_MONO } from "@/theme";

export function MiniChart({ title, sub, data, current, decimals = 2, unit = "", highlight, freqLabel }) {
  if (!data || data.length === 0) {
    return (
      <div className="mm-chart-card">
        <div className="mm-chart-head">
          <div>
            <div className="mm-chart-title">{title}</div>
            <div className="mm-chart-sub">{sub}</div>
          </div>
        </div>
        <div style={{
          padding: "30px 0",
          textAlign: "center",
          color: PALETTE.muted,
          fontFamily: FONT_MONO,
          fontSize: 12,
        }}>
          データ取得失敗
        </div>
      </div>
    );
  }

  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08;

  return (
    <div className="mm-chart-card">
      <div className="mm-chart-head">
        <div>
          <div className="mm-chart-title">{title}</div>
          <div className="mm-chart-sub">{sub}</div>
        </div>
        <div>
          <div className="mm-chart-cur">{fmt(current, decimals)}{unit}</div>
          {freqLabel && <div className="mm-chart-range">{freqLabel}</div>}
        </div>
      </div>
      <div style={{ height: 130, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              tickFormatter={(v) => v.length >= 7 ? v.slice(2, 7) : v}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              domain={[min - pad, max + pad]}
              tickFormatter={(v) => v > 10000
                ? `${(v / 1000).toFixed(0)}k`
                : fmt(v, decimals === 0 ? 0 : 1)}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: PALETTE.panel,
                border: `1px solid ${PALETTE.borderStrong}`,
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: PALETTE.fg,
              }}
              labelStyle={{ color: PALETTE.muted }}
              formatter={(v) => [`${unit}${fmt(v, decimals)}`, title]}
            />
            {highlight && (
              <ReferenceLine
                x={highlight}
                stroke={PALETTE.accent}
                strokeDasharray="3 3"
                strokeWidth={1}
                ifOverflow="visible"
                label={{
                  value: "イラン紛争",
                  position: "top",
                  fill: PALETTE.accent,
                  fontSize: 9,
                  fontFamily: FONT_MONO,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="v"
              stroke={PALETTE.accent}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3, fill: PALETTE.accent, stroke: PALETTE.panel }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
