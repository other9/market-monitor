// =====================================================
// MarketTableSection.jsx — 2. 昨日の主要市場
// =====================================================
//
// 株式・為替・金利・コモディティ・ボラティリティの引値と、1日/1週/1ヶ月/6ヶ月のリターン。
//
// 子要素:
//   IndicesGroup — 1グループ (例: 株式) を表+カードで表示する内部 helper
//
// props:
//   market — market.json オブジェクト (`indices` 配列, `generatedAt` 文字列)
//   news   — news.json オブジェクト (`headline_of_the_day` を見出しに使用)
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt, fmtDate, fmtDay } from "@/utils";
import { Pct } from "@/components/common";

const GROUPS = ["株式", "為替", "金利", "コモディティ", "ボラティリティ"];

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

export function MarketTableSection({ market, news }) {
  const byGroup = GROUPS
    .map((g) => ({ title: g, rows: market.indices.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div className="mm-section-tag">2. 昨日の主要市場</div>
        <div className="mm-section-head"><em>{news.headline_of_the_day || "—"}</em></div>
        <div className="mm-section-lede">
          株式・為替・金利・コモディティ・ボラティリティの引値と、1日/1週/1ヶ月/6ヶ月のリターン。
          最新データ取得: {fmtDate(market.generatedAt)}
        </div>
      </div>
      {byGroup.map((g, i) => <IndicesGroup key={i} title={g.title} rows={g.rows} />)}
    </>
  );
}
