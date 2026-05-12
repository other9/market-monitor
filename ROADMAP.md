# Roadmap — Market Monitor

v13 系土台拡充フェーズ (v13.0–v13.3) の完了を踏まえ、業界標準対応 (Tier 1/2) と Japan Equities Layer (TOB / 小型株) の並行進行を基本方針とする。
バージョンが進むたびに、完了したものは「✅ 完了」マークを付け、変更があれば該当バージョンを編集する。

最終更新: 2026-05-12 (Phase 1 完了 — v13.4 + v13.5 全完了)

---

## 現状認識 (v13.3 完了時点)

v13 系統 (土台拡充フェーズ) が完了し、以下の状態に到達:

- セクション 9 つ + 補助セクション (Deep Dive、Economic、Alternatives、Muse) の本体
- 平日/週末/月初の cadence 切替で生成内容を変える Deep Dive
- Stale Data 警告と archive レイヤで運用品質と歴史性を担保
- Listed Alternatives Proxies で機関投資家用途に対応
- Funding & Volatility パネルで円ヘッジ・海外債券判断の前提を可視化
- ブルー×グリーンの機関投資家トーン
- **MarketMonitor.jsx**: 1513 行 → 134 行の薄いオーケストレータ + 16 セクションコンポーネント (v13.1 系)
- **Claude API 4 分割** (Opus×2 + Sonnet + Haiku) — 失敗の独立性とコスト効率 (v13.2)
- **全 fetch スクリプトが `scripts/common.py` を活用** (v13.3)
- **pytest 18 ケース** + Actions smoke test

### 客観評価サマリ (Phase 1 着手前時点)

| 観点 | 評価 | 備考 |
|------|------|------|
| データ層と UI 層の疎結合 | A | 維持 |
| 意思決定の追跡可能性 | A | DECISIONS.md の三層構造 |
| ドキュメント整備 | A | ROADMAP / DECISIONS / PROJECT_INSTRUCTIONS |
| コスト効率 | A+ | モデル使い分けで月 1,000–1,200 円 |
| 運用品質の担保 | A- | ログ統一 + pytest smoke 完了 |
| フロント保守性 | A | 134 行 + 16 セクション |
| Python 共通化 | A- | 全 fetch が common.py 利用 |
| エラーハンドリング統一性 | B+ | log_* / JST ヘルパ集約済 |
| **データソース冗長性** | C | yfinance 単一依存 (v14.x で対応) |
| **テスト** | C+ | 18 ケース (Phase 1 で B 化目標) |
| **Linter / 型チェック** | 未導入 | Phase 1 で導入 |
| **エラー監視** | 未導入 | Phase 2 で Sentry 導入 |
| **個人投資 (TOB/小型株) 機能** | 未着手 | Phase 2-3 で v16 系 |

---

## 基本方針 (Phase 1-5)

業界標準の最低水準対応 (Tier 1/2) と、kk の個人投資ニーズ (Japan Equities Layer) を交互に挟む構成。
Tier 3 (大規模開発標準のうち個人プロジェクトには過剰なもの) は明示的に「やらない」。

| Phase | 主眼 | バージョン |
|---|---|---|
| Phase 1: 業界標準の足場固め | 保守性・観測性の底上げ | v13.4, v13.5 |
| Phase 2: Japan Equities Layer 第一段 | 個人投資ニーズへの即応 | v16.0 |
| Phase 3: archive UI + Japan 拡張 | 蓄積資産活用 + TOB 機能 | v14.0, v16.1 |
| Phase 4: 大型構造改革 | AI 補助精度の本格向上 | v17.0 (TypeScript 移行) |
| Phase 5: 残務処理 | データ冗長化と運用課題 | v14.x, v16.2, v15 |

合計 9 リリース、8-10 ヶ月相当を見込む。
詳細な選定理由は `DECISIONS.md` の v13.4-plan-01 ~ v13.4-plan-05 を参照。

---

## v13.4 — リファクタウィンドウ + Tier 1 一括導入

**目的**: 業界標準の最低水準のうち、コスト低・効果大の項目を一括導入。次フェーズの新機能追加 (v16.0) の土台を整える。

v13.4 着手にあたり、context window と diff レビューの粒度を考慮して **3 段階に分割** する:

| サブバージョン | スコープ | ステータス |
|---|---|---|
| **v13.4.0** | Linter/Formatter 導入 + Dependabot + CI ワークフロー分離 | ✅ 完了 (2026-05-12) |
| **v13.4.1** | 共通 component 抽出 + Vitest スナップショット + mypy strict + B023 修正 | ✅ 完了 (2026-05-12) |
| **v13.4.2** | Python 統合テスト + RUNBOOK.md + ブランチ保護設定 + CODEOWNERS | ✅ 完了 (2026-05-12) |

### 実装内容 (v13.4 全体)

#### v13.4.0 で完了したもの
- [x] **Ruff** 導入 (Python: pycodestyle + pyflakes + isort + bugbear + pyupgrade + simplify + comprehensions + pie + ruff-specific)
- [x] **ESLint v9 flat config** 導入 (JS/JSX: react + react-hooks + react-refresh)
- [x] **Prettier** 導入 (config のみ、CI では check しない方針 — DECISION v13.4.0-05 参照)
- [x] **Dependabot** 設定 (`.github/dependabot.yml`、npm/pip/actions の週次 minor/patch 監視)
- [x] **CI ワークフロー新設** (`.github/workflows/ci.yml`、PR + non-main push で発火)
- [x] **`daily-update.yml` に Ruff lint ステップ追加** (main 直 push でも lint 違反を検知)
- [x] **`ruff check --fix` の自動修正適用** (45 件、import 並び替え + 未使用 import 削除 + `datetime.UTC` 化)

#### v13.4.1 で完了したもの
- [x] **共通 component 抽出** (3 個、`@/components/common` に `SectionHeader` / `GroupHeader` / `ExternalLink`)
  - 19 箇所の置換が完了 (SectionHeader 10 + GroupHeader 5 + ExternalLink 4)
- [x] **Vitest スナップショットテスト** 導入 (16 件 = snapshot 13 + 動作検証 3)
  - `src/__tests__/common.test.jsx` (9 件、新規共通コンポーネント + Pct/Signed)
  - `src/__tests__/sections.test.jsx` (6 件、News/MarketMuse/DeepDive/Footer)
  - ExternalLink のリグレッションガード (target=_blank + rel noopener noreferrer の必須属性 assert)
- [x] **`scripts/common.py` の mypy strict 化** (`pandas-stubs` + `types-requests` 依存追加、CI/daily-update 両方に mypy ステップ)
- [x] **B023 default-arg pattern 修正** (`fetch_listed_alts.py` + `fetch_market_data.py` の 3 closure、pyproject.toml の ignore から削除)

#### v13.4.2 で完了したもの
- [x] **Python 統合テスト** 17 件 (5-10 件目標を超過達成、計 35 件構成)
  - `tests/test_fetch_market_data.py` (9 件): yfinance mock + tmp_path で OUTPUT_PATH 差し替え
  - `tests/test_fetch_macro_indicators.py` (8 件): FRED mock + tmp_path、no-API-key path 含む
- [x] **`docs/RUNBOOK.md`** 新設 (6 セクション構成)
  - quality gates 失敗時 / Actions 失敗時 / 外部 API トラブル / UI 問題 / zip 適用後 / 過去インシデント (7 件記録)
  - README のトラブルシュート章は圧縮し、RUNBOOK にリンクで誘導
- [x] **`.github/CODEOWNERS`** 新設 (`* @other9`、sole reviewer 構成)
- [x] **`docs/BRANCH_PROTECTION.md`** 新設 (GitHub UI 設定手順を画面項目レベルで文書化)
  - 設計: kk + `github-actions[bot]` に bypass 許可、CI status check と Code Owner review は必須
  - 既存の zip 直 push フローを維持しつつ PR フローでは品質ガードを効かせる

### 期待効果

- リファクタ時の回帰検知が現実的に
- AI 生成コードの品質底上げ (linter で機械的にチェック)
- 既存スクリプトの誤用検知 (mypy で common.py の interface 違反を事前検知)
- 障害時の対応時間短縮 (RUNBOOK で過去経験を時系列記録)

---

## v13.5 — 監視・観測レイヤ導入 ✅ 完了 (2026-05-12)

**目的**: Tier 2 の中で個人プロジェクトでも価値が出る監視レイヤを導入。Stale Data 警告では捕捉できない種類の障害を可視化する。

これをもって **Phase 1 (業界標準の足場固め) は全完了**。

### 実装内容

- [x] **Sentry 連携** (`@sentry/react` v8、free tier、DSN-gated)
  - フロントの未捕捉例外 / Promise rejection / React render エラー を捕捉
  - React ErrorBoundary で UI 崩壊時の fallback 画面 (クリーム背景 + ネイビー文字、データ自体は無事と明示)
  - DSN 未設定環境 (local dev) では完全 no-op
- [x] **Lighthouse CI** (`.lighthouserc.cjs` + `ci.yml` ステップ)
  - PR ごとに dist/ に対して performance / accessibility / best-practices / seo を計測
  - temporary-public-storage に結果 URL アップロード
  - warn 閾値 (perf 0.5、他 0.85)、`continue-on-error: true` で CI を落とさない
- [x] **Codecov 連携** (`pytest --cov` + `codecov/codecov-action@v4`)
  - public repo なので token 不要
  - 閾値 enforce 無し、可視化のみ
  - v13.5 着地時点 TOTAL coverage: 24% (fetch_market_data 84% / fetch_macro_indicators 92% / common 53% / その他 0%)
- [x] **Cloudflare Pages PR preview** (`docs/MONITORING.md` でセットアップ手順)
  - GitHub Pages と並走 (本番置き換えはしない、DECISION v13.5-06)
  - PR ごとに `https://<random>.market-monitor.pages.dev/` の preview URL 自動生成
- [x] **`docs/MONITORING.md`** 新設 (4 サービス分の設定手順を一元化)

### 期待効果

- データは新しいが UI が壊れているケースの検知 (Sentry)
- バンドルサイズ肥大化など定量メトリクスでの回帰検知 (Lighthouse)
- テスト不足の客観的可視化 (Codecov)
- 大型変更の merge 前確認手段 (PR preview)

### 月額コスト追加: 0 円 (全て free tier 内)

---

## v16.0 — EDINET + TDnet データ取り込み (Japan Equities Layer 第一段)

**目的**: kk の個人投資ニーズ (TOB / リサーチ不足小型株) に応える日本株専用情報レイヤの起点。

### 実装内容

- [ ] **`scripts/fetch_edinet_filings.py`** 新設
  - EDINET API 経由で大量保有報告書 + 公開買付届出書を日次取得
  - 5% ルール新規開示 / 追加開示 / 保有目的変更を検知
  - **アクティビスト watchlist**: シティインデックス系 / ダルトン / Strategic Capital / 3D Investment Partners / エフィッシモ / オアシス / 村上系
- [ ] **`scripts/fetch_tdnet_disclosures.py`** 新設
  - TDnet 適時開示 RSS を filter
  - キーワード: 自己株式取得 / 業績予想修正 / 公開買付 / MBO / 株主提案 / 資本業務提携
- [ ] **`data/edinet.json`** / **`data/tdnet.json`** の schema 設計
- [ ] フロントに **新セクション 10. 日本株ウォッチ** を追加
  - 直近 24 時間の該当開示を一覧化
  - アクティビスト動向と対象企業の自己株買い等を時系列で重ねて表示
- [ ] 設計原則: **「シグナル」「アラート」のような断定的ラベルは避け、「最近の開示」「該当企業」の中立的表現で統一**

### 期待効果

- TOB に向かう動きの早期捕捉 (大量保有 + 適時開示の組み合わせ)
- 自己株買い / MBO 検討 / 株主提案の速報入手

### 月額コスト追加: 0 円 (EDINET / TDnet とも無料公開)

---

## v14.0 — archive 閲覧 UI + 全文検索

**目的**: 半年以上蓄積されている `data/archive/` を読める資産にする。

### 実装内容

- [ ] `?date=YYYY-MM-DD` URL パラメータで過去 Deep Dive 表示
- [ ] クライアントサイド全文検索 (lunr.js などのライブラリ)
- [ ] アーカイブインデックス (`data/archive/index.json`) を活用したカレンダー UI

---

## v16.1 — TOB スプレッド + 小型株スクリーナー

**目的**: Japan Equities Layer の第二段。TOB アービトラージ視点と「リサーチ不足小型株」の発見機能。

### 実装内容

- [ ] **`scripts/fetch_tob_active.py`** — アクティブ TOB のスプレッド (買付価格 vs 直近終値)、残存日数、出来高変化
- [ ] **`scripts/fetch_jp_screener.py`** — アナリストカバレッジ薄 + PBR < 1 ネットキャッシュ判定
- [ ] フロント「日本株ウォッチ」セクションを拡張

---

## v17.0 — TypeScript 移行 (大型・別枝)

**目的**: AI 補助時代の個人開発における最大の投資。フロント全体の型化で、リファクタ安全性と AI 補助精度を一段引き上げる。

### 実装内容

- [ ] フロント 16 セクション全部の TSX 化
- [ ] `types/` ディレクトリ新設、各セクションの props 型を定義
- [ ] `data/*.json` のスキーマ型化 (Vite + TS で fetch 結果の型保証)
- [ ] `tsconfig.json` で `allowJs: true` から開始 (gradual)、最終的に strict 化
- [ ] **複数 PR に分割** (1 PR で 1-2 セクション)

### 期間目安: 2-4 週間 (5-8 PR)

---

## v14.x — yfinance fallback

**目的**: 評価表で C のまま残るデータソース冗長性を解消。

- 主: yfinance (現状維持)
- 副: Alpha Vantage (無料 25 calls/day) または Polygon.io (無料 5 calls/min)
- 主が失敗した銘柄だけ副で取得を試みる

---

## v16.2 — PBR/ROE 改善要請 dashboard

**目的**: TSE が要請している企業の対応状況を可視化。今後 2-3 年の構造テーマ。

- 改善計画開示済み vs 未開示
- 開示後の株価パフォーマンス追跡
- 自社株買い・配当増配を実施した企業のリスト

---

## v15 — archive ストレージ問題対処

**目的**: 1 年運用で約 3,000 ファイルになる archive のサイズ問題に対処。

候補:
- A: 別リポジトリ `market-monitor-archive` に分離
- B: git-lfs で保管
- C: 月単位で 1 つの zip にまとめる (`archive/2026-05.zip`)

判断は v15 着手時の運用実績を見て決める。

---

## 明示的にやらないこと (Tier 3)

業界標準の大規模開発で行われるが、個人プロジェクトには過剰と判断した項目。
これらは「やらない」と明示的に決めておくことで、ロードマップ完遂後も「未達成項目」として気にならない状態にする。

| 項目 | やらない理由 |
|---|---|
| **E2E テスト (Playwright / Cypress)** | 維持コストが極めて高く、kk の朝の目視で代替可能。Vitest スナップショットで十分 |
| **構造化ログ集約 (CloudWatch / Datadog Logs)** | GitHub Actions ログで足りる。集約基盤は組織規模で初めて意味が出る |
| **Feature flag (LaunchDarkly 等)** | リリースが日次ベース、A/B テストするユーザーもいない |
| **SLO / SLA の明文化** | 法的拘束力のある相手がいない。「毎日 8 時に更新成功した日数」程度の内部 KPI で十分 |
| **専任の人間レビュアー** | 物理的に不在。Claude が現実的代替 |
| **Performance monitoring (Datadog APM)** | 静的サイトに APM は不要。Lighthouse で足りる |
| **有料 SaaS** | 月コスト 0 円維持を方針とする。Sentry / Codecov / Cloudflare は全て free tier |

---

## サブエージェント機能の必要性 — 結論

(2026-05-09 議論時点の結論。状況変化があれば見直し)

| 用途 | 必要性 | 理由 |
|------|-------|------|
| **Claude Code subagents** (開発側) | 不要 | プロジェクト規模で並列探索や code-reviewer subagent が要らない |
| **API multi-call 化** | 完了 | v13.2 で実装済 |
| **Anthropic Agent SDK subagents** | 不要 | 本プロジェクトは ETL パイプラインで、対話的 agent 機能の必要なし |

---

## 改善の基本姿勢 (Phase 1-5 共通)

1. **動作を変えずに足場を作る** → **足場に乗せ替える** の順で 1 段ずつ
2. 改修ごとに `bash scripts/take_snapshot.sh` でスナップショットを取り、Claude 側で実機照合
3. 各バージョンの決定理由は `DECISIONS.md` に記録 (ROADMAP は方針、DECISIONS は経緯)
4. `PROJECT_INSTRUCTIONS.md` は最新ステータスのみ書く (履歴は DECISIONS / ROADMAP)
5. **大きな改修は新しい Claude チャットで始める** (context window 圧迫回避)
6. **PR フローは段階的にハイブリッド運用**: 小修正は zip + 直 push、中規模変更は PR、大型変更は複数 PR 分割 (DECISION v13.4-plan-02 参照)
