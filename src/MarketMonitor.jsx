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
} from "recharts";
import "./MarketMonitor.css";

// =====================================================
// MARKET MONITOR — v5 (external CSS)
// =====================================================

// Recharts などJSで色を直接参照する必要がある箇所のみこのPALETTEを使用。
// UI全体のスタイルは MarketMonitor.css 側の CSS 変数で管理。
const PALETTE = {
  bg: "#F5F1E8",
  panel: "#FFFFFF",
  fg: "#1A1F2E",
  muted: "#5C6373",
  dim: "#9BA0AB",
  accent: "#8B2635",
  border: "#D4CDB8",
  borderStrong: "#1A1F2E",
  up: "#2D6A4F",
  down: "#C0392B",
  flat: "#5C6373",
};

const FONT_MONO = "'JetBrains Mono', 'Menlo', ui-monospace, monospace";

const fmt = (n, d = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtPct = (n) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const fmtSigned = (n, d = 3) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(d)}`;
};

const tone = (n) =>
  n == null ? PALETTE.flat : n > 0 ? PALETTE.up : n < 0 ? PALETTE.down : PALETTE.flat;

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtDay = (ymd) => {
  if (!ymd) return "—";
  const p = ymd.split("-");
  return p.length === 3 ? `${p[1]}/${p[2]}` : ymd;
};

const MARKET_URL = `${import.meta.env.BASE_URL}data/market.json`;
const NEWS_URL = `${import.meta.env.BASE_URL}data/news.json`;
const MACRO_URL = `${import.meta.env.BASE_URL}data/macro.json`;
const FEATURED_URL = `${import.meta.env.BASE_URL}data/featured.json`;

// ─── Primitives ───
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

const Signed = ({ n, d = 3 }) => (
  <span
    style={{
      color: tone(n),
      fontFamily: FONT_MONO,
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {fmtSigned(n, d)}
  </span>
);

// ─── 5Y mini chart ───
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
    </div>
  );
}

// ─── Featured 1Y daily big chart ───
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
              tickFormatter={(v) => v > 10000 ? `${(v / 1000).toFixed(0)}k` : fmt(v, 1)}
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

// ─── Indices group ───
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
              style={{ background: i % 2 === 0 ? "transparent" : "rgba(26, 31, 46, 0.025)" }}
            >
              <div className="cell">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, lineHeight: 1.15 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 10.5, color: PALETTE.muted, marginTop: 2 }}>{r.sub}</div>
                {r.note && <div className="mm-note-inline" style={{ fontSize: 10.5, marginTop: 6 }}>{r.note}</div>}
              </div>
              <div className="cell r">
                <div style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500 }}>
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

// ─── Macro barometer ───
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
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(26, 31, 46, 0.025)" }}
              >
                <div className="cell">
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, lineHeight: 1.2 }}>
                    {r.name}
                    <span className="mm-freq-badge">{r.freq}</span>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PALETTE.muted, marginTop: 3, letterSpacing: "0.05em" }}>
                    {r.id}
                  </div>
                </div>
                <div className="cell" style={{ fontSize: 11.5, color: PALETTE.muted, lineHeight: 1.4 }}>{r.desc}</div>
                <div className="cell r">
                  <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500 }}>
                    {fmt(r.value, 3)}{r.unit === "%" ? "%" : ""}
                  </div>
                </div>
                <div className="cell r"><Signed n={r.diff1d} /></div>
                <div className="cell r"><Signed n={r.diff7d} /></div>
                <div className="cell r"><span className="mm-asof">{fmtDay(r.asOf)}</span></div>
              </div>
            ))}
          </div>
          <div className="mm-cards">
            {g.rows.map((r, i) => (
              <div key={i} className="mm-card">
                <div className="mm-card-head">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mm-card-name">
                      {r.name}<span className="mm-freq-badge">{r.freq}</span>
                    </div>
                    <div className="mm-card-sub">{r.desc}</div>
                    <div className="mm-card-asof">{r.id} · As of {fmtDay(r.asOf)}</div>
                  </div>
                  <div className="mm-card-close">{fmt(r.value, 3)}</div>
                </div>
                <div className="mm-card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1D</span><Signed n={r.diff1d} /></div>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1W</span><Signed n={r.diff7d} /></div>
                  <div className="mm-card-cell"><span className="mm-card-cell-label">1M</span><Signed n={r.diff30d} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───
export default function MarketMonitor() {
  const [market, setMarket] = useState(null);
  const [news, setNews] = useState(null);
  const [macro, setMacro] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const safe = (p) => p.catch((e) => { console.warn(e); return null; });
    Promise.all([
      fetch(MARKET_URL).then((r) => { if (!r.ok) throw new Error(`market.json: ${r.status}`); return r.json(); }),
      fetch(NEWS_URL).then((r) => { if (!r.ok) throw new Error(`news.json: ${r.status}`); return r.json(); }),
      safe(fetch(MACRO_URL).then((r) => { if (!r.ok) throw new Error(`macro.json: ${r.status}`); return r.json(); })),
      safe(fetch(FEATURED_URL).then((r) => { if (!r.ok) throw new Error(`featured.json: ${r.status}`); return r.json(); })),
    ])
      .then(([m, n, ma, f]) => { setMarket(m); setNews(n); setMacro(ma); setFeatured(f); })
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

  return (
    <div className="mm-root">
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

      {/* I. Featured charts */}
      {featured?.featured && featured.featured.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div className="mm-section-tag">I. 本日の注目チャート</div>
          <div className="mm-section-head"><em>Claude AI が選ぶ、</em> 今日見るべき3本。</div>
          <div className="mm-section-lede">
            直近のニュース文脈から、今日のマーケットを理解するうえで押さえておくべきチャートを AI が選定。1年日次データで最近の動きを細かく表示。
          </div>
          <div className="mm-featured-grid">
            {featured.featured.map((p, i) => <FeaturedChart key={i} pick={p} />)}
          </div>
        </div>
      )}

      {/* II. Indices */}
      <div style={{ marginBottom: 12 }}>
        <div className="mm-section-tag">II. 昨日の主要市場</div>
        <div className="mm-section-head"><em>{news.headline_of_the_day || "—"}</em></div>
        <div className="mm-section-lede">
          株式・為替・金利・コモディティ・ボラティリティの引値と、1日/1週/1ヶ月/6ヶ月のリターン。
          最新データ取得: {fmtDate(market.generatedAt)}
        </div>
      </div>
      {byGroup.map((g, i) => <IndicesGroup key={i} title={g.title} rows={g.rows} />)}

      {/* III. Macro barometer */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">III. マクロ・バロメーター</div>
        <div className="mm-section-head"><em>FRED 10指標で読む、</em> 地合いの温度。</div>
        <div className="mm-section-lede">
          St. Louis Fed の FRED から取得した<strong>金利・期待</strong>、<strong>信用市場</strong>、<strong>金融環境</strong>、<strong>為替・実物</strong>の代表指標。週次バッジは更新頻度が週次であることを示す。
          {macro?.generatedAt && <>{" "}取得: {fmtDate(macro.generatedAt)}</>}
        </div>
        <MacroBarometer macro={macro} />
      </div>

      {/* IV. 5Y charts */}
      <div style={{ marginTop: 48, marginBottom: 24 }}>
        <div className="mm-section-tag">IV. 重要指標・5年チャート</div>
        <div className="mm-section-head"><em>俯瞰で見る、</em> 5年の地殻変動。</div>
        <div className="mm-section-lede">
          主要指標の月末値推移。<span style={{ color: PALETTE.accent, fontWeight: 600 }}>● 橙破線</span>
          は2026年2月末の米・イラン紛争開始点。
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="日経平均"      sub="¥ · JPY"     data={market.history.nikkei} current={market.history.nikkei?.at(-1)?.v} decimals={0} highlight="2026-02" />
          <MiniChart title="S&P 500"       sub="INDEX · USD" data={market.history.sp500}  current={market.history.sp500?.at(-1)?.v}  decimals={0} highlight="2026-02" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="USD/JPY"       sub="ドル円"       data={market.history.usdjpy} current={market.history.usdjpy?.at(-1)?.v} decimals={1} highlight="2026-02" />
          <MiniChart title="米10年債利回り" sub="%"           data={market.history.us10y}  current={market.history.us10y?.at(-1)?.v}  decimals={2} highlight="2026-02" />
        </div>
        <div className="mm-chart-grid">
          <MiniChart title="WTI原油"       sub="$ / bbl"     data={market.history.wti}    current={market.history.wti?.at(-1)?.v}    decimals={0} unit="$" highlight="2026-02" />
          <MiniChart title="金 (COMEX)"    sub="$ / oz"      data={market.history.gold}   current={market.history.gold?.at(-1)?.v}   decimals={0} unit="$" highlight="2026-02" />
        </div>
      </div>

      {/* V. News */}
      <div style={{ marginTop: 56 }}>
        <div className="mm-section-tag">V. 市場を動かしたニュース</div>
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

      {/* Market Muse (3 cards) */}
      {museStories.length > 0 && (
        <div>
          <div className="mm-muse-header">
            <div className="mm-section-tag">♔ Market Muse</div>
            <div className="mm-section-head"><em>今日のひとひら、</em> 三片。</div>
            <div className="mm-section-lede">皮肉・人間味・観察——市場を眺めるときの三つのレンズ。</div>
          </div>
          <div className="mm-muse-grid">
            {museStories.map((s, i) => (
              <div key={i} className="mm-muse-card">
                {s.kind && <div className="mm-muse-kind">— {s.kind}</div>}
                <div className="mm-muse-title">{s.title}</div>
                <div className="mm-muse-body">{s.body}</div>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="mm-muse-link">
                    {s.source || "ネタ元"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: `3px double ${PALETTE.borderStrong}`, margin: "48px 0 20px 0" }} />
      <div className="mm-footer">
        <span>DATA: yfinance · FRED · NEWS: Claude API summarized from RSS</span>
        <span>Auto-updated daily 07:00 JST · GitHub Actions</span>
        <span>EOD · {latestAsOf}</span>
      </div>
    </div>
  );
}
