import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import "./MarketMonitor.css";

// v13.1.1 で切り出した共通モジュール
import { PALETTE, FONT_MONO, CHART_UNIVERSE_LABELS } from "@/theme";
import { fmt, fmtPct, fmtSigned, tone, fmtDate, fmtDay, safe } from "@/utils";
import { Pct, Signed, MiniChart, StaleDataWarning } from "@/components/common";

// =====================================================
// MARKET MONITOR — v13.1.1
//   • v12: Section numbering, Stale Data warning, Funding & Volatility, Listed Alts
//   • v13.1.0: theme/utils/common を別ファイル化 (新ファイル新設のみ)
//   • v13.1.1: 上記モジュールから import するよう書き換え (このファイル)
// =====================================================

// ─────────────────────────────────────────
// URL constants
// ─────────────────────────────────────────
const BASE = import.meta.env.BASE_URL || "/";
const MARKET_URL     = `${BASE}data/market.json`;
const NEWS_URL       = `${BASE}data/news.json`;
const MACRO_URL      = `${BASE}data/macro.json`;
const FEATURED_URL   = `${BASE}data/featured.json`;
const ECONOMIC_URL   = `${BASE}data/economic.json`;
const VALUATIONS_URL = `${BASE}data/valuations.json`;
const CB_URL         = `${BASE}data/central_banks.json`;
const ALTS_URL       = `${BASE}data/listed_alts.json`;

// ─────────────────────────────────────────
// Featured 1Y daily big chart
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Indices group (株式・為替・金利・コモディティ・ボラ)
// ─────────────────────────────────────────
function IndicesGroup({ title, rows }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="mm-group-head">
        <div className="mm-group-title">{title}</div>
        <div className="mm-group-marker">▽ Section</div>
      </div>
      <div className="mm-table">
        <div className="mm-table-row mm-table-header">
          <div className="cell">Instrument</div>
          <div className="cell r">Close</div>
          <div className="cell r">1D</div>
          <div className="cell r">1W</div>
          <div className="cell r">1M</div>
          <div className="cell r">6M</div>
          <div className="cell r">As of</div>
        </div>
        {rows.map((r, i) => {
          const priceDecimals = r.isYield ? 3 : r.close > 1000 ? 2 : 4;
          return (
            <div
              key={i}
              className="mm-table-row"
              style={{ background: i % 2 === 0 ? PALETTE.panel : PALETTE.bg }}
            >
              <div className="cell">
                <div style={{ fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: PALETTE.muted }}>{r.sub}</div>
              </div>
              <div className="cell r" style={{ fontFamily: FONT_MONO }}>
                {fmt(r.close, priceDecimals)}{r.unit || ""}
              </div>
              <div className="cell r"><Pct n={r.day} /></div>
              <div className="cell r"><Pct n={r.week} /></div>
              <div className="cell r"><Pct n={r.month} /></div>
              <div className="cell r"><Pct n={r.sixM} /></div>
              <div className="cell r" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PALETTE.muted }}>
                {fmtDay(r.asOf)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Mobile cards */}
      <div className="mm-cards">
        {rows.map((r, i) => {
          const priceDecimals = r.isYield ? 3 : r.close > 1000 ? 2 : 4;
          return (
            <div key={i} className="mm-card">
              <div className="mm-card-head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mm-card-name">{r.name}</div>
                  <div className="mm-card-sub">{r.sub}</div>
                  <div className="mm-card-asof">As of {fmtDay(r.asOf)}</div>
                </div>
                <div className="mm-card-close">{fmt(r.close, priceDecimals)}{r.unit || ""}</div>
              </div>
              <div className="mm-card-grid">
                {[
                  { l: "1D", v: r.day },
                  { l: "1W", v: r.week },
                  { l: "1M", v: r.month },
                  { l: "6M", v: r.sixM },
                ].map((x, j) => (
                  <div key={j} className="mm-card-cell">
                    <span className="mm-card-cell-label">{x.l}</span>
                    <Pct n={x.v} />
                  </div>
                ))}
              </div>
              {r.note && <div className="mm-note-inline">{r.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Macro barometer
// ─────────────────────────────────────────
function MacroBarometer({ macro }) {
  if (!macro || !macro.indicators || macro.indicators.length === 0) {
    return <div style={{ color: PALETTE.muted, fontFamily: FONT_MONO, fontSize: 12, padding: "20px 0" }}>macro data unavailable</div>;
  }

  const groups = ["金利・期待", "信用市場", "金融環境", "為替・実物"];
  const byGroup = groups
    .map((g) => ({ title: g, rows: macro.indicators.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div>
      {byGroup.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 22 }}>
          <div className="mm-group-head">
            <div className="mm-group-title">{g.title}</div>
            <div className="mm-group-marker">▽ {g.rows.length} indicators</div>
          </div>
          <div className="mm-macro-table">
            <div className="mm-macro-row mm-table-header">
              <div className="cell">Indicator</div>
              <div className="cell">Description</div>
              <div className="cell r">Value</div>
              <div className="cell r">1D</div>
              <div className="cell r">1W</div>
              <div className="cell r">As of</div>
            </div>
            {g.rows.map((r, i) => (
              <div
                key={i}
                className="mm-macro-row"
                style={{ background: i % 2 === 0 ? PALETTE.panel : PALETTE.bg }}
              >
                <div className="cell">
                  <div style={{ fontWeight: 500 }}>
                    {r.name}
                    <span className="mm-freq-badge">{r.freq}</span>
                  </div>
                </div>
                <div className="cell" style={{ fontSize: 11.5, color: PALETTE.muted }}>{r.desc}</div>
                <div className="cell r" style={{ fontFamily: FONT_MONO, fontWeight: 500 }}>
                  {fmt(r.value, 3)}{r.unit === "%" ? "%" : ""}
                </div>
                <div className="cell r"><Signed n={r.diff1d} d={3} /></div>
                <div className="cell r"><Signed n={r.diff7d} d={3} /></div>
                <div className="cell r" style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PALETTE.muted }}>
                  {fmtDay(r.asOf)}
                </div>
              </div>
            ))}
          </div>
          {/* Mobile cards */}
          <div className="mm-cards">
            {g.rows.map((r, i) => (
              <div key={i} className="mm-card">
                <div className="mm-card-head">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mm-card-name">{r.name}<span className="mm-freq-badge">{r.freq}</span></div>
                    <div className="mm-card-sub">{r.desc}</div>
                    <div className="mm-card-asof">{r.unit} · As of {fmtDay(r.asOf)}</div>
                  </div>
                  <div className="mm-card-close">{fmt(r.value, 3)}</div>
                </div>
                <div className="mm-card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1D</span><Signed n={r.diff1d} d={3} /></div>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1W</span><Signed n={r.diff7d} d={3} /></div>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1M</span><Signed n={r.diff30d} d={3} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Funding & Volatility panel  (NEW)
//   • VIX 期間構造 (VIX vs VIX3M ratio)
//   • MOVE 指数 (国債ボラ)
//   • SOFR - IORB スプレッド (ファンディング逼迫)
// ─────────────────────────────────────────
function FundingVolPanel({ market, macro }) {
  if (!market || !market.indices) return null;

  const findInst = (name) => market.indices.find((r) => r.name === name);
  const vix    = findInst("VIX");
  const vix3m  = findInst("VIX 3M");
  const move   = findInst("MOVE");
  const findMacro = (id) => (macro?.indicators || []).find((r) => r.id === id);
  const sofr = findMacro("SOFR");
  const iorb = findMacro("IORB");

  // VIX term structure ratio (>1 = contango = リスクオン, <1 = backwardation = リスクオフ)
  const vixRatio = vix?.close && vix3m?.close ? vix3m.close / vix.close : null;
  const vixRegime = vixRatio == null ? null : vixRatio < 1.0 ? "BACKWARDATION" : vixRatio < 1.10 ? "FLAT" : "CONTANGO";

  // SOFR - IORB spread (bp). 通常はマイナス〜ゼロ近辺、プラスはファンディング逼迫
  const fundingSpread = sofr?.value != null && iorb?.value != null
    ? Math.round((sofr.value - iorb.value) * 100)  // basis points
    : null;
  const fundingState = fundingSpread == null ? null
    : fundingSpread > 5 ? "STRESSED"
    : fundingSpread > -5 ? "NEUTRAL"
    : "EASY";

  const cards = [
    {
      label: "VIX 期間構造 (3M ÷ 1M)",
      value: vixRatio,
      decimals: 3,
      regime: vixRegime,
      regimeMap: { CONTANGO: "up", FLAT: "flat", BACKWARDATION: "down" },
      desc: vixRatio == null ? "—"
        : vixRatio < 1.0
          ? "バックワーデーション。短期不安が中期を上回る、リスクオフ警戒"
          : vixRatio < 1.10
            ? "フラット。市場は中立、テールリスクは織り込み中"
            : "コンタンゴ。短期は静か、市場はリスクオン姿勢",
      sub: vix && vix3m ? `VIX ${fmt(vix.close, 2)} / 3M ${fmt(vix3m.close, 2)}` : "data unavailable",
    },
    {
      label: "MOVE (国債ボラ指数)",
      value: move?.close,
      decimals: 1,
      regime: move?.close == null ? null
        : move.close > 130 ? "ELEVATED"
        : move.close > 100 ? "NORMAL"
        : "CALM",
      regimeMap: { ELEVATED: "down", NORMAL: "flat", CALM: "up" },
      desc: move?.close == null ? "—"
        : move.close > 130
          ? "国債ボラ高水準、金利の方向観に確信なし"
          : move.close > 100
            ? "通常レンジ。Fed パスは織り込み済み"
            : "国債ボラ低位、低ボラ環境",
      sub: move?.day != null ? `1日: ${fmtPct(move.day)}` : "",
    },
    {
      label: "SOFR − IORB (bp)",
      value: fundingSpread,
      decimals: 0,
      unit: "bp",
      regime: fundingState,
      regimeMap: { STRESSED: "down", NEUTRAL: "flat", EASY: "up" },
      desc: fundingSpread == null ? "—"
        : fundingSpread > 5
          ? "ファンディング逼迫の早期シグナル。準備預金不足の可能性"
          : fundingSpread > -5
            ? "中立水準。米短期市場は機能正常"
            : "潤沢な準備、ドル流動性緩和的",
      sub: sofr && iorb ? `SOFR ${fmt(sofr.value, 3)} / IORB ${fmt(iorb.value, 3)}` : "",
    },
  ];

  return (
    <div style={{ marginTop: 36, marginBottom: 32 }}>
      <div className="mm-group-head" style={{ marginTop: 0 }}>
        <div className="mm-group-title">ボラティリティ・ファンディング</div>
        <div className="mm-group-marker">▽ stress detectors</div>
      </div>
      <div className="mm-fundvol-grid">
        {cards.map((c, i) => {
          const regimeKey = c.regime ? c.regimeMap[c.regime] : "flat";
          return (
            <div key={i} className={`mm-fundvol-card mm-fundvol-${regimeKey}`}>
              <div className="mm-fundvol-label">{c.label}</div>
              <div className="mm-fundvol-value">
                {c.value != null
                  ? `${c.value > 0 && c.unit === "bp" ? "+" : ""}${fmt(c.value, c.decimals)}${c.unit ? c.unit : ""}`
                  : "—"}
              </div>
              {c.regime && <div className={`mm-fundvol-regime regime-${regimeKey}`}>{c.regime}</div>}
              <div className="mm-fundvol-desc">{c.desc}</div>
              {c.sub && <div className="mm-fundvol-sub">{c.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Listed Alternatives Proxies panel  (NEW)
// ─────────────────────────────────────────
function ListedAltsPanel({ alts }) {
  if (!alts || !alts.assets || alts.assets.length === 0) return null;

  // Group by category
  const order = ["Listed PE", "BDC (PD)", "Infra", "US REIT", "J-REIT"];
  const byCat = order
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
          { l: "1D", v: row.day },
          { l: "1W", v: row.week },
          { l: "1M", v: row.month },
          { l: "3M", v: row.threeM },
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

// ─────────────────────────────────────────
// Sector heatmap
// ─────────────────────────────────────────
function SectorHeatmap({ sectors }) {
  const [period, setPeriod] = useState("day");

  const colorFor = (v) => {
    if (v == null) return PALETTE.bg;
    const cap = period === "ytd" ? 30 : period === "month" ? 10 : period === "week" ? 5 : 3;
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
    const cap = period === "ytd" ? 30 : period === "month" ? 10 : period === "week" ? 5 : 3;
    const t = Math.max(-1, Math.min(1, v / cap));
    return Math.abs(t) > 0.55 ? "#FFF" : PALETTE.fg;
  };

  return (
    <div className="mm-heatmap-wrap">
      <div className="mm-heatmap-head">
        <div className="mm-heatmap-title">米セクター・ヒートマップ</div>
        <div className="mm-heatmap-legend">SPDRセクターETF · {sectors[0]?.asOf || "—"}</div>
      </div>
      <div className="mm-heatmap-tabs">
        {[
          { k: "day",   l: "1日" },
          { k: "week",  l: "1週" },
          { k: "month", l: "1ヶ月" },
          { k: "ytd",   l: "年初来" },
        ].map((x) => (
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
  );
}

// ─────────────────────────────────────────
// Economic chart of the day
// ─────────────────────────────────────────
function EconomicChart({ econ }) {
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

// ─────────────────────────────────────────
// Deep Dive
// ─────────────────────────────────────────
function DeepDive({ article, chartUniverse, cadence }) {
  if (!article || !article.title) return null;

  const relatedLabels = (article.related_keys || [])
    .slice(0, 4)
    .map((k) => {
      const item = chartUniverse.find((c) => c.key === k);
      return item ? item.name : k;
    });

  const cadenceMode = cadence?.mode || "daily";
  const kicker = cadenceMode === "weekly_review" ? "▨ Deep Dive · 週次総括"
    : cadenceMode === "monthly_review" ? "▨ Deep Dive · 月次総括"
    : "▨ Deep Dive · 今日の深掘り";

  return (
    <div className="mm-deepdive">
      <div className="mm-deepdive-kicker">{kicker}</div>
      <h2 className="mm-deepdive-title">{article.title}</h2>
      {article.lede && <p className="mm-deepdive-lede">{article.lede}</p>}

      <div className="mm-deepdive-grid">
        <div>
          <div className="mm-deepdive-section-head">— 背景</div>
          <div className="mm-deepdive-body">{article.background}</div>
        </div>
        <div>
          <div className="mm-deepdive-section-head">— 市場への含意</div>
          <div className="mm-deepdive-body">{article.implications}</div>
        </div>
      </div>

      {article.what_to_watch && article.what_to_watch.length > 0 && (
        <div>
          <div className="mm-deepdive-section-head">— 注視すべきポイント</div>
          <ul className="mm-deepdive-watch">
            {article.what_to_watch.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {relatedLabels.length > 0 && (
        <div className="mm-deepdive-related">
          <span className="mm-deepdive-related-label">関連指標</span>
          {relatedLabels.map((label, i) => (
            <span key={i} className="mm-deepdive-related-chip">{label}</span>
          ))}
        </div>
      )}

      {article.link && (
        <div className="mm-deepdive-source">
          ソース: <a href={article.link} target="_blank" rel="noopener noreferrer">{article.source || "元記事"}</a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Valuation Section
// ─────────────────────────────────────────
function ValuationSection({ valuations }) {
  if (!valuations || !valuations.indicators || valuations.indicators.length === 0) {
    return null;
  }

  const indicators = valuations.indicators;
  const groups = ["米国バリュエーション", "ボラティリティ"];
  const byGroup = groups
    .map((g) => ({ title: g, rows: indicators.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length > 0);

  const chartCandidates = indicators.filter((i) => i.history && i.history.length >= 12).slice(0, 4);

  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <div className="mm-section-tag">5. バリュエーション・ゲージ</div>
      <div className="mm-section-head"><em>5指標で測る、</em> 株式の高低。</div>
      <div className="mm-section-lede">
        Shiller CAPE / Buffett Indicator / Fed Model / 配当利回り / VVIX-VIX 比率。
        水準と5年中央値からの乖離で「いま割高/割安なのか」を読む。
        {valuations?.generatedAt && <>{" "}取得: {fmtDate(valuations.generatedAt)}</>}
      </div>

      <div>
        {byGroup.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 22 }}>
            <div className="mm-group-head">
              <div className="mm-group-title">{g.title}</div>
              <div className="mm-group-marker">▽ {g.rows.length} indicators</div>
            </div>
            <div className="mm-macro-table">
              <div className="mm-macro-row mm-table-header">
                <div className="cell">Indicator</div>
                <div className="cell">Description</div>
                <div className="cell r">Value</div>
                <div className="cell r">1M</div>
                <div className="cell r">1Y</div>
                <div className="cell r">5Y中央値乖離</div>
              </div>
              {g.rows.map((r, i) => (
                <div
                  key={i}
                  className="mm-macro-row"
                  style={{ background: i % 2 === 0 ? PALETTE.panel : PALETTE.bg }}
                >
                  <div className="cell">
                    <div style={{ fontWeight: 500 }}>
                      {r.name}
                      <span className="mm-freq-badge">{r.freq}</span>
                    </div>
                  </div>
                  <div className="cell" style={{ fontSize: 11.5, color: PALETTE.muted }}>{r.desc}</div>
                  <div className="cell r" style={{ fontFamily: FONT_MONO, fontWeight: 500 }}>
                    {fmt(r.value, 2)}{r.unit === "%" ? "%" : r.unit === "x" ? "x" : ""}
                  </div>
                  <div className="cell r"><Signed n={r.diff1m} d={2} /></div>
                  <div className="cell r"><Signed n={r.diff1y} d={2} /></div>
                  <div className="cell r">
                    {r.deviation != null && (
                      <span className={`mm-val-deviation ${r.deviation > 0 ? "high" : "low"}`}>
                        {fmtSigned(r.deviation, 2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mm-cards">
              {g.rows.map((r, i) => (
                <div key={i} className="mm-card">
                  <div className="mm-card-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="mm-card-name">{r.name}<span className="mm-freq-badge">{r.freq}</span></div>
                      <div className="mm-card-sub">{r.desc}</div>
                      <div className="mm-card-asof">{r.unit} · As of {fmtDay(r.asOf)}</div>
                    </div>
                    <div className="mm-card-close">{fmt(r.value, 2)}</div>
                  </div>
                  <div className="mm-card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div className="mm-card-cell"><span className="mm-card-cell-label">1M</span><Signed n={r.diff1m} d={2} /></div>
                    <div className="mm-card-cell"><span className="mm-card-cell-label">1Y</span><Signed n={r.diff1y} d={2} /></div>
                    <div className="mm-card-cell">
                      <span className="mm-card-cell-label">乖離</span>
                      {r.deviation != null && (
                        <span className={`mm-val-deviation ${r.deviation > 0 ? "high" : "low"}`}>
                          {fmtSigned(r.deviation, 2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {chartCandidates.length > 0 && (
        <div className="mm-val-charts">
          {chartCandidates.map((ind, i) => (
            <MiniChart
              key={i}
              title={ind.name}
              sub={`${ind.unit} · 過去 ${ind.history.length} ヶ月`}
              data={ind.history}
              current={ind.value}
              decimals={2}
              freqLabel="5Y Monthly"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Central Bank Watch
// ─────────────────────────────────────────
function CentralBankWatch({ watch, factsByCode }) {
  if (!watch || watch.length === 0) return null;

  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <div className="mm-section-tag">6. 中央銀行ウォッチ</div>
      <div className="mm-section-head"><em>Fed・ECB・BOJ + α、</em> 政策の今を読む。</div>
      <div className="mm-section-lede">
        主要3中銀 (Fed, ECB, BOJ) は常設、4枚目は<strong>その日のニュース文脈で日替わり</strong>に選定。
        各カードの解説はAIが直近の決定・要人発言・市場の見方を織り込んで一文で整理。
      </div>

      <div className="mm-cb-grid">
        {watch.map((cb, i) => {
          const facts = factsByCode[cb.code] || {};
          const isRotating = facts.always_show === false;
          return (
            <div key={i} className={`mm-cb-card ${isRotating ? "rotating" : ""}`}>
              {isRotating && <span className="mm-cb-rotating-badge">▲ 日替わり</span>}
              <div className="mm-cb-head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mm-cb-name">{facts.name || cb.code}</div>
                  <div className="mm-cb-country">{facts.country || ""}</div>
                </div>
                {facts.rate_value != null && (
                  <div className="mm-cb-rate">
                    <div className="mm-cb-rate-val">{fmt(facts.rate_value, 2)}%</div>
                    <div className="mm-cb-rate-name">{facts.rate_name || "Policy Rate"}</div>
                  </div>
                )}
              </div>

              {cb.comment && (
                <div className="mm-cb-comment">{cb.comment}</div>
              )}

              <div className="mm-cb-meta">
                {facts.next_meeting_hint && (
                  <span className="mm-cb-meta-item">頻度: <strong>{facts.next_meeting_hint}</strong></span>
                )}
                {facts.last_change && facts.last_change_date && (
                  <span className="mm-cb-meta-item">
                    直近の変更: <strong>{facts.last_change}</strong> ({facts.last_change_amount > 0 ? "+" : ""}{facts.last_change_amount}%, {facts.last_change_date})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Alternatives Spotlight (PE/PD + Real Assets)
// ─────────────────────────────────────────
const ALT_IMPACT_CONFIG = {
  positive: { label: "POSITIVE", className: "positive", arrow: "▲" },
  negative: { label: "NEGATIVE", className: "negative", arrow: "▼" },
  neutral:  { label: "NEUTRAL",  className: "neutral",  arrow: "■" },
};

function AltCategoryCard({ view, title, subtitle }) {
  if (!view || !view.body) return null;
  const paragraphs = view.body.split(/\n\n+|\n/).map((p) => p.trim()).filter(Boolean);
  const impactKey = (view.impact || "neutral").toLowerCase();
  const impactCfg = ALT_IMPACT_CONFIG[impactKey] || ALT_IMPACT_CONFIG.neutral;
  const sources = view.sources || [];

  return (
    <div className="mm-alt-card">
      <div className="mm-alt-card-head">
        <div>
          <div className="mm-alt-card-title">{title}</div>
          {subtitle && <div className="mm-alt-card-subtitle">{subtitle}</div>}
        </div>
        <div className={`mm-alt-impact mm-alt-impact-${impactCfg.className}`}>
          <span className="mm-alt-impact-arrow">{impactCfg.arrow}</span>
          <span className="mm-alt-impact-label">{impactCfg.label}</span>
        </div>
      </div>

      {view.impact_summary && (
        <div className={`mm-alt-impact-summary mm-alt-impact-${impactCfg.className}-bg`}>
          {view.impact_summary}
        </div>
      )}

      <div className="mm-alt-body">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {sources.length > 0 && (
        <div className="mm-alt-sources">
          <div className="mm-alt-sources-label">— ソース</div>
          <ul className="mm-alt-sources-list">
            {sources.map((s, i) => (
              <li key={i}>
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="mm-alt-source-link">
                  <span className="mm-alt-source-title">{s.title}</span>
                  {s.source && <span style={{ fontSize: 10, color: PALETTE.muted, marginLeft: 6 }}>— {s.source}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AlternativesSection({ pePd, realAssets }) {
  if (!pePd && !realAssets) return null;

  return (
    <div className="mm-alt-wrap">
      <div className="mm-alt-kicker">▨ Alternatives Spotlight · オルタナティブの今</div>
      <h2 className="mm-alt-title">プライベート市場ウォッチ</h2>
      <p className="mm-alt-lede">
        PE・PD と 不動産・インフラの2カテゴリーを、初心者向けに丁寧に解説。
        各カードに「マーケットへのインパクト方向」と一言サマリ付き。
      </p>

      <div className="mm-alt-grid">
        <AltCategoryCard
          view={pePd}
          title="PE / PD"
          subtitle="プライベート・エクイティ&デット"
        />
        <AltCategoryCard
          view={realAssets}
          title="不動産 / インフラ"
          subtitle="Real Assets"
        />
      </div>
    </div>
  );
}

// =====================================================
// MAIN
// =====================================================
export default function MarketMonitor() {
  const [market,       setMarket]       = useState(null);
  const [news,         setNews]         = useState(null);
  const [macro,        setMacro]        = useState(null);
  const [featured,     setFeatured]     = useState(null);
  const [economic,     setEconomic]     = useState(null);
  const [valuations,   setValuations]   = useState(null);
  const [centralBanks, setCentralBanks] = useState(null);
  const [listedAlts,   setListedAlts]   = useState(null);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(MARKET_URL).then((r) => { if (!r.ok) throw new Error(`market.json: ${r.status}`); return r.json(); }),
      fetch(NEWS_URL).then((r) => { if (!r.ok) throw new Error(`news.json: ${r.status}`); return r.json(); }),
      safe(fetch(MACRO_URL).then((r) => { if (!r.ok) throw new Error(`macro.json: ${r.status}`); return r.json(); })),
      safe(fetch(FEATURED_URL).then((r) => { if (!r.ok) throw new Error(`featured.json: ${r.status}`); return r.json(); })),
      safe(fetch(ECONOMIC_URL).then((r) => { if (!r.ok) throw new Error(`economic.json: ${r.status}`); return r.json(); })),
      safe(fetch(VALUATIONS_URL).then((r) => { if (!r.ok) throw new Error(`valuations.json: ${r.status}`); return r.json(); })),
      safe(fetch(CB_URL).then((r) => { if (!r.ok) throw new Error(`central_banks.json: ${r.status}`); return r.json(); })),
      safe(fetch(ALTS_URL).then((r) => { if (!r.ok) throw new Error(`listed_alts.json: ${r.status}`); return r.json(); })),
    ])
      .then(([m, n, ma, f, e, v, cb, la]) => {
        setMarket(m); setNews(n); setMacro(ma); setFeatured(f);
        setEconomic(e); setValuations(v); setCentralBanks(cb); setListedAlts(la);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="mm-root"><div className="mm-error">データ読み込みエラー: {error}</div></div>;
  if (!market || !news) return <div className="mm-root"><div className="mm-loading">Loading market data…</div></div>;

  const pickTicker = (name) => market.indices.find((r) => r.name === name);
  const tickerCells = [
    { n: "日経平均", data: pickTicker("日経平均") },
    { n: "S&P 500", data: pickTicker("S&P 500") },
    { n: "USD/JPY", data: pickTicker("USD/JPY") },
    { n: "WTI", data: pickTicker("WTI原油") },
  ];

  const groups = ["株式", "為替", "金利", "コモディティ", "ボラティリティ"];
  const byGroup = groups
    .map((g) => ({ title: g, rows: market.indices.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length > 0);
  const asOfList = market.indices.map((i) => i.asOf).filter(Boolean).sort();
  const latestAsOf = asOfList.at(-1) || "—";

  const nowJst = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const museStories = news.funny_stories || (news.funny_story ? [news.funny_story] : []);
  const cadence = news.cadence || { mode: "daily" };

  return (
    <div className="mm-root">
      {/* Stale Data Warning */}
      <StaleDataWarning market={market} news={news} />

      {/* Masthead */}
      <header style={{ marginBottom: 18 }}>
        <div className="mm-masthead-meta">
          <span>Market Monitor · 東京版</span>
          <span>{nowJst}</span>
          <span>As of {latestAsOf} close</span>
        </div>
        <div style={{ borderTop: `1px solid ${PALETTE.borderStrong}`, margin: "12px 0 14px 0" }} />
        <div className="mm-masthead-main">
          <h1 className="mm-title">
            <em>Market</em><br />Monitor<span style={{ color: PALETTE.accent }}>.</span>
          </h1>
          <p className="mm-lede">
            {news.headline_of_the_day || "本日のマーケット総括"}。<br />
            主要指標・マクロ指標・Claude が選ぶ注目チャート・ニュース7本を掲載。
          </p>
        </div>
        <div style={{ borderTop: `3px double ${PALETTE.borderStrong}`, margin: "18px 0 0 0" }} />
      </header>

      {/* Epigraph */}
      {news.epigraph && (
        <div className="mm-epigraph">
          <div className="mm-epigraph-quote">{news.epigraph.quote}</div>
          <div className="mm-epigraph-source">{news.epigraph.source}</div>
          {news.epigraph.connection && (
            <div className="mm-epigraph-connection">— {news.epigraph.connection}</div>
          )}
        </div>
      )}

      {/* Ticker */}
      <div className="mm-ticker">
        {tickerCells.map((x, i) => (
          <div key={i} className="mm-ticker-cell">
            <div className="mm-ticker-label">{x.n}</div>
            <div className="mm-ticker-row">
              <div className="mm-ticker-val">
                {x.data ? fmt(x.data.close, x.data.close > 1000 ? 2 : 3) : "—"}
              </div>
              <Pct n={x.data?.day} big />
            </div>
          </div>
        ))}
      </div>

      {/* 1. Featured charts */}
      {featured?.featured && featured.featured.length > 0 && (
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
      )}

      {/* 2. Indices */}
      <div style={{ marginBottom: 12 }}>
        <div className="mm-section-tag">2. 昨日の主要市場</div>
        <div className="mm-section-head"><em>{news.headline_of_the_day || "—"}</em></div>
        <div className="mm-section-lede">
          株式・為替・金利・コモディティ・ボラティリティの引値と、1日/1週/1ヶ月/6ヶ月のリターン。
          最新データ取得: {fmtDate(market.generatedAt)}
        </div>
      </div>
      {byGroup.map((g, i) => <IndicesGroup key={i} title={g.title} rows={g.rows} />)}

      {/* Sector heatmap */}
      {market.sectors && market.sectors.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="mm-group-head">
            <div className="mm-group-title">米セクター・ヒートマップ</div>
            <div className="mm-group-marker">▽ SPDR Sectors</div>
          </div>
          <SectorHeatmap sectors={market.sectors} />
        </div>
      )}

      {/* 3. Macro barometer */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">3. マクロ・バロメーター</div>
        <div className="mm-section-head"><em>FRED 18指標で読む、</em> 地合いの温度。</div>
        <div className="mm-section-lede">
          St. Louis Fed の FRED から取得した<strong>金利・期待</strong>、<strong>信用市場</strong> (HY / IG / EM 社債スプレッド)、
          <strong>金融環境</strong>、<strong>為替・実物</strong>の代表指標。
          信用市場グループはプライベート・デットの絶対リターンを規定する公的市場の状態を映す。
          {macro?.generatedAt && <>{" "}取得: {fmtDate(macro.generatedAt)}</>}
        </div>
        <MacroBarometer macro={macro} />
      </div>

      {/* 4. Funding & Volatility (NEW) */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">4. ボラティリティ・ファンディング</div>
        <div className="mm-section-head"><em>クロスアセットのボラ・レジーム、</em> 流動性逼迫の早期警報。</div>
        <div className="mm-section-lede">
          VIX 期間構造でリスクオン/オフ、MOVE で国債ボラ、SOFR-IORB スプレッドで米短期市場のファンディング状況を読む。
          東京の機関投資家にとって、円ヘッジコストや海外債券判断の前提となる3指標。
        </div>
        <FundingVolPanel market={market} macro={macro} />
      </div>

      {/* 5. Valuation gauges */}
      <ValuationSection valuations={valuations} />

      {/* 6. Central Bank Watch */}
      <CentralBankWatch
        watch={news.central_bank_watch || []}
        factsByCode={Object.fromEntries((centralBanks?.central_banks || []).map((c) => [c.code, c]))}
      />

      {/* 7. 5Y charts */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">7. 重要指標・5年チャート</div>
        <div className="mm-section-head"><em>俯瞰で見る、</em> 5年の地殻変動。</div>
        <div className="mm-section-lede">
          主要指標の月末値推移。<span style={{ color: PALETTE.accent, fontWeight: 600 }}>● 橙破線</span>
          は2026年2月末の米・イラン紛争開始点。
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="日経平均"      sub="¥ · JPY"     data={market.history.nikkei} current={market.history.nikkei?.at(-1)?.v} decimals={0} highlight="2026-02-27" />
          <MiniChart title="S&P 500"       sub="INDEX · USD" data={market.history.sp500}  current={market.history.sp500?.at(-1)?.v}  decimals={0} highlight="2026-02-27" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="USD/JPY"       sub="ドル円"       data={market.history.usdjpy} current={market.history.usdjpy?.at(-1)?.v} decimals={1} highlight="2026-02-27" />
          <MiniChart title="米10年債利回り" sub="%"           data={market.history.us10y}  current={market.history.us10y?.at(-1)?.v}  decimals={2} highlight="2026-02-27" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="WTI原油"       sub="$ / bbl"     data={market.history.wti}    current={market.history.wti?.at(-1)?.v}    decimals={0} unit="$" highlight="2026-02-27" />
          <MiniChart title="金 (COMEX)"    sub="$ / oz"      data={market.history.gold}   current={market.history.gold?.at(-1)?.v}   decimals={0} unit="$" highlight="2026-02-27" />
        </div>
      </div>

      {/* 8. News */}
      <div style={{ marginTop: 56 }}>
        <div className="mm-section-tag">8. 市場を動かしたニュース</div>
        <div className="mm-section-head"><em>Claude AIが選ぶ、</em> 本日の7本。</div>
        <div className="mm-section-lede">
          直近24時間の主要メディアから AI が選定した、マーケットに影響を与えた / 与えうる重要ニュース。
        </div>
        <div className="mm-news-grid">
          {(news.news || []).map((n, i) => (
            <div key={i} className="mm-news-cell">
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PALETTE.accent, letterSpacing: "0.2em", marginBottom: 8, fontWeight: 600 }}>
                — {n.tag}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.25, color: PALETTE.fg, fontWeight: 500, marginBottom: 10 }}>
                {n.headline}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: PALETTE.muted, marginBottom: 14 }}>{n.body}</div>
              {n.impact && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {n.impact.map((x, j) => (
                    <span
                      key={j}
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10.5,
                        color: PALETTE.fg,
                        border: `1px solid ${PALETTE.borderStrong}`,
                        padding: "3px 8px",
                        letterSpacing: "0.02em",
                        fontWeight: 500,
                      }}
                    >
                      {x}
                    </span>
                  ))}
                </div>
              )}
              {n.link && (
                <div>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="mm-news-link">
                    {n.source || "記事元"}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 9. Listed Alternatives Proxies (NEW) */}
      <ListedAltsPanel alts={listedAlts} />

      {/* Deep Dive article */}
      <DeepDive article={news.deep_dive} chartUniverse={CHART_UNIVERSE_LABELS} cadence={cadence} />

      {/* Economic indicator chart (daily pick) */}
      <EconomicChart econ={economic} />

      {/* Alternatives Spotlight */}
      <AlternativesSection
        pePd={news.pe_pd_view}
        realAssets={news.real_assets_view}
      />

      {/* Market Muse (3 cards) */}
      {museStories.length > 0 && (
        <div>
          <div className="mm-muse-header">
            <div className="mm-section-tag">▨ Market Muse</div>
            <div className="mm-section-head"><em>クスッと、</em> 市場の小話 三題。</div>
            <div className="mm-section-lede">市場の小話・観察・人間味の三題。</div>
          </div>
          <div className="mm-muse-grid">
            {museStories.slice(0, 3).map((s, i) => (
              <div key={i} className="mm-muse-card">
                <div className="mm-muse-kind">— {s.kind || ["皮肉", "人間味", "観察"][i] || "小話"}</div>
                <div className="mm-muse-title">{s.title}</div>
                <div className="mm-muse-body">{s.body}</div>
                {s.link && (
                  <div>
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="mm-muse-link">
                      {s.source || "記事元"}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mm-footer">
        <div>Market Monitor · 東京版 · v13.0 · auto-updated 08:00 JST</div>
        <div>Data: yfinance / FRED / Anthropic Claude API</div>
      </footer>
    </div>
  );
}
