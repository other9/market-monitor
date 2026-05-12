// =====================================================
// FundingVolSection.jsx — 4. ボラティリティ・ファンディング
// =====================================================
//
// VIX 期間構造 (3M÷1M)、MOVE (国債ボラ)、SOFR-IORB スプレッド (米短期市場逼迫) の
// 3 カードでクロスアセット・ボラ&流動性レジームを可視化。
//
// props:
//   market — market.json (VIX/VIX 3M/MOVE を indices から引く)
//   macro  — macro.json (SOFR/IORB を indicators から引く)
//
// v13.1.3 で MarketMonitor.jsx から切り出し。挙動・見た目は不変。
//

import React from "react";
import { SectionHeader, GroupHeader } from "@/components/common";
import { fmt, fmtPct } from "@/utils";

function FundingVolPanel({ market, macro }) {
  if (!market || !market.indices) return null;

  const findInst = (name) => market.indices.find((r) => r.name === name);
  const vix    = findInst("VIX");
  const vix3m  = findInst("VIX 3M");
  const move   = findInst("MOVE");
  const findMacro = (id) => (macro?.indicators || []).find((r) => r.id === id);
  const sofr = findMacro("SOFR");
  const iorb = findMacro("IORB");

  // VIX term structure ratio (>1 = contango = リスクオン, <1 = backwardation = リスクオフ)
  const vixRatio = vix?.close && vix3m?.close ? vix3m.close / vix.close : null;
  const vixRegime = vixRatio == null ? null : vixRatio < 1.0 ? "BACKWARDATION" : vixRatio < 1.10 ? "FLAT" : "CONTANGO";

  // SOFR - IORB spread (bp). 通常はマイナス〜ゼロ近辺、プラスはファンディング逼迫
  const fundingSpread = sofr?.value != null && iorb?.value != null
    ? Math.round((sofr.value - iorb.value) * 100)  // basis points
    : null;
  const fundingState = fundingSpread == null ? null
    : fundingSpread > 5 ? "STRESSED"
    : fundingSpread > -5 ? "NEUTRAL"
    : "EASY";

  const cards = [
    {
      label: "VIX 期間構造 (3M ÷ 1M)",
      value: vixRatio,
      decimals: 3,
      regime: vixRegime,
      regimeMap: { CONTANGO: "up", FLAT: "flat", BACKWARDATION: "down" },
      desc: vixRatio == null ? "—"
        : vixRatio < 1.0
          ? "バックワーデーション。短期不安が中期を上回る、リスクオフ警戒"
          : vixRatio < 1.10
            ? "フラット。市場は中立、テールリスクは織り込み中"
            : "コンタンゴ。短期は静か、市場はリスクオン姿勢",
      sub: vix && vix3m ? `VIX ${fmt(vix.close, 2)} / 3M ${fmt(vix3m.close, 2)}` : "data unavailable",
    },
    {
      label: "MOVE (国債ボラ指数)",
      value: move?.close,
      decimals: 1,
      regime: move?.close == null ? null
        : move.close > 130 ? "ELEVATED"
        : move.close > 100 ? "NORMAL"
        : "CALM",
      regimeMap: { ELEVATED: "down", NORMAL: "flat", CALM: "up" },
      desc: move?.close == null ? "—"
        : move.close > 130
          ? "国債ボラ高水準、金利の方向観に確信なし"
          : move.close > 100
            ? "通常レンジ。Fed パスは織り込み済み"
            : "国債ボラ低位、低ボラ環境",
      sub: move?.day != null ? `1日: ${fmtPct(move.day)}` : "",
    },
    {
      label: "SOFR − IORB (bp)",
      value: fundingSpread,
      decimals: 0,
      unit: "bp",
      regime: fundingState,
      regimeMap: { STRESSED: "down", NEUTRAL: "flat", EASY: "up" },
      desc: fundingSpread == null ? "—"
        : fundingSpread > 5
          ? "ファンディング逼迫の早期シグナル。準備預金不足の可能性"
          : fundingSpread > -5
            ? "中立水準。米短期市場は機能正常"
            : "潤沢な準備、ドル流動性緩和的",
      sub: sofr && iorb ? `SOFR ${fmt(sofr.value, 3)} / IORB ${fmt(iorb.value, 3)}` : "",
    },
  ];

  return (
    <div style={{ marginTop: 36, marginBottom: 32 }}>
      <GroupHeader title="ボラティリティ・ファンディング" marker="▽ stress detectors" style={{ marginTop: 0 }} />
      <div className="mm-fundvol-grid">
        {cards.map((c, i) => {
          const regimeKey = c.regime ? c.regimeMap[c.regime] : "flat";
          return (
            <div key={i} className={`mm-fundvol-card mm-fundvol-${regimeKey}`}>
              <div className="mm-fundvol-label">{c.label}</div>
              <div className="mm-fundvol-value">
                {c.value != null
                  ? `${c.value > 0 && c.unit === "bp" ? "+" : ""}${fmt(c.value, c.decimals)}${c.unit ? c.unit : ""}`
                  : "—"}
              </div>
              {c.regime && <div className={`mm-fundvol-regime regime-${regimeKey}`}>{c.regime}</div>}
              <div className="mm-fundvol-desc">{c.desc}</div>
              {c.sub && <div className="mm-fundvol-sub">{c.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FundingVolSection({ market, macro }) {
  return (
    <div style={{ marginTop: 48, marginBottom: 24 }}>
      <SectionHeader>4. ボラティリティ・ファンディング</SectionHeader>
      <div className="mm-section-head"><em>クロスアセットのボラ・レジーム、</em> 流動性逼迫の早期警報。</div>
      <div className="mm-section-lede">
        VIX 期間構造でリスクオン/オフ、MOVE で国債ボラ、SOFR-IORB スプレッドで米短期市場のファンディング状況を読む。
        東京の機関投資家にとって、円ヘッジコストや海外債券判断の前提となる3指標。
      </div>
      <FundingVolPanel market={market} macro={macro} />
    </div>
  );
}
