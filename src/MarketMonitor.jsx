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
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";

// =====================================================
// MARKET MONITOR — v2
// Adds: epigraph, yield curves (JP/US/DE), per-indicator asOf
//       timestamps, and a "Market Muse" humor column
// =====================================================

const PALETTE = {
  bg: "#F5F1E8",
  bgAlt: "#FBF8F0",
  panel: "#FFFFFF",
  fg: "#1A1F2E",
  muted: "#5C6373",
  dim: "#9BA0AB",
  accent: "#8B2635",
  accent2: "#B87333",
  border: "#D4CDB8",
  borderStrong: "#1A1F2E",
  up: "#2D6A4F",
  down: "#C0392B",
  flat: "#5C6373",

  // Country colors for yield curves
  jp: "#8B2635",  // burgundy
  us: "#1E3A5F",  // navy
  de: "#B87333",  // copper
};

const fmt = (n, d = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtPct = (n) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const fmtBp = (n) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)} bp`;
};

const tone = (n) =>
  n == null ? PALETTE.flat : n > 0 ? PALETTE.up : n < 0 ? PALETTE.down : PALETTE.flat;

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtDay = (ymd) => {
  if (!ymd) return "—";
  // "YYYY-MM-DD" -> "MM/DD"
  const parts = ymd.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return ymd;
};

// ─── Data paths ───
const MARKET_URL = `${import.meta.env.BASE_URL}data/market.json`;
const NEWS_URL   = `${import.meta.env.BASE_URL}data/news.json`;
const YIELDS_URL = `${import.meta.env.BASE_URL}data/yields.json`;

const FONT_DISPLAY = `'Fraunces', 'Noto Serif JP', ui-serif, Georgia, serif`;
const FONT_MONO = `'JetBrains Mono', 'Menlo', ui-monospace, monospace`;
const FONT_SANS = `'IBM Plex Sans', 'IBM Plex Sans JP', -apple-system, sans-serif`;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=JetBrains+Mono:wght@400;500&family=IBM+Plex+Sans+JP:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: ${PALETTE.bg}; }

  .mm-root { background: ${PALETTE.bg}; color: ${PALETTE.fg}; min-height: 100vh; font-family: ${FONT_SANS}; padding: 28px 32px 60px 32px; }
  .mm-masthead-meta { display: flex; justify-content: space-between; align-items: baseline; font-family: ${FONT_MONO}; font-size: 10.5px; color: ${PALETTE.muted}; letter-spacing: 0.15em; text-transform: uppercase; gap: 12px; flex-wrap: wrap; }
  .mm-masthead-main { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
  .mm-title { font-family: ${FONT_DISPLAY}; font-size: 72px; line-height: 0.9; margin: 0; font-weight: 500; letter-spacing: -0.02em; color: ${PALETTE.fg}; }
  .mm-title em { font-style: italic; font-weight: 400; }
  .mm-lede { max-width: 460px; font-size: 13px; line-height: 1.6; color: ${PALETTE.muted}; margin: 0; padding-bottom: 8px; }

  /* ─── Epigraph ─── */
  .mm-epigraph {
    margin: 32px 0 40px 0;
    padding: 36px 40px;
    background: ${PALETTE.panel};
    border-top: 1px solid ${PALETTE.borderStrong};
    border-bottom: 1px solid ${PALETTE.borderStrong};
    position: relative;
  }
  .mm-epigraph::before {
    content: """;
    position: absolute;
    top: 4px;
    left: 16px;
    font-family: ${FONT_DISPLAY};
    font-size: 88px;
    line-height: 1;
    color: ${PALETTE.accent};
    opacity: 0.25;
  }
  .mm-epigraph-quote {
    font-family: ${FONT_DISPLAY};
    font-size: 22px;
    line-height: 1.45;
    font-style: italic;
    color: ${PALETTE.fg};
    font-weight: 400;
    max-width: 680px;
    position: relative;
    z-index: 1;
  }
  .mm-epigraph-source {
    font-family: ${FONT_MONO};
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${PALETTE.muted};
    margin-top: 12px;
  }
  .mm-epigraph-source::before { content: "— "; }
  .mm-epigraph-connection {
    font-size: 11.5px;
    color: ${PALETTE.accent};
    font-style: italic;
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px dashed ${PALETTE.border};
    max-width: 680px;
  }

  .mm-ticker { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid ${PALETTE.borderStrong}; margin-bottom: 36px; background: ${PALETTE.panel}; }
  .mm-ticker-cell { padding: 16px 18px; border-right: 1px solid ${PALETTE.border}; }
  .mm-ticker-cell:last-child { border-right: none; }
  .mm-ticker-label { font-family: ${FONT_MONO}; font-size: 10px; color: ${PALETTE.muted}; letter-spacing: 0.15em; text-transform: uppercase; }
  .mm-ticker-row { display: flex; align-items: baseline; justify-content: space-between; margin-top: 4px; gap: 6px; }
  .mm-ticker-val { font-family: ${FONT_MONO}; font-size: 22px; color: ${PALETTE.fg}; font-weight: 500; }

  .mm-section-tag { font-family: ${FONT_DISPLAY}; font-size: 13px; color: ${PALETTE.accent}; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 6px; font-weight: 500; }
  .mm-section-head { font-family: ${FONT_DISPLAY}; font-size: 36px; color: ${PALETTE.fg}; line-height: 1.05; margin-bottom: 4px; font-weight: 500; }
  .mm-section-head em { font-style: italic; font-weight: 400; }
  .mm-section-lede { font-size: 13px; color: ${PALETTE.muted}; margin-bottom: 24px; line-height: 1.65; max-width: 820px; }
  .mm-section-lede strong { color: ${PALETTE.fg}; font-weight: 600; }

  .mm-group-head { border-bottom: 1px solid ${PALETTE.borderStrong}; padding-bottom: 6px; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: baseline; }
  .mm-group-title { font-family: ${FONT_DISPLAY}; font-size: 22px; color: ${PALETTE.fg}; font-style: italic; font-weight: 500; }
  .mm-group-marker { font-family: ${FONT_MONO}; font-size: 9.5px; color: ${PALETTE.muted}; letter-spacing: 0.15em; text-transform: uppercase; }

  .mm-table-row { display: grid; grid-template-columns: minmax(180px, 2.2fr) 1.1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.9fr; border-bottom: 1px solid ${PALETTE.border}; }
  .mm-table-header { font-family: ${FONT_MONO}; font-size: 9.5px; color: ${PALETTE.muted}; letter-spacing: 0.1em; text-transform: uppercase; }
  .mm-table-row .cell { padding: 11px 14px; }
  .mm-table-row .cell.r { text-align: right; }
  .mm-asof { font-family: ${FONT_MONO}; font-size: 10px; color: ${PALETTE.muted}; white-space: nowrap; }

  .mm-cards { display: none; }
  .mm-card { border: 1px solid ${PALETTE.border}; background: ${PALETTE.panel}; padding: 14px 16px; margin-bottom: 8px; }
  .mm-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .mm-card-name { font-family: ${FONT_DISPLAY}; font-size: 18px; color: ${PALETTE.fg}; font-weight: 500; line-height: 1.15; }
  .mm-card-sub { font-size: 10.5px; color: ${PALETTE.muted}; margin-top: 2px; }
  .mm-card-asof { font-family: ${FONT_MONO}; font-size: 9.5px; color: ${PALETTE.muted}; margin-top: 4px; letter-spacing: 0.05em; }
  .mm-card-close { font-family: ${FONT_MONO}; font-size: 18px; color: ${PALETTE.fg}; font-weight: 500; text-align: right; white-space: nowrap; }
  .mm-card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; border-top: 1px solid ${PALETTE.border}; padding-top: 12px; }
  .mm-card-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
  .mm-card-cell-label { font-family: ${FONT_MONO}; font-size: 9px; color: ${PALETTE.muted}; letter-spacing: 0.1em; text-transform: uppercase; }
  .mm-note-inline { font-size: 11.5px; color: ${PALETTE.accent}; border-left: 2px solid ${PALETTE.accent}; padding-left: 10px; line-height: 1.5; margin-top: 10px; }

  .mm-chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .mm-chart-card { border: 1px solid ${PALETTE.border}; background: ${PALETTE.panel}; padding: 18px 18px 10px 18px; }
  .mm-chart-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; gap: 10px; }
  .mm-chart-title { font-family: ${FONT_DISPLAY}; font-size: 20px; color: ${PALETTE.fg}; font-weight: 500; line-height: 1; }
  .mm-chart-sub { font-size: 10px; color: ${PALETTE.muted}; letter-spacing: 0.08em; margin-top: 4px; text-transform: uppercase; }
  .mm-chart-cur { font-family: ${FONT_MONO}; font-size: 18px; color: ${PALETTE.accent}; font-weight: 500; text-align: right; }
  .mm-chart-range { font-family: ${FONT_MONO}; font-size: 9.5px; color: ${PALETTE.muted}; text-align: right; }

  /* ─── Yield curve panel ─── */
  .mm-yc-wrap { border: 1px solid ${PALETTE.border}; background: ${PALETTE.panel}; padding: 20px; margin-bottom: 40px; }
  .mm-yc-title { font-family: ${FONT_DISPLAY}; font-size: 20px; font-weight: 500; margin-bottom: 4px; }
  .mm-yc-sub { font-size: 11px; color: ${PALETTE.muted}; margin-bottom: 18px; }
  .mm-yc-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px; }
  .mm-yc-legend { display: flex; gap: 18px; font-family: ${FONT_MONO}; font-size: 11px; margin-top: 8px; flex-wrap: wrap; }
  .mm-yc-swatch { display: inline-block; width: 14px; height: 3px; margin-right: 6px; vertical-align: middle; }

  .mm-news-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid ${PALETTE.borderStrong}; background: ${PALETTE.panel}; }
  .mm-news-cell { padding: 20px 22px; border-bottom: 1px solid ${PALETTE.border}; border-right: 1px solid ${PALETTE.border}; }
  .mm-news-cell:nth-child(2n) { border-right: none; }

  /* ─── Market Muse (funny story) ─── */
  .mm-muse {
    margin: 40px 0;
    padding: 28px 32px;
    background: linear-gradient(135deg, #FBF3E0 0%, ${PALETTE.panel} 100%);
    border: 1px solid ${PALETTE.border};
    border-left: 4px solid ${PALETTE.accent2};
    position: relative;
  }
  .mm-muse-tag {
    font-family: ${FONT_MONO};
    font-size: 10px;
    letter-spacing: 0.25em;
    color: ${PALETTE.accent2};
    font-weight: 600;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .mm-muse-title {
    font-family: ${FONT_DISPLAY};
    font-size: 22px;
    color: ${PALETTE.fg};
    font-weight: 500;
    font-style: italic;
    margin-bottom: 10px;
  }
  .mm-muse-body {
    font-size: 14px;
    line-height: 1.7;
    color: ${PALETTE.fg};
    max-width: 780px;
  }

  .mm-footer { display: flex; justify-content: space-between; font-family: ${FONT_MONO}; font-size: 10px; color: ${PALETTE.muted}; letter-spacing: 0.12em; flex-wrap: wrap; gap: 8px; }

  .mm-loading { padding: 120px 20px; text-align: center; font-family: ${FONT_DISPLAY}; font-style: italic; color: ${PALETTE.muted}; font-size: 22px; }
  .mm-error { padding: 24px; border: 1px solid ${PALETTE.down}; background: #FFF5F5; color: ${PALETTE.down}; font-family: ${FONT_MONO}; font-size: 12px; margin-bottom: 24px; }

  @media (max-width: 960px) {
    .mm-root { padding: 24px 22px 50px 22px; }
    .mm-title { font-size: 56px; }
    .mm-section-head { font-size: 28px; }
    .mm-chart-grid { grid-template-columns: 1fr; }
    .mm-news-grid { grid-template-columns: 1fr; }
    .mm-news-cell { border-right: none; }
    .mm-yc-grid { grid-template-columns: 1fr; gap: 24px; }
  }

  @media (max-width: 640px) {
    .mm-root { padding: 18px 14px 40px 14px; }
    .mm-masthead-meta { font-size: 9px; letter-spacing: 0.1em; }
    .mm-masthead-meta span:nth-child(3) { display: none; }
    .mm-masthead-main { flex-direction: column; align-items: flex-start; gap: 12px; }
    .mm-title { font-size: 46px; line-height: 0.88; }
    .mm-lede { font-size: 13px; max-width: 100%; padding-bottom: 0; }
    .mm-epigraph { padding: 24px 20px; margin: 24px 0 32px 0; }
    .mm-epigraph-quote { font-size: 17px; }
    .mm-epigraph::before { font-size: 64px; top: -2px; left: 10px; }
    .mm-ticker { grid-template-columns: 1fr 1fr; margin-bottom: 28px; }
    .mm-ticker-cell { padding: 12px 14px; }
    .mm-ticker-cell:nth-child(2n) { border-right: none; }
    .mm-ticker-cell:nth-child(-n+2) { border-bottom: 1px solid ${PALETTE.border}; }
    .mm-ticker-val { font-size: 17px; }
    .mm-ticker-label { font-size: 9px; }
    .mm-section-tag { font-size: 10.5px; letter-spacing: 0.22em; }
    .mm-section-head { font-size: 23px; }
    .mm-section-lede { font-size: 12.5px; }
    .mm-group-title { font-size: 18px; }
    .mm-table { display: none; }
    .mm-cards { display: block; }
    .mm-chart-card { padding: 14px 12px 6px 12px; }
    .mm-chart-title { font-size: 17px; }
    .mm-chart-cur { font-size: 16px; }
    .mm-chart-head { gap: 8px; }
    .mm-news-cell { padding: 16px 14px; }
    .mm-muse { padding: 20px 18px; }
    .mm-muse-title { font-size: 18px; }
    .mm-muse-body { font-size: 13px; }
    .mm-yc-wrap { padding: 14px; }
    .mm-footer { flex-direction: column; font-size: 9.5px; letter-spacing: 0.08em; }
  }
`;

// ─────────────────────────────────────────────────
// Small primitives
// ─────────────────────────────────────────────────
const Pct = ({ n, big = false }) => (
  <span
    style={{
      color: tone(n),
      fontFamily: FONT_MONO,
      fontSize: big ? 15 : 12.5,
      fontWeight: 600,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
    }}
  >
    {fmtPct(n)}
  </span>
);

// ─────────────────────────────────────────────────
// Mini trend chart (5Y monthly)
// ─────────────────────────────────────────────────
function MiniChart({ data, title, sub, current, unit = "", decimals = 0, highlight }) {
  if (!data || data.length === 0) {
    return (
      <div className="mm-chart-card">
        <div className="mm-chart-title">{title}</div>
        <div style={{ padding: "40px 0", textAlign: "center", color: PALETTE.muted, fontFamily: FONT_MONO, fontSize: 12 }}>
          data unavailable
        </div>
      </div>
    );
  }
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.1;
  return (
    <div className="mm-chart-card">
      <div className="mm-chart-head">
        <div>
          <div className="mm-chart-title">{title}</div>
          <div className="mm-chart-sub">{sub} · 5Y Monthly</div>
        </div>
        <div>
          <div className="mm-chart-cur">{unit}{fmt(current, decimals)}</div>
          <div className="mm-chart-range">Range {fmt(min, decimals)} – {fmt(max, decimals)}</div>
        </div>
      </div>
      <div style={{ height: 140, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              tickFormatter={(v) => v.slice(2, 4) + "/" + v.slice(5, 7)}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: PALETTE.muted, fontFamily: FONT_MONO }}
              stroke={PALETTE.dim}
              domain={[min - pad, max + pad]}
              tickFormatter={(v) => v > 10000 ? `${(v / 1000).toFixed(0)}k` : fmt(v, decimals === 0 ? 0 : 1)}
              width={36}
            />
            <Tooltip
              contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg }}
              labelStyle={{ color: PALETTE.muted }}
              formatter={(v) => [`${unit}${fmt(v, decimals)}`, title]}
            />
            {highlight && (
              <ReferenceLine
                x={highlight}
                stroke={PALETTE.accent}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: "イラン紛争", position: "top", fill: PALETTE.accent, fontSize: 9, fontFamily: FONT_MONO }}
              />
            )}
            <Line type="monotone" dataKey="v" stroke={PALETTE.accent} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: PALETTE.accent, stroke: PALETTE.panel }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Yield curve panel: 3 countries overlay + diff bar chart
// ─────────────────────────────────────────────────
function YieldCurvePanel({ yields }) {
  if (!yields || !yields.curves) {
    return (
      <div className="mm-yc-wrap">
        <div className="mm-yc-title">イールドカーブ</div>
        <div style={{ color: PALETTE.muted, fontSize: 12 }}>データ未取得</div>
      </div>
    );
  }

  const { JP = [], US = [], DE = [] } = yields.curves;

  // Merge into a single series keyed by tenor
  const allTenors = Array.from(new Set([
    ...JP.map((x) => x.tenor),
    ...US.map((x) => x.tenor),
    ...DE.map((x) => x.tenor),
  ])).sort((a, b) => a - b);

  const curveData = allTenors.map((tenor) => {
    const jp = JP.find((x) => x.tenor === tenor);
    const us = US.find((x) => x.tenor === tenor);
    const de = DE.find((x) => x.tenor === tenor);
    return {
      tenor: `${tenor}Y`,
      tenorNum: tenor,
      JP: jp?.yield ?? null,
      US: us?.yield ?? null,
      DE: de?.yield ?? null,
    };
  });

  // Diff bars: key tenors only (2/5/10/30)
  const keyTenors = [2, 5, 10, 30];
  const diffData = keyTenors.map((tenor) => {
    const jp = JP.find((x) => x.tenor === tenor);
    const us = US.find((x) => x.tenor === tenor);
    const de = DE.find((x) => x.tenor === tenor);
    return {
      tenor: `${tenor}Y`,
      JP: jp?.diffBp ?? 0,
      US: us?.diffBp ?? 0,
      DE: de?.diffBp ?? 0,
    };
  });

  // Latest asOf per country for timestamps
  const latestAsOf = (arr) => {
    if (!arr || arr.length === 0) return "—";
    return arr.map((x) => x.asOf).sort().at(-1);
  };

  return (
    <div className="mm-yc-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div className="mm-yc-title">イールドカーブ <em style={{ fontStyle: "italic", color: PALETTE.muted, fontSize: 14, marginLeft: 8 }}>JP · US · DE</em></div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: PALETTE.muted, letterSpacing: "0.1em" }}>
          JP {latestAsOf(JP)} · US {latestAsOf(US)} · DE {latestAsOf(DE)}
        </div>
      </div>
      <div className="mm-yc-sub">
        左: 当日終値ベースの利回り曲線を3カ国重ね描き。右: 主要年限 (2Y/5Y/10Y/30Y) の前日差分 (bp)。
      </div>

      <div className="mm-yc-grid">
        {/* Curve overlay */}
        <div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="tenor" tick={{ fontSize: 11, fill: PALETTE.muted, fontFamily: FONT_MONO }} stroke={PALETTE.dim} />
                <YAxis
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.dim}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg }}
                  labelStyle={{ color: PALETTE.muted }}
                  formatter={(v, name) => [v != null ? `${v.toFixed(3)}%` : "—", name]}
                />
                <Line type="monotone" dataKey="JP" stroke={PALETTE.jp} strokeWidth={2.2} dot={{ r: 3, fill: PALETTE.jp }} connectNulls />
                <Line type="monotone" dataKey="US" stroke={PALETTE.us} strokeWidth={2.2} dot={{ r: 3, fill: PALETTE.us }} connectNulls />
                <Line type="monotone" dataKey="DE" stroke={PALETTE.de} strokeWidth={2.2} dot={{ r: 3, fill: PALETTE.de }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mm-yc-legend">
            <span><span className="mm-yc-swatch" style={{ background: PALETTE.jp }}></span>日本</span>
            <span><span className="mm-yc-swatch" style={{ background: PALETTE.us }}></span>米国</span>
            <span><span className="mm-yc-swatch" style={{ background: PALETTE.de }}></span>ドイツ</span>
          </div>
        </div>

        {/* Diff bars */}
        <div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diffData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={PALETTE.border} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="tenor" tick={{ fontSize: 11, fill: PALETTE.muted, fontFamily: FONT_MONO }} stroke={PALETTE.dim} />
                <YAxis
                  tick={{ fontSize: 10, fill: PALETTE.muted, fontFamily: FONT_MONO }}
                  stroke={PALETTE.dim}
                  tickFormatter={(v) => `${v}bp`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: PALETTE.panel, border: `1px solid ${PALETTE.borderStrong}`, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.fg }}
                  labelStyle={{ color: PALETTE.muted }}
                  formatter={(v) => [`${v > 0 ? "+" : ""}${v.toFixed(1)} bp`, ""]}
                />
                <ReferenceLine y={0} stroke={PALETTE.borderStrong} />
                <Bar dataKey="JP" fill={PALETTE.jp} />
                <Bar dataKey="US" fill={PALETTE.us} />
                <Bar dataKey="DE" fill={PALETTE.de} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mm-yc-legend">
            <span style={{ color: PALETTE.muted }}>前日比 (bp)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Indices group table / cards
// ─────────────────────────────────────────────────
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
            <div key={i} className="mm-table-row" style={{ background: i % 2 === 0 ? "transparent" : "rgba(26, 31, 46, 0.025)" }}>
              <div className="cell">
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: PALETTE.fg, fontWeight: 500, lineHeight: 1.15 }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: PALETTE.muted, marginTop: 2 }}>{r.sub}</div>
                {r.note && <div className="mm-note-inline" style={{ fontSize: 10.5, marginTop: 6 }}>{r.note}</div>}
              </div>
              <div className="cell r">
                <div style={{ fontFamily: FONT_MONO, fontSize: 17, color: PALETTE.fg, fontWeight: 500 }}>
                  {fmt(r.close, priceDecimals)}{r.unit || ""}
                </div>
              </div>
              <div className="cell r"><Pct n={r.day} big /></div>
              <div className="cell r"><Pct n={r.week} /></div>
              <div className="cell r"><Pct n={r.month} /></div>
              <div className="cell r"><Pct n={r.sixM} /></div>
              <div className="cell r"><span className="mm-asof">{fmtDay(r.asOf)}</span></div>
            </div>
          );
        })}
      </div>
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

// ─────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────
export default function MarketMonitor() {
  const [market, setMarket] = useState(null);
  const [news,   setNews]   = useState(null);
  const [yields, setYields] = useState(null);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    const safe = (p) => p.catch((e) => { console.warn(e); return null; });
    Promise.all([
      fetch(MARKET_URL).then((r) => { if (!r.ok) throw new Error(`market.json: ${r.status}`); return r.json(); }),
      fetch(NEWS_URL).then((r)   => { if (!r.ok) throw new Error(`news.json: ${r.status}`);   return r.json(); }),
      safe(fetch(YIELDS_URL).then((r) => { if (!r.ok) throw new Error(`yields.json: ${r.status}`); return r.json(); })),
    ])
      .then(([m, n, y]) => { setMarket(m); setNews(n); setYields(y); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="mm-root">
        <style>{STYLES}</style>
        <div className="mm-error">データ読み込みエラー: {error}</div>
      </div>
    );
  }

  if (!market || !news) {
    return (
      <div className="mm-root">
        <style>{STYLES}</style>
        <div className="mm-loading">Loading market data…</div>
      </div>
    );
  }

  const pickTicker = (name) => market.indices.find((r) => r.name === name);
  const tickerCells = [
    { n: "日経平均",  data: pickTicker("日経平均") },
    { n: "S&P 500", data: pickTicker("S&P 500") },
    { n: "USD/JPY", data: pickTicker("USD/JPY") },
    { n: "WTI",     data: pickTicker("WTI原油") },
  ];

  const groups = ["株式", "為替", "金利", "コモディティ", "ボラティリティ"];
  const byGroup = groups.map((g) => ({
    title: g,
    rows: market.indices.filter((r) => r.group === g),
  })).filter((g) => g.rows.length > 0);

  const asOfList = market.indices.map((i) => i.asOf).filter(Boolean).sort();
  const latestAsOf = asOfList.at(-1) || "—";

  const nowJst = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  });

  return (
    <div className="mm-root">
      <style>{STYLES}</style>

      {/* ─── MASTHEAD ─── */}
      <header style={{ marginBottom: 18 }}>
        <div className="mm-masthead-meta">
          <span>Market Monitor · 東京版</span>
          <span>{nowJst}</span>
          <span>As of {latestAsOf} close</span>
        </div>

        <div style={{ borderTop: `1px solid ${PALETTE.borderStrong}`, margin: "12px 0 14px 0" }} />

        <div className="mm-masthead-main">
          <h1 className="mm-title">
            <em>Market</em><br />
            Monitor<span style={{ color: PALETTE.accent }}>.</span>
          </h1>
          <p className="mm-lede">
            {news.headline_of_the_day || "本日のマーケット総括"}。
            <br />
            引値ベースの主要指標・イールドカーブ・5年チャート・昨日の市場を動かしたニュース7本を掲載。
          </p>
        </div>

        <div style={{ borderTop: `3px double ${PALETTE.borderStrong}`, margin: "18px 0 0 0" }} />
      </header>

      {/* ─── EPIGRAPH ─── */}
      {news.epigraph && (
        <div className="mm-epigraph">
          <div className="mm-epigraph-quote">{news.epigraph.quote}</div>
          <div className="mm-epigraph-source">{news.epigraph.source}</div>
          {news.epigraph.connection && (
            <div className="mm-epigraph-connection">— {news.epigraph.connection}</div>
          )}
        </div>
      )}

      {/* ─── TICKER ─── */}
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

      {/* ─── SECTION I: INDICES ─── */}
      <div style={{ marginBottom: 12 }}>
        <div className="mm-section-tag">I. 昨日の主要市場</div>
        <div className="mm-section-head">
          <em>{news.headline_of_the_day || "—"}</em>
        </div>
        <div className="mm-section-lede">
          株式・為替・金利・コモディティ・ボラティリティの引値と、1日/1週/1ヶ月/6ヶ月のリターン。
          最新データ取得: {fmtDate(market.generatedAt)}
        </div>
      </div>

      {byGroup.map((g, i) => (
        <IndicesGroup key={i} title={g.title} rows={g.rows} />
      ))}

      {/* ─── SECTION II: YIELD CURVES ─── */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">II. イールドカーブ</div>
        <div className="mm-section-head">
          <em>金利の地図、</em> 日米独で読む。
        </div>
        <div className="mm-section-lede">
          日本・米国・ドイツの主要年限利回り。曲線の傾き（スティープかフラットか）と、
          主要年限の前日差分でその日のトレンドの転換点を捉える。
          {yields?.generatedAt && <>{" "}取得: {fmtDate(yields.generatedAt)}</>}
        </div>
        <YieldCurvePanel yields={yields} />
      </div>

      {/* ─── SECTION III: 5Y CHARTS ─── */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">III. 重要指標・5年チャート</div>
        <div className="mm-section-head">
          <em>俯瞰で見る、</em> 5年の地殻変動。
        </div>
        <div className="mm-section-lede">
          主要指標の月末値推移。<span style={{ color: PALETTE.accent, fontWeight: 600 }}>● 橙破線</span>
          は2026年2月末の米・イラン紛争開始点。
        </div>

        <div className="mm-chart-grid">
          <MiniChart title="日経平均"      sub="¥ · JPY"      data={market.history.nikkei} current={market.history.nikkei?.at(-1)?.v} decimals={0} highlight="2026-02" />
          <MiniChart title="S&P 500"       sub="INDEX · USD"  data={market.history.sp500}  current={market.history.sp500?.at(-1)?.v}  decimals={0} highlight="2026-02" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="USD/JPY"       sub="ドル円"        data={market.history.usdjpy} current={market.history.usdjpy?.at(-1)?.v} decimals={1} highlight="2026-02" />
          <MiniChart title="米10年債利回り" sub="%"            data={market.history.us10y}  current={market.history.us10y?.at(-1)?.v}  decimals={2} highlight="2026-02" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="WTI原油"       sub="$ / bbl"      data={market.history.wti}    current={market.history.wti?.at(-1)?.v}    decimals={0} unit="$" highlight="2026-02" />
          <MiniChart title="金 (COMEX)"    sub="$ / oz"       data={market.history.gold}   current={market.history.gold?.at(-1)?.v}   decimals={0} unit="$" highlight="2026-02" />
        </div>
      </div>

      {/* ─── SECTION IV: NEWS ─── */}
      <div style={{ marginTop: 56 }}>
        <div className="mm-section-tag">IV. 市場を動かしたニュース</div>
        <div className="mm-section-head">
          <em>Claude AIが選ぶ、</em> 本日の7本。
        </div>
        <div className="mm-section-lede">
          直近24時間の主要メディアから AI が選定した、マーケットに影響を与えた / 与えうる重要ニュース。
        </div>

        <div className="mm-news-grid">
          {(news.news || []).map((n, i) => (
            <div key={i} className="mm-news-cell">
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PALETTE.accent, letterSpacing: "0.2em", marginBottom: 8, fontWeight: 600 }}>
                — {n.tag}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, lineHeight: 1.25, color: PALETTE.fg, fontWeight: 500, marginBottom: 10 }}>
                {n.headline}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: PALETTE.muted, marginBottom: 14 }}>
                {n.body}
              </div>
              {n.impact && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {n.impact.map((x, j) => (
                    <span key={j} style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PALETTE.fg, border: `1px solid ${PALETTE.borderStrong}`, padding: "3px 8px", letterSpacing: "0.02em", fontWeight: 500 }}>
                      {x}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── MARKET MUSE (funny story) ─── */}
      {news.funny_story && (
        <div className="mm-muse">
          <div className="mm-muse-tag">♔ Market Muse · 今日のひとひら</div>
          <div className="mm-muse-title">{news.funny_story.title}</div>
          <div className="mm-muse-body">{news.funny_story.body}</div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <div style={{ borderTop: `3px double ${PALETTE.borderStrong}`, margin: "48px 0 20px 0" }} />
      <div className="mm-footer">
        <span>DATA: yfinance · stooq · NEWS: Claude API summarized from RSS</span>
        <span>Auto-updated daily 07:00 JST · GitHub Actions</span>
        <span>EOD · {latestAsOf}</span>
      </div>
    </div>
  );
}
