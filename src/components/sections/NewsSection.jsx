// =====================================================
// NewsSection.jsx — 8. 市場を動かしたニュース
// =====================================================
//
// Claude が選定した直近24時間の重要ニュース 7 本。
// 各カードは tag / headline / body / impact バッジ / 記事元リンク。
//
// props:
//   news — news.json オブジェクト (`news` 配列を持つ想定)
//
// v13.1.3 で MarketMonitor.jsx の inline JSX から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE, FONT_MONO } from "@/theme";

export function NewsSection({ news }) {
  const items = news?.news || [];
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 56 }}>
      <div className="mm-section-tag">8. 市場を動かしたニュース</div>
      <div className="mm-section-head"><em>Claude AIが選ぶ、</em> 本日の7本。</div>
      <div className="mm-section-lede">
        直近24時間の主要メディアから AI が選定した、マーケットに影響を与えた / 与えうる重要ニュース。
      </div>
      <div className="mm-news-grid">
        {items.map((n, i) => (
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
  );
}
