// =====================================================
// MarketMuseSection.jsx — Market Muse (3片のユーモア小話)
// =====================================================
//
// Claude が書く 3 つの軽い小話 (皮肉 / 人間味 / 観察)。
// news.funny_stories (新形式) または news.funny_story (旧単数形 fallback) を表示。
//
// props:
//   news — news.json オブジェクト (funny_stories または funny_story を持つ)
//
// v13.1.2 で MarketMonitor.jsx の inline JSX から切り出し。挙動・見た目は不変。
//

import React from "react";

const KIND_FALLBACKS = ["皮肉", "人間味", "観察"];

export function MarketMuseSection({ news }) {
  const stories = news.funny_stories || (news.funny_story ? [news.funny_story] : []);
  if (stories.length === 0) return null;

  return (
    <div>
      <div className="mm-muse-header">
        <div className="mm-section-tag">▨ Market Muse</div>
        <div className="mm-section-head"><em>クスッと、</em> 市場の小話 三題。</div>
        <div className="mm-section-lede">市場の小話・観察・人間味の三題。</div>
      </div>
      <div className="mm-muse-grid">
        {stories.slice(0, 3).map((s, i) => (
          <div key={i} className="mm-muse-card">
            <div className="mm-muse-kind">— {s.kind || KIND_FALLBACKS[i] || "小話"}</div>
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
  );
}
