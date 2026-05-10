// =====================================================
// utils.js — 純関数ユーティリティ (v13.1 で MarketMonitor.jsx から切り出し)
// =====================================================
//
// MarketMonitor.jsx 内に散らばっていた数値・日付フォーマット関数を集約。
// すべて純関数で副作用なし。Recharts の tickFormatter でも使える。
//

import { PALETTE } from "@/theme";

// --- 数値フォーマット ---

/** 一般数値: 千の区切り + 小数桁 (n が null/undefined なら "—") */
export const fmt = (n, d = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** パーセント: 符号付き、小数2桁固定 (例: +1.23%) */
export const fmtPct = (n) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

/** 符号付き数値: bp や差分の表示用 (例: +0.123) */
export const fmtSigned = (n, d = 3) => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(d)}`;
};

// --- 日付フォーマット ---

/** ISO → JST の "YYYY/MM/DD HH:MM" */
export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/** ISO/日付文字列の先頭10文字 (= YYYY-MM-DD) を抜き出す。短すぎる場合はそのまま返す */
export const fmtDay = (iso) => {
  if (!iso) return "—";
  if (iso.length >= 10) return iso.slice(0, 10);
  return iso;
};

// --- 色判定 ---

/** 数値の符号に応じて up/down/flat の色 (PALETTE) を返す */
export const tone = (n) =>
  n == null ? PALETTE.flat : n > 0 ? PALETTE.up : n < 0 ? PALETTE.down : PALETTE.flat;

// --- Promise ヘルパー ---

/** fetch エラーで全体を落とさず null を返す。Promise.all と組み合わせて部分失敗を許容する */
export const safe = (p) => p.then((x) => x).catch(() => null);
