// =====================================================
// ValuationsSection.jsx — 5. バリュエーション・ゲージ
// =====================================================
//
// Shiller CAPE / Buffett Indicator / Fed Model / 配当利回り / VVIX-VIX 比率を
// 表+カード+ミニチャートで表示。
//
// props:
//   valuations — valuations.json オブジェクト (`indicators` 配列, `generatedAt`)
//
// v13.1.3 で MarketMonitor.jsx の `ValuationSection` から移動・リネーム。挙動・見た目は不変。
//

import React from "react";
import { PALETTE, FONT_MONO } from "@/theme";
import { fmt, fmtSigned, fmtDate, fmtDay } from "@/utils";
import { Signed, MiniChart } from "@/components/common";

const GROUPS = ["米国バリュエーション", "ボラティリティ"];

export function ValuationsSection({ valuations }) {
  if (!valuations || !valuations.indicators || valuations.indicators.length === 0) {
    return null;
  }

  const indicators = valuations.indicators;
  const byGroup = GROUPS
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
