// =====================================================
// ListedAltsSection.jsx — 9. 上場プロキシ・ボード
// =====================================================
//
// プライベート資産 (PE/PD/インフラ/不動産) の温度感を、上場 ETF/関連株の
// バスケットで日次に見える化。1 カードあたり 1 銘柄、軸付きスパークライン + 期間別リターン。
//
// 子要素:
//   ListedAltCard — 1 銘柄カード (内部 helper)
//
// props:
//   alts — listed_alts.json オブジェクト (`assets` 配列, `generatedAt`)
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt, fmtDate, fmtDay } from "@/utils";
import { Pct } from "@/components/common";

const CATEGORY_ORDER = ["Listed PE", "BDC (PD)", "Infra", "US REIT", "J-REIT"];

function ListedAltCard({ row, category }) {
  const data = row.history || [];
  const vals = data.map((d) => d.v);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const pad = (max - min) * 0.10;

  return (
    <div className="mm-alts-card">
      <div className="mm-alts-cat">{category}</div>
      <div className="mm-alts-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mm-alts-name">{row.name}</div>
          <div className="mm-alts-ticker">{row.ticker} · {row.sub}</div>
        </div>
        <div className="mm-alts-close">{fmt(row.close, 2)}</div>
      </div>
      <div className="mm-alts-desc">{row.desc}</div>
      <div className="mm-alts-spark">
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="d"
                tick={{ fontSize: 8.5, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                stroke={PALETTE.dim}
                tickFormatter={(v) => v.slice(5, 7) + "/" + v.slice(2, 4)}
                interval={Math.max(1, Math.floor(data.length / 4))}
                minTickGap={20}
              />
              <YAxis
                orientation="right"
                tick={{ fontSize: 8.5, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                stroke={PALETTE.dim}
                domain={[min - pad, max + pad]}
                tickFormatter={(v) => fmt(v, v > 100 ? 0 : 1)}
                width={32}
                tickCount={4}
              />
              <Tooltip
                contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg, padding: "4px 8px" }}
                labelStyle={{ color: PALETTE.muted }}
                formatter={(v) => [fmt(v, 2), row.ticker]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={PALETTE.accent2}
                strokeWidth={1.6}
                fill={PALETTE.accent2}
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 3, fill: PALETTE.accent2, stroke: PALETTE.panel }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mm-alts-perf">
        {[
          { l: "1D",  v: row.day },
          { l: "1W",  v: row.week },
          { l: "1M",  v: row.month },
          { l: "3M",  v: row.threeM },
          { l: "YTD", v: row.ytd },
        ].map((x, j) => (
          <div key={j} className="mm-alts-perf-cell">
            <div className="mm-alts-perf-label">{x.l}</div>
            <Pct n={x.v} />
          </div>
        ))}
      </div>
      <div className="mm-alts-asof">As of {fmtDay(row.asOf)}</div>
    </div>
  );
}

export function ListedAltsSection({ alts }) {
  if (!alts || !alts.assets || alts.assets.length === 0) return null;

  const byCat = CATEGORY_ORDER
    .map((c) => ({ cat: c, rows: alts.assets.filter((a) => a.category === c) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <div className="mm-section-tag">9. 上場プロキシ・ボード</div>
      <div className="mm-section-head"><em>非上場の鏡像、</em> 日次で値付くオルタナ。</div>
      <div className="mm-section-lede">
        プライベート資産は日次の値段が出ない。<strong>上場 ETF / 関連株のバスケット</strong>を
        日次プロキシとして並べることで、PE / PD / インフラ / 不動産 (米・日) の温度感を一目で読む。
        Alternatives Spotlight (下) の解説と合わせて読むと立体的になる。
        {alts.generatedAt && <>{" "}取得: {fmtDate(alts.generatedAt)}</>}
      </div>

      <div className="mm-alts-grid">
        {byCat.flatMap((g) => g.rows.map((row) => <ListedAltCard key={row.ticker} row={row} category={g.cat} />))}
      </div>
    </div>
  );
}
