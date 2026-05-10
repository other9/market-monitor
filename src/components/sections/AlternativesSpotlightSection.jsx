// =====================================================
// AlternativesSpotlightSection.jsx — オルタナティブ・スポットライト
// =====================================================
//
// PE/PD と Real Assets (不動産・インフラ) の 2 カテゴリを、
// インパクト方向 (▲/■/▼) と一言サマリ + ソース付きで解説する。
//
// 子要素:
//   ALT_IMPACT_CONFIG — impact 値 → 見た目の対応表
//   AltCategoryCard   — カード 1 枚の描画コンポーネント
//
// props:
//   pePd       — news.pe_pd_view オブジェクト
//   realAssets — news.real_assets_view オブジェクト
//
// v13.1.2 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE } from "@/theme";

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

export function AlternativesSpotlightSection({ pePd, realAssets }) {
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
