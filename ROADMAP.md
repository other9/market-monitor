# Roadmap — Market Monitor

土台拡充フェーズ (v13 系) と将来構想 (v14+) の方針を記録する。
バージョンが進むたびに、完了したものは「✅ 完了」マークを付け、
変更があれば該当バージョンを編集する。

最終更新: 2026-05-10 (v13.1.2 リリース時)

---

## 現状認識 (v13.1.2 完了時点)

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

#### v13.1.3 — セクションコンポーネント切り出し Phase 2 (未着手)

残り 8 セクションを順次抽出 (依存ルール上、共通サブコンポーネントを共有するため Phase 1 より中リスク):

```
sections/
├── FeaturedChartsSection.jsx        (1 本日の注目チャート — FeaturedChart 内包)
├── MarketTableSection.jsx           (2 昨日の主要市場 — IndicesGroup 内包)
├── SectorHeatmapSection.jsx         (2 のサブ — SectorHeatmap)
├── MacroBarometerSection.jsx        (3 マクロ・バロメーター)
├── FundingVolSection.jsx            (4 ボラティリティ・流動性)
├── ValuationsSection.jsx            (5 バリュエーション・ゲージ)
├── CentralBanksSection.jsx          (6 中央銀行ウォッチ)
├── IndicatorChartsSection.jsx       (7 重要指標・5年チャート — inline JSX のため新規抽出)
├── NewsSection.jsx                  (8 市場を動かしたニュース — inline JSX のため新規抽出)
└── ListedAltsSection.jsx            (9 — ListedAltsPanel + ListedAltCard 内包)
```

完了時点で `MarketMonitor.jsx` は **200 行程度の薄いオーケストレータ** になる予定。

**v13.1.3 は新しいチャットで開始** (context window 圧迫回避)。
特に `FundingVolSection` と `ListedAltsSection` は Recharts チャート + 内部サブコンポーネントを抱えており、最後にやるのが安全。

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

- 「Funding/Vol セクションだけ修正してほしい」のような依頼の精度向上
- ファイル単位の git diff が読みやすくなる
- 将来のテスト追加時、コンポーネント単位でテスト可能

---

## v13.2 — Claude API 呼び出しの分割 (中リスク・コスト削減効果)

**目的**: 現在 `fetch_news.py` で 1 回の Claude API 呼び出しに詰め込んでいる
9 種類のコンテンツ生成を、4 つの呼び出しに分割。役割専用 prompt とモデル
使い分けで品質と費用効率を改善。

### 計画

| 呼び出し | 内容 | モデル | 想定 in/out tokens |
|---------|------|-------|-------------------|
| `call_news_and_charts` | ニュース 7 本選定+要約、注目チャート 3 候補 | Opus 4.7 | 入力 ~8k / 出力 ~2k |
| `call_deep_dive` | Deep Dive 解説 (土曜は週次総括) | Opus 4.7 | 入力 ~5k / 出力 ~2k |
| `call_central_banks_and_alts` | CB watch 4 行 + PE/PD/Real Assets コメント | Sonnet 4.6 | 入力 ~4k / 出力 ~1k |
| `call_muse_and_economic` | Muse 3 片 + 経済指標短評 | **Haiku 4.5** | 入力 ~2k / 出力 ~500 |

### メリット

- **失敗の独立性**: Deep Dive 失敗で全コンテンツが消える現状を回避
- **コスト削減**: Muse など軽い創作タスクを Haiku に切替で対象部分を 1/15 に
  - 月額 ~1,600 円 → ~1,000〜1,200 円見込み
- **品質向上**: 各呼び出しが専用 system prompt で迷いなく書ける

### デメリット

- 共通入力 (ニュースリスト等) の重複送信でトークンが少し増える
- 実装複雑度の増加 (4 つの戻り値を集約するロジック)

### サブエージェント機能との関係

これは Claude Code subagents や Anthropic Agent SDK subagents の機能を
**使うわけではない**。単なる Python の複数 API call 化。
理由は `DECISIONS.md` と本 README の議論を参照。

---

## v13.3 (任意) — エラーハンドリング統一

各 `fetch_*.py` を `scripts/common.py` の共通ロガーに完全移行する。
`try/except` の書式も統一し、Actions ログの可読性を上げる。

優先度低 (運用上、現状でも致命的問題はない)。

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
