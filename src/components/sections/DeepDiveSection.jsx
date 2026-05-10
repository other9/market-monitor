// =====================================================
// DeepDiveSection.jsx — Claude が書く深掘り解説
// =====================================================
//
// 平日: 当日の Deep Dive 解説
// 土曜: 週次総括 (kicker が「週次総括」に変わる)
// 月初: 前月総括 (同上「月次総括」)
//
// props:
//   article       — news.deep_dive オブジェクト (title/lede/background/implications/...)
//   chartUniverse — CHART_UNIVERSE_LABELS (related_keys を日本語名に解決するため)
//   cadence       — { mode: "daily" | "weekly_review" | "monthly_review" }
//
// v13.1.2 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";

export function DeepDiveSection({ article, chartUniverse, cadence }) {
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
