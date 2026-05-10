// =====================================================
// MacroBarometerSection.jsx — 3. マクロ・バロメーター
// =====================================================
//
// FRED 18 指標を「金利・期待」「信用市場」「金融環境」「為替・実物」の
// 4 グループに分けて表+カードで表示。
//
// props:
//   macro — macro.json オブジェクト (`indicators` 配列, `generatedAt` 文字列)
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt, fmtDate, fmtDay } from "@/utils";
import { Signed } from "@/components/common";

const GROUPS = ["金利・期待", "信用市場", "金融環境", "為替・実物"];

function MacroBarometerInner({ macro }) {
  if (!macro || !macro.indicators || macro.indicators.length === 0) {
    return <div style={{ color: PALETTE.muted, fontFamily: FONT_MONO, fontSize: 12, padding: "20px 0" }}>macro data unavailable</div>;
  }

  const byGroup = GROUPS
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

export function MacroBarometerSection({ macro }) {
  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <div className="mm-section-tag">3. マクロ・バロメーター</div>
      <div className="mm-section-head"><em>FRED 18指標で読む、</em> 地合いの温度。</div>
      <div className="mm-section-lede">
        St. Louis Fed の FRED から取得した<strong>金利・期待</strong>、<strong>信用市場</strong> (HY / IG / EM 社債スプレッド)、
        <strong>金融環境</strong>、<strong>為替・実物</strong>の代表指標。
        信用市場グループはプライベート・デットの絶対リターンを規定する公的市場の状態を映す。
        {macro?.generatedAt && <>{" "}取得: {fmtDate(macro.generatedAt)}</>}
      </div>
      <MacroBarometerInner macro={macro} />
    </div>
  );
}
