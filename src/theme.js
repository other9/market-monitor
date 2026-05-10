// =====================================================
// theme.js — UI トークン
// =====================================================
//
// このファイルは Recharts や inline style で JS から色を直接参照する箇所のみで使う。
// UI 全体のスタイルは src/index.css の CSS 変数 (:root) で管理する。
//
// !! 重要: PALETTE の各値は src/index.css の :root と必ず一致させること !!
// 不整合が起きるとセクター・ヒートマップや Recharts の色が UI と噛み合わない。
//
// 履歴:
//   v12.2: バーガンディ→ブルー、銅→セージティールに変更
//   v13.1.0: MarketMonitor.jsx から PALETTE/FONT_MONO/CHART_UNIVERSE_LABELS を切り出し
//   v13.1.1: CHART_UNIVERSE_LABELS の内容を実機のものと完全一致するよう修正
//            (us02y のラベル、vix3m/move/emoas の追加漏れを修正)
//

export const PALETTE = {
  bg:           "#F5F1E8",
  panel:        "#FFFFFF",
  fg:           "#1A1F2E",
  muted:        "#5C6373",
  dim:          "#9BA0AB",
  accent:       "#1A4D7A", // v12.2 deep blue
  accent2:      "#4A6E6A", // v12.2 sage teal
  border:       "#D4CDB8",
  borderStrong: "#1A1F2E",
  up:           "#2D6A4F",
  down:         "#C0392B",
  flat:         "#5C6373",
};

export const FONT_MONO = "'JetBrains Mono', 'Menlo', ui-monospace, monospace";

// Deep Dive の related_keys 表示などで key→日本語名を引くためのテーブル。
// chart_universe.py の universe と対応。新しい銘柄を追加する時は両方に追加すること。
export const CHART_UNIVERSE_LABELS = [
  { key: "nikkei",  name: "日経平均" },
  { key: "topix",   name: "TOPIX" },
  { key: "sp500",   name: "S&P 500" },
  { key: "nasdaq",  name: "NASDAQ" },
  { key: "dow",     name: "Dow Jones" },
  { key: "russell", name: "Russell 2000" },
  { key: "sox",     name: "SOX (半導体)" },
  { key: "hsi",     name: "ハンセン" },
  { key: "usdjpy",  name: "USD/JPY" },
  { key: "eurjpy",  name: "EUR/JPY" },
  { key: "eurusd",  name: "EUR/USD" },
  { key: "dxy",     name: "ドル指数 (DXY)" },
  { key: "wti",     name: "WTI原油" },
  { key: "brent",   name: "Brent原油" },
  { key: "gold",    name: "金" },
  { key: "silver",  name: "銀" },
  { key: "copper",  name: "銅" },
  { key: "btc",     name: "ビットコイン" },
  { key: "us10y",   name: "米10年債" },
  { key: "us02y",   name: "米2年債" },
  { key: "us30y",   name: "米30年債" },
  { key: "vix",     name: "VIX" },
  { key: "vix3m",   name: "VIX 3M" },
  { key: "move",    name: "MOVE" },
  { key: "t10y2y",  name: "10Y-2Yスプレッド" },
  { key: "t10yie",  name: "10年ブレークイーブン" },
  { key: "dfii10",  name: "10年実質金利" },
  { key: "hyoas",   name: "HY社債スプレッド" },
  { key: "igoas",   name: "IG社債スプレッド" },
  { key: "emoas",   name: "EM社債スプレッド" },
  { key: "nfci",    name: "Chicago Fed金融環境" },
  { key: "stlfsi",  name: "St. Louis金融ストレス" },
  { key: "sofr",    name: "SOFR" },
  { key: "iorb",    name: "IORB" },
  { key: "dxy_bgs", name: "ドル指数 (広義)" },
  { key: "natgas",  name: "天然ガス" },
  { key: "psp",     name: "Listed PE (PSP)" },
  { key: "bizd",    name: "BDC (BIZD)" },
  { key: "ifra",    name: "上場インフラ (IFRA)" },
  { key: "vnq",     name: "米REIT (VNQ)" },
  { key: "j_reit",  name: "東証REIT (1343)" },
];
