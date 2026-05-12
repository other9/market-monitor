// =====================================================
// CentralBanksSection.jsx — 6. 中央銀行ウォッチ
// =====================================================
//
// Fed/ECB/BOJ + 日替わり1中銀の 4 カードで政策金利・直近変更・コメントを表示。
//
// props:
//   watch       — news.central_bank_watch 配列 (各要素 { code, comment })
//   factsByCode — central_banks.json から作る { CODE: factsObject } マップ
//
// v13.1.3 で MarketMonitor.jsx の `CentralBankWatch` から移動・リネーム。挙動・見た目は不変。
//

import React from "react";
import { SectionHeader } from "@/components/common";
import { fmt } from "@/utils";

export function CentralBanksSection({ watch, factsByCode }) {
  if (!watch || watch.length === 0) return null;

  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <SectionHeader>6. 中央銀行ウォッチ</SectionHeader>
      <div className="mm-section-head"><em>Fed・ECB・BOJ + α、</em> 政策の今を読む。</div>
      <div className="mm-section-lede">
        主要3中銀 (Fed, ECB, BOJ) は常設、4枚目は<strong>その日のニュース文脈で日替わり</strong>に選定。
        各カードの解説はAIが直近の決定・要人発言・市場の見方を織り込んで一文で整理。
      </div>

      <div className="mm-cb-grid">
        {watch.map((cb, i) => {
          const facts = factsByCode[cb.code] || {};
          const isRotating = facts.always_show === false;
          return (
            <div key={i} className={`mm-cb-card ${isRotating ? "rotating" : ""}`}>
              {isRotating && <span className="mm-cb-rotating-badge">▲ 日替わり</span>}
              <div className="mm-cb-head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mm-cb-name">{facts.name || cb.code}</div>
                  <div className="mm-cb-country">{facts.country || ""}</div>
                </div>
                {facts.rate_value != null && (
                  <div className="mm-cb-rate">
                    <div className="mm-cb-rate-val">{fmt(facts.rate_value, 2)}%</div>
                    <div className="mm-cb-rate-name">{facts.rate_name || "Policy Rate"}</div>
                  </div>
                )}
              </div>

              {cb.comment && (
                <div className="mm-cb-comment">{cb.comment}</div>
              )}

              <div className="mm-cb-meta">
                {facts.next_meeting_hint && (
                  <span className="mm-cb-meta-item">頻度: <strong>{facts.next_meeting_hint}</strong></span>
                )}
                {facts.last_change && facts.last_change_date && (
                  <span className="mm-cb-meta-item">
                    直近の変更: <strong>{facts.last_change}</strong> ({facts.last_change_amount > 0 ? "+" : ""}{facts.last_change_amount}%, {facts.last_change_date})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
