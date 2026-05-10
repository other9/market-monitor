# Roadmap — Market Monitor

土台拡充フェーズ (v13 系) と将来構想 (v14+) の方針を記録する。
バージョンが進むたびに、完了したものは「✅ 完了」マークを付け、
変更があれば該当バージョンを編集する。

最終更新: 2026-05-10 (v13.3 リリース時)

---

## 現状認識 (v13.3 完了時点)

Market Monitor は v12 系で機能拡充がひと段落し、

- セクション 9 つ + 補助セクション (Deep Dive、Economic、Alternatives、Muse) の本体
- 平日/週末/月初の cadence 切替で生成内容を変える Deep Dive
- Stale Data 警告と archive レイヤで運用品質と歴史性を担保
- Listed Alternatives Proxies で機関投資家用途に対応
- Funding & Volatility パネルで円ヘッジ・海外債券判断の前提を可視化
- ブルー×グリーンの機関投資家トーン (v12.2)

を備えた状態にある。これ以降は **新機能より土台整備を 1 ラウンド入れる** 方針。

### 客観評価サマリ (Claude による所見, 2026-05-09)

| 観点 | 評価 |
|------|------|
| データ層と UI 層の疎結合 | A |
| 意思決定の追跡可能性 (DECISIONS.md) | A |
| ドキュメント整備 | A- |
| コスト効率 | A |
| 運用品質の担保 | B+ |
| フロント保守性 (1500 行単一 JSX) | B → 分割で A 化目標 |
| Python 共通化 | C → v13.0 で C+, v13.1 で B 化目標 |
| エラーハンドリング統一性 | C → 共通ロガー導入で B 化 |
| データソース冗長性 (yfinance 単一依存) | C → v14 課題 |
| テスト | D → v13.0 で D+, 今後 C へ |

---

## v13.0 — 共通基盤の足場 ✅ 完了

**目的**: コード重複を解消する仕組みを導入し、改修フローを定着させる。動作は変えない。

- [x] `scripts/common.py` 新設 — FRED API 呼び出し / yfinance MultiIndex 吸収 / 共通ロガー / 日付ヘルパー
- [x] `scripts/take_snapshot.sh` — 改修確認用 zip を 1 コマンド化
- [x] `tests/` ディレクトリと最小 pytest (`extract_close_series`, 日付ヘルパー, ロガー, `determine_cadence`)
- [x] `.github/workflows/daily-update.yml` に Python smoke test ステップ追加
- [x] `requirements.txt` に `pytest` 追加
- [x] README にトラブルシュート章を厚く
- [x] `ROADMAP.md` 新設 (この文書)

**意図的にやらなかったこと**: 既存 `fetch_*.py` のリファクタは v13.0 では行わない。
`common.py` の関数を呼ぶ形への置換は v13.3 以降で慎重に行う。
リスク管理として「土台を作る」と「土台に乗せ替える」を分離。

---

## v13.1 — フロントのコンポーネント分割 (中リスク・大効果)

**目的**: `MarketMonitor.jsx` (約 1500 行) をセクション単位で分割し、
セクション単位の改修・AI 補助の精度を上げる。

### 進捗

ROADMAP 当初の「3〜4 段階」を **4 段** に確定 (詳細は `DECISIONS.md` v13.1-02, v13.1.2-01)。

#### v13.1.0 — 土台ファイル新設 ✅ 完了 (2026-05-10)

- [x] `vite.config.js` に `@/` → `src/` のエイリアス追加
- [x] `src/theme.js` 新設 — `PALETTE` / `FONT_MONO` / `CHART_UNIVERSE_LABELS`
- [x] `src/utils.js` 新設 — `fmt` / `fmtPct` / `fmtSigned` / `tone` / `fmtDate` / `fmtDay` / `safe`
- [x] `src/components/common/` 新設 — `Pct.jsx` / `Signed.jsx` / `MiniChart.jsx` / `StaleDataWarning.jsx` + barrel `index.js`
- [x] `MarketMonitor.jsx` は **不変** (新ファイルは未使用、tree-shaking で除外されるためバンドル不変)

#### v13.1.1 — MarketMonitor.jsx の import 付け替え ✅ 完了 (2026-05-10)

- [x] 冒頭インライン定義 (`PALETTE`, `FONT_MONO`, `CHART_UNIVERSE_LABELS`, formatters, `Pct`, `Signed`, `MiniChart`, `StaleDataWarning`) を削除
- [x] `@/utils`, `@/theme`, `@/components/common` から import に書き換え
- [x] JSX 本体および各セクション関数 (`FeaturedChart`, `IndicesGroup`, `MacroBarometer`, ...) は不変
- [x] **副次的バグ修正**: v13.1.0 の `theme.js` で `CHART_UNIVERSE_LABELS` の内容が実機と不一致だった問題を修正
- [x] 行数削減: 1513 → 1263 行 (-250)

#### v13.1.2 — セクションコンポーネント切り出し Phase 1 ✅ 完了 (2026-05-10)

「独立性の高いセクションから先に」方針で、6 つを `src/components/sections/` に切り出し。
挙動・見た目は完全不変 (ロジックの単純な lift-and-shift)。

- [x] `MastheadSection.jsx` 新設 — Masthead + Epigraph + Ticker (3 ブロック統合、`nowJst`/`latestAsOf`/`tickerCells` を内包化)
- [x] `EconomicChartSection.jsx` 新設 — 既存 `EconomicChart` を移動
- [x] `DeepDiveSection.jsx` 新設 — 既存 `DeepDive` を移動
- [x] `AlternativesSpotlightSection.jsx` 新設 — `ALT_IMPACT_CONFIG` + `AltCategoryCard` + `AlternativesSection` をまとめて移動
- [x] `MarketMuseSection.jsx` 新設 — inline JSX → コンポーネント化、`museStories` 算出ロジックを内包
- [x] `FooterSection.jsx` 新設 — inline JSX → コンポーネント化、`version` プロップ予約 (default `"v13.0"` で挙動不変)
- [x] `src/components/sections/index.js` (barrel) 新設
- [x] `MarketMonitor.jsx` から該当ブロックを削除し、import + 呼び出しに置換
- [x] 行数削減: 1263 → 959 行 (-304)
- [x] 依存方向 [DECISION v13.1-03] の単方向ルール維持を grep で検査済

#### v13.1.3 — セクションコンポーネント切り出し Phase 2 ✅ 完了 (2026-05-10)

残り 10 セクションを切り出し、`MarketMonitor.jsx` を 200 行のオーケストレータに収束 (実際は 134 行 まで縮んだ)。

```
sections/
├── FeaturedChartsSection.jsx        (1, FeaturedChart 内包)
├── MarketTableSection.jsx           (2, IndicesGroup 内包)
├── SectorHeatmapSection.jsx         (2 sub, period state を内包)
├── MacroBarometerSection.jsx        (3)
├── FundingVolSection.jsx            (4, FundingVolPanel 内包)
├── ValuationsSection.jsx            (5, ValuationSection をリネーム)
├── CentralBanksSection.jsx          (6, CentralBankWatch をリネーム)
├── IndicatorChartsSection.jsx       (7, inline JSX → 新規抽出)
├── NewsSection.jsx                  (8, inline JSX → 新規抽出)
└── ListedAltsSection.jsx            (9, ListedAltsPanel + ListedAltCard 内包)
```

行数推移: 1513 (v13.0) → 1263 (v13.1.1) → 959 (v13.1.2) → **134 (v13.1.3)** = -91%

完成形では `MarketMonitor.jsx` は薄いオーケストレータ:
- URL 定数定義
- `useEffect` でのデータ取得 (Promise.all)
- 16 セクションを props 経由で並べる JSX

### 依存方向の規則 (v13.1-03)

```
theme.js (依存なし)
  ← utils.js
    ← components/common/*
      ← components/sections/*
        ← MarketMonitor.jsx
```

逆方向の import を見つけたら設計ミスのシグナル。
`grep -r "from \"@/components/sections" src/{utils.js,theme.js,components/common}` で違反検出可能。

### 期待効果

- 「Funding/Vol セクションだけ修正してほしい」のような依頼の精度向上 ✅
- ファイル単位の git diff が読みやすくなる ✅
- 将来のテスト追加時、コンポーネント単位でテスト可能 ✅

---

## v13.2 — Claude API 呼び出しの分割 ✅ 完了 (2026-05-10)

**目的**: 1 回の Claude API 呼び出しに詰め込んでいた 9 種類のコンテンツ生成を、
4 つの呼び出しに分割。役割専用 prompt とモデル使い分けで品質と費用効率を改善。

### 実装内容

| 呼び出し | 内容 | モデル | max_tokens |
|---------|------|-------|-----------|
| `call_news_and_charts` | epigraph + headline + news(7) + charts_of_the_day | claude-opus-4-7 | 3500 |
| `call_deep_dive` | deep_dive (cadence 切替) | claude-opus-4-7 | 2500 |
| `call_cb_and_alts` | central_bank_watch + pe_pd_view + real_assets_view | claude-sonnet-4-6 | 2500 |
| `call_muse_and_economic` | funny_stories + economic_chart_of_the_day | claude-haiku-4-5 | 1500 |

### 主要設計判断

- **失敗の独立性**: 各 try/except で独立処理。1 つ失敗しても他は生成される
  ([DECISION v13.2-01])
- **`_call_claude` ヘルパ**: 4 callers の共通処理 (msg.create + JSON 抽出 + parse + ログ) を統合
- **`run_all_calls` orchestrator**: 4 つを sequential 実行、各失敗を独立 catch
- **JSON schema 不変**: 出力 `data/news.json` のキー構成は v7 と完全に同じ (フロント影響なし)
- **fallback dict**: 失敗時のために `_FALLBACK_*` モジュール定数を 4 つ用意

### コスト削減効果 (見込み)

- Muse + Economic を Haiku 4.5 に切替で対象部分のコスト 1/15
- 月額 ~1,600 円 → ~1,000〜1,200 円見込み (要モニタ)

---

## v13.3 — エラーハンドリング統一 + common.py 全面活用 ✅ 完了 (2026-05-10)

**目的**: 各 `fetch_*.py` を `scripts/common.py` の共通関数に乗せ替え、
コード重複と書式の揺れを解消する。

### 実装内容

| ファイル | 変更点 |
|---------|--------|
| `fetch_market_data.py` | inline `extract_close_series` 削除 → import に。`print` → `log_*` |
| `fetch_listed_alts.py` | 同上 |
| `fetch_macro_indicators.py` | inline FRED 直叩き → `fred_observations` ラッパに置換 |
| `fetch_central_banks.py` | 同上 |
| `fetch_economic_chart.py` | 同上 (+ metadata 取得は requests のまま) |
| `fetch_featured_charts.py` | 同上 + `extract_close_series` も置換 |
| `fetch_valuations.py` | 同上 (yfinance 部分も `extract_close_series` 化) |
| `fetch_news.py` | `print` → `log_*`、`datetime.now(JST)` → `jst_now()`、`utc_now_iso()` 利用 |
| `archive_data.py` | `jst_today_iso()` / `utc_now_iso()` / `log_*` 全面利用 |

### 期待効果

- Actions ログの可読性向上 (`[OK]/[WARN]/[SKIP]/[INFO]` 書式統一)
- FRED API クライアントを一箇所で管理 (将来のリトライ・タイムアウト調整が容易)
- yfinance MultiIndex 列吸収のロジックを1箇所に集約 (バグ修正の波及範囲を最小化)
- `extract_close_series` の動作テストは `tests/test_common.py` の 7 ケースで担保 (今後も全 fetch スクリプトに自動波及)

---

## v14+ — 本格機能追加と構造改革

### v14: archive 閲覧 UI

`?date=YYYY-MM-DD` のような URL パラメータで過去の Deep Dive を呼び出せる
UI を追加。`data/archive/` に蓄積されているデータを活用。

### v14.x: yfinance fallback

yfinance 単一依存を解消するための 2 系統化:
- 主: yfinance (現状維持)
- 副: Alpha Vantage (無料 25 calls/day) または Polygon.io (無料 5 calls/min)

主が失敗した銘柄だけ副で取得を試みる。

### v15: archive ストレージ問題への対処

`data/archive/` は 1 日 1 ディレクトリ × 8 ファイルずつ蓄積。
1 年運用で約 365 ディレクトリ × 8 = 約 3,000 ファイル。
リポジトリサイズ・clone 時間の問題が出る前に対処:

- 候補 A: 別リポジトリ `market-monitor-archive` に分離 (submodule or 単純な別レポ)
- 候補 B: git-lfs で保管
- 候補 C: 月単位で 1 つの zip にまとめる (`archive/2026-05.zip` のように)

判断は v15 着手時の運用実績を見て決める。

---

## サブエージェント機能の必要性 — 結論

(2026-05-09 議論時点の結論。状況変化があれば見直し)

| 用途 | 必要性 | 理由 |
|------|-------|------|
| **Claude Code subagents** (開発側) | 不要 | プロジェクト規模 (Python 10 本 / JSX 1 ファイル) で並列探索や code-reviewer subagent が要らない。コンポーネント分割後のファイル数増加 (v13.1 後) で再検討の余地 |
| **API multi-call 化** (= subagent 機能ではない) | あり | v13.2 で実装。詳細は上記 |
| **Anthropic Agent SDK subagents** | 不要 | 本プロジェクトは ETL パイプラインで、対話的 agent 機能の必要なし |

---

## 改善の基本姿勢

1. **動作を変えずに足場を作る** → **足場に乗せ替える** の順で 1 段ずつ
2. 改修ごとに `bash scripts/take_snapshot.sh` でスナップショットを取り、Claude 側で実機照合
3. 各バージョンの決定理由は `DECISIONS.md` に記録 (この ROADMAP は方針、DECISIONS は経緯)
4. PROJECT_INSTRUCTIONS.md は最新ステータスのみ書く (履歴は DECISIONS / ROADMAP)
5. 大きな改修は **新しい Claude チャット** で始める (context window 圧迫回避)
