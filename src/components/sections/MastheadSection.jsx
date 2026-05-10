// =====================================================
// MastheadSection.jsx — 新聞風ヘッダ部 (Masthead + Epigraph + Ticker)
// =====================================================
//
// 紙面トップの 3 ブロックをひとまとめにした薄いコンポーネント。
//   - Masthead: タイトル飾り + 日付 + 大見出し (lede)
//   - Epigraph: news.epigraph があれば引用ブロック
//   - Ticker:   日経 / S&P 500 / USD/JPY / WTI の 4 セル
//
// props:
//   news    — news.json オブジェクト (headline_of_the_day, epigraph)
//   market  — market.json オブジェクト (indices から ticker を抽出)
//
// v13.1.2 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE } from "@/theme";
import { fmt } from "@/utils";
import { Pct } from "@/components/common";

export function MastheadSection({ news, market }) {
  // 日付・最新営業日
  const nowJst = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  const asOfList = market.indices.map((i) => i.asOf).filter(Boolean).sort();
  const latestAsOf = asOfList.at(-1) || "—";

  // Ticker 4 セル
  const pickTicker = (name) => market.indices.find((r) => r.name === name);
  const tickerCells = [
    { n: "日経平均", data: pickTicker("日経平均") },
    { n: "S&P 500", data: pickTicker("S&P 500") },
    { n: "USD/JPY", data: pickTicker("USD/JPY") },
    { n: "WTI",     data: pickTicker("WTI原油") },
  ];

  return (
    <>
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
    </>
  );
}
