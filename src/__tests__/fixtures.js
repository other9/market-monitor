// src/__tests__/fixtures.js — v13.4.1 で導入
//
// スナップショットテスト用の小さな代表データ。
// 各セクションの prop に合うミニマルな構造を提供。
// data/*.json から抜粋・縮小したもの。

// MarketTable 用
export const marketFixture = {
  generatedAt: "2026-05-12T08:00:00+09:00",
  indices: [
    { group: "株式", name: "日経平均", sub: "Nikkei 225", close: 38500.0, day: 0.45, week: 1.2, month: -0.8, sixM: 5.1, asOf: "2026-05-11" },
    { group: "株式", name: "S&P 500",  sub: "米国 500大企業", close: 5400.0, day: -0.3, week: 0.8, month: 2.5, sixM: 8.4, asOf: "2026-05-11" },
    { group: "為替", name: "USD/JPY", sub: "ドル円", close: 154.5, day: 0.1, week: -0.2, month: 0.9, sixM: 1.5, asOf: "2026-05-11" },
  ],
  sectors: [
    { ticker: "XLK", name: "Technology", short: "Tech", close: 220.5, day: 0.5, week: 1.0, month: 2.5, ytd: 12.4 },
    { ticker: "XLF", name: "Financials", short: "Fin",  close: 45.2,  day: -0.2, week: 0.3, month: 1.1, ytd: 6.5 },
  ],
};

// News 用
export const newsFixture = {
  generatedAt: "2026-05-12T08:00:00+09:00",
  epigraph: "テスト用のエピグラフ — 市場は静寂のなかに動いている。",
  headline_of_the_day: "テスト見出し — マーケットは慎重ムード",
  news: [
    { title: "サンプル記事1", summary: "市場の動きについての要約。", source: "Test Source", link: "https://example.com/1" },
    { title: "サンプル記事2", summary: "別の話題の要約。",         source: "Other Source", link: "https://example.com/2" },
  ],
  charts_of_the_day: [],
  funny_stories: [
    { kind: "ジョーク", title: "小話タイトル", body: "本文。", source: "Source", link: "https://example.com/joke" },
  ],
  deep_dive: {
    title: "Deep Dive タイトル",
    body: "Deep Dive 本文の段落。\n\n2 つ目の段落。",
    source: "Test",
    link: "https://example.com/dd",
    related_keys: ["nikkei", "sp500"],
  },
  central_bank_watch: [],
  pe_pd_view: null,
  real_assets_view: null,
};

// Featured charts 用
export const featuredFixture = {
  generatedAt: "2026-05-12T08:00:00+09:00",
  featured: [
    {
      label: "日経平均 (1Y)",
      sub: "Nikkei 225",
      history: [
        { d: "2025-05-12", v: 36000 },
        { d: "2025-08-12", v: 37000 },
        { d: "2025-11-12", v: 38000 },
        { d: "2026-02-12", v: 37500 },
        { d: "2026-05-11", v: 38500 },
      ],
    },
  ],
};

// Macro indicators 用
export const macroFixture = {
  generatedAt: "2026-05-12T08:00:00+09:00",
  indicators: [
    {
      group: "金利・期待",
      id: "DGS10",
      name: "米10年債利回り",
      description: "10-Year Treasury yield",
      value: 4.45,
      unit: "%",
      changes: { day: 0.02, week: -0.05, month: 0.12, year: 0.55 },
      history: [
        { d: "2025-05-12", v: 4.0 },
        { d: "2026-05-12", v: 4.45 },
      ],
    },
  ],
};

// Listed Alts 用
export const altsFixture = {
  generatedAt: "2026-05-12T08:00:00+09:00",
  assets: [
    {
      category: "PE",
      ticker: "PSP",
      name: "Invesco Global Listed PE",
      close: 14.5,
      day: 0.5, week: 1.2, month: 2.4, sixM: 8.0, ytd: 7.0,
      asOf: "2026-05-11",
      history: [
        { d: "2025-05-12", v: 13.5 },
        { d: "2026-05-12", v: 14.5 },
      ],
    },
  ],
};
