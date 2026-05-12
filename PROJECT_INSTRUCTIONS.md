# Market Monitor — 開発プロジェクト

## プロジェクト概要
日本時間朝8時に自動更新される個人用マーケット日報ダッシュボード。
GitHub Actions + GitHub Pages + Anthropic Claude API + FRED API + yfinance で構成。

- **公開URL**: https://other9.github.io/market-monitor/
- **リポジトリ**: https://github.com/other9/market-monitor (Public)
- **Codespaces**: /workspaces/market-monitor で開発

## ユーザー (kk) について
- 東京・中央区在住、機関投資家のドメインに精通
- プライベート・エクイティ／プライベート・デット／不動産／インフラといったオルタナティブ資産分野に詳しい
- **個人資産で日本株個別投資も行っている**。特に TOB 関連銘柄と、リサーチ不足の小型株に注目
- 地政学・マクロ経済の構造的分析を好む
- 詳細で構造化された説明・解説を好む傾向

## ファイル受け渡しの好み
- **zipファイルでの受け渡しを最優先**。Codespaces にアップロード→`unzip -o`→上書きの流れが定着
- ターミナルでの `sed` や逐次的な `cat <<EOF` 上書きより、zipの方を強く好む
- 個別ファイルパッチも可だが、複数ファイル変更時はzipにまとめる
- zipに `__pycache__/`, `node_modules/`, `dist/`, `.git/`, `*.pyc` を含めないこと

## 開発・配布フロー (ハイブリッド運用)

変更規模に応じて 3 段のフローを使い分ける (DECISION v13.4-plan-02 参照)。

### 小修正 (1-2 ファイル) — zip + main 直 push
```bash
git pull --rebase origin main
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push
```

### 中規模変更 (1 セクション追加など) — zip + PR フロー
```bash
git pull --rebase origin main
git checkout -b feat/v16.0-edinet
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push -u origin feat/v16.0-edinet
gh pr create --fill  # CI 通過と Claude レビュー後 merge
```

### 大型変更 (TS 移行など) — 複数 PR 分割
複数 PR (1 PR で 1-2 セクション) に分割し、段階的に merge。

### GitHub Actions の自動コミットとの競合
GitHub Actions の自動コミット (`chore: update market data ...`) との競合は通常 `git pull --rebase` で吸収できる。
万一コンフリクトしたら `git checkout --theirs data/ && git add data/ && git rebase --continue` で data/ を Actions 側優先で解決。

## 中核アーキテクチャ
- **データレイヤ**: Pythonスクリプト群 (scripts/) が1日1回 (UTC 23:00 = JST 8:00) 走り、data/*.json を生成
- **配信レイヤ**: GitHub Actions が data/ をリポジトリにコミット後、Vite で React アプリをビルド、GitHub Pages にデプロイ
- **アーカイブレイヤ**: コミット直前に data/ のスナップショットを `data/archive/YYYY-MM-DD/` にコピー (Deep Dive・経済指標の蓄積用)
- **共通レイヤ**: `scripts/common.py` が FRED API / yfinance / ログ / 日付処理を集約
- **フロントエンド**: React + Vite + Recharts、134 行のオーケストレータ (`src/MarketMonitor.jsx`) + 16 セクション (`src/components/sections/`) + 共通 (`src/components/common/`)
- **CSS**: 外部ファイル (MarketMonitor.css, index.css)

## 重要な技術的決定 (絶対に忘れない)
1. **TOPIX**: `^TOPX` は yfinance で delisted。代替に `1306.T` (NEXT FUNDS TOPIX ETF) を使用
2. **日銀政策金利**: `IRSTCI01JPM156N` (マネーマーケット) は誤り。正しくは `IRSTCB01JPM156N` (中央銀行金利)
3. **他中銀**: BOE/BOC/SNB/RBA/RBNZ もすべて `IRSTCB01...` ファミリーに統一
4. **CSSは外部ファイル化必須**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minified変数名 `${D.x}` に置換する重大バグあり。インラインCSSは禁止、CSS変数 (`var(--accent)`) で管理
5. **cron は UTC 23:00 (JST 8:00)**: 7時だと yfinance の日経データ更新が間に合わず、4/24実行で4/23データになる事例があった
6. **GitHub Actions cron は数〜十数分遅延**: バッファを見込んだ設計
7. **Claude API**: モデルは役割別に `claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5` を使い分け (v13.2 以降)
8. **Public リポジトリの安全性**: Forkリポジトリでは Secrets が読めない仕様 (Anthropic API キー悪用は不可能)
9. **モニタリング無し**: Actions失敗の即時検知は GitHub の通知メール頼み。代わりに UI 側で `generatedAt` が古ければ Stale Data 警告を出す。v13.5 で Sentry を追加予定
10. **プレースホルダ JSON**: 専用ディレクトリは存在せず、コミット済みの `data/*.json` 自体が二重の役割 (本番データ兼初期表示) を担う
11. **依存方向ルール**: `theme.js → utils.js → components/common → components/sections → MarketMonitor.jsx` の単方向。grep で違反検出可能 (DECISION v13.1-03 参照)
12. **scripts/__init__.py は作らない**: PEP 420 namespace package で動作している (DECISION v13.3-05 参照)

## 主なバグ歴 (再発防止用)
- **yfinance MultiIndex 列**: `df["Close"]` が DataFrame で返るケースあり。`extract_close_series()` ヘルパーで吸収
- **pandas-datareader 不安定**: stooq → CAPTCHA → 完全廃止、FRED 直叩きに統一
- **CSS minifier bug**: 上記参照
- **GitHub Pages 無効化**: 何らかのタイミングで Source 設定がリセットされる。Settings → Pages で「GitHub Actions」を選び直す
- **`cd scripts` で `data/news.json` が `scripts/data/news.json` に書かれる**: PYTHONPATH 環境変数で import 解決、CWDはルートのまま

## デザインシステム
- ライトテーマ: クリーム背景 (#F5F1E8) + ネイビー文字 (#1A1F2E)
- アクセントカラー: ディープブルー (#1A4D7A) と セージティール (#4A6E6A)
- 上昇/下落色: 緑 (#2D6A4F) / 赤 (#C0392B) — 慣習どおり、変更しない
- フォント: Fraunces (display, セリフ) + JetBrains Mono (data) + IBM Plex Sans (body)
- 等幅フォントの数値表示を多用、新聞風の格調を重視
- レスポンシブ: 1100px/960px/760px/640px の4段階ブレイクポイント

## ページ構成 (現行 v13.3、Phase 2 で 10. 日本株ウォッチ を追加予定)
1. Masthead + Epigraph + Ticker (＋ Stale Data 警告バー)
2. **1. 本日の注目チャート** (3本、Claude動的選定)
3. **2. 昨日の主要市場** + セクター・ヒートマップ
4. **3. マクロ・バロメーター** (FRED 17指標 — 金利／信用／金融環境／為替・実物)
5. **4. ボラティリティ・流動性** (VIX 期間構造・MOVE・SOFR-IORB)
6. **5. バリュエーション・ゲージ** (Shiller CAPE / Buffett / Fed Model)
7. **6. 中央銀行ウォッチ** (Fed/ECB/BOJ + 日替わり1中銀)
8. **7. 重要指標・5年チャート** (日次)
9. **8. 市場を動かしたニュース** (7本)
10. **9. Listed Alternatives Proxies** (PSP/BIZD/IFRA/VNQ/1343.T)
11. **10. 日本株ウォッチ** (v16.0 で追加予定 — EDINET 大量保有 + TDnet 適時開示)
12. Deep Dive 解説記事 (土曜は週次総括、月初は前月総括に切替)
13. Economic Indicator (日替わりFRED指標)
14. Alternatives Spotlight (PE/PD と 不動産・インフラ、impact + sources)
15. Market Muse (3片のユーモア小話)
16. Footer

## ニュースソース (現行14本)
**一般金融・マーケット (7)**:
Yahoo!ファイナンス / Reuters Japan / マネクリ / Reuters Business / MarketWatch / CNBC / Yahoo Finance US

**オルタナティブ専門 (4)**:
Pensions & Investments / DailyAlts / PE Hub / AltAssets PE

**Bloomberg / WSJ / FT (Google News RSS経由) (3)**:
公式RSSが廃止されたため、Google News の `site:` 検索 RSS で代替

## 開発時の応答方針
- 大きな変更は zip パッケージで提供 (例: market-monitor-v13.4.zip)
- Knowledge md ファイルの更新は別 zip で出す (market-monitor-vN-knowledge.zip)
- 小さな修正 (1-2 ファイル) はファイル単独でも可
- 変更点は箇条書きで明確に提示
- 適用手順 (git pull → unzip → push) を毎回付記
- 中規模変更は PR フローを案内 (DECISION v13.4-plan-02)
- バージョン番号は連番で増やす
- 軽い修正は v13.4.1 のような小数刻みも可

## 現状のステータス
最新バージョン: **v13.4.0** — Linter/Formatter + Dependabot + CI ワークフロー分離 完了

v13 系統 (土台拡充) は v13.3 で完了し、Phase 1 (v13.4) に着手。**v13.4.0 で Tier 1 のうち linter/formatter 系を完了**。
全体方針は [`ROADMAP.md`](ROADMAP.md) を、決定経緯は [`DECISIONS.md`](DECISIONS.md) を参照。

### Phase 1-5 全体像

| Phase | 主眼 | バージョン |
|---|---|---|
| Phase 1: 業界標準の足場固め | 保守性・観測性の底上げ | v13.4 (.0/.1/.2), v13.5 |
| Phase 2: Japan Equities Layer 第一段 | 個人投資ニーズへの即応 | v16.0 |
| Phase 3: archive UI + Japan 拡張 | 蓄積資産活用 + TOB 機能 | v14.0, v16.1 |
| Phase 4: 大型構造改革 | AI 補助精度の本格向上 | v17.0 (TS 移行) |
| Phase 5: 残務処理 | データ冗長化と運用課題 | v14.x, v16.2, v15 |

合計 9 リリース、8-10 ヶ月相当。

### 次の一歩 — v13.4.1 着手予定

v13.4.0 で完了:
- ✅ Ruff (Python lint、45 件自動修正適用済)
- ✅ ESLint v9 flat config (JS lint、既存コード 0 件 issue)
- ✅ Prettier (config のみ、CI では check しない方針 — DECISION v13.4.0-05)
- ✅ Dependabot (npm/pip/actions の週次 minor/patch 監視)
- ✅ CI ワークフロー新設 (`.github/workflows/ci.yml`、PR + non-main push 発火)
- ✅ daily-update.yml に Ruff lint ステップ追加

v13.4.1 で導入予定:
- 共通 component 抽出 (3-5 個、`@/components/common`)
- Vitest スナップショットテスト (5-10 件)
- `scripts/common.py` の mypy strict 化
- B023 の default-arg pattern 修正 (`fetch_listed_alts.py`、修正後 pyproject.toml の ignore から外す)

v13.4.2 で導入予定:
- Python 統合テスト (5-10 件、mock yfinance + mock FRED)
- ブランチ保護ルール + CODEOWNERS (kk = sole reviewer、zip + 直 push と両立する設定)
- `docs/RUNBOOK.md` 新設

### v13.4.0 で日常運用に追加されたコマンド

```bash
# Python lint チェック
ruff check .
ruff check . --fix      # 自動修正

# JS lint チェック
npm run lint
npm run lint:fix        # 自動修正

# Prettier (任意、手動で整形したい時)
npm run format          # src/**/*.{js,jsx,css} と *.{js,json} を書き換え
npm run format:check    # check のみ
```

PR を作ると CI で Ruff + ESLint + pytest + Vite build が自動実行される。

## やらないこと (Tier 3 — 明示的に除外)

業界標準の大規模開発で行われるが、個人プロジェクトには過剰と判断して **意図的に実装しない** 項目:

- **E2E テスト (Playwright / Cypress)** — Vitest スナップショットで代替
- **構造化ログ集約 (CloudWatch / Datadog Logs)** — GitHub Actions ログで足りる
- **Feature flag (LaunchDarkly 等)** — リリースが日次ベース、A/B テストするユーザーもいない
- **SLO / SLA の明文化** — 法的拘束力のある相手がいない
- **専任の人間レビュアー** — 物理的に不在、Claude が代替
- **Performance monitoring (Datadog APM)** — 静的サイトに APM は不要
- **有料 SaaS** — 月コスト 0 円維持 (Sentry / Codecov / Cloudflare は全て free tier)

「やらないこと」の明文化は完璧主義の罠を避けるため (DECISION v13.4-plan-01)。

## v13.3 までで完了したこと (継続)

### v13.3 (common.py 全面活用)
- 9 つの Python スクリプトを `scripts/common.py` に乗せ替え
- FRED 直叩き 5 ファイル → `fred_observations()` ラッパに置換
- inline `extract_close_series` 2 ファイル → import に統一
- 全ファイルの `print(f"[OK]...")` → `log_ok/log_warn/log_skip/log_info`
- `datetime.now(timezone(timedelta(hours=9)))` → `jst_now()` に集約
- 検証: pytest 18/18 PASS

### v13.2 (Claude API 4 分割)
- Call 1 (Opus 4.7): epigraph + headline + news + charts_of_the_day
- Call 2 (Opus 4.7): deep_dive (cadence 切替)
- Call 3 (Sonnet 4.6): central_bank_watch + pe_pd_view + real_assets_view
- Call 4 (Haiku 4.5): funny_stories + economic_chart_of_the_day
- 各 call が独立して try/except、1 つ失敗しても他は生成される

### v13.1 系 (フロント分割)
- `MarketMonitor.jsx`: 1513 行 → **134 行** (-91%) の薄いオーケストレータ
- 16 セクションを `src/components/sections/` に切り出し
- `src/components/common/`, `src/utils.js`, `src/theme.js` の三層
- 依存方向ルール (DECISION v13.1-03)、grep で違反ゼロ確認済

### v13.0 (土台ファイル新設)
- `scripts/common.py` — FRED / yfinance / ログ / 日付ヘルパー
- `scripts/take_snapshot.sh` — snapshot 1 コマンド化
- `tests/` ディレクトリと pytest 18 ケース
- Actions の Python smoke test ステップ
- `ROADMAP.md` 新設

### v12 系の主要機能
- セクション 9 つ (アラビア数字)
- ブルー×グリーン基調
- Stale Data 警告 (36 時間閾値)
- Deep Dive アーカイブ (`data/archive/YYYY-MM-DD/`)
- 週末/月初の長尺コンテンツ分岐
- Listed Alternatives Proxies (PSP/BIZD/IFRA/NFRA/VNQ/1343.T)
- Funding & Volatility パネル (VIX 期間構造 / MOVE / SOFR-IORB)
- バリュエーション・ゲージ (Shiller CAPE / Buffett / Fed Model)
- 中央銀行ウォッチ (Fed/ECB/BOJ + 日替わり 1 中銀)

## 次回以降の開発で気を付けたいこと
- 現在地は **v13.4.0 完了、v13.4.1 (共通 component 抽出 + Vitest + mypy strict) に着手予定** の状態
- **PR を作ると CI で Ruff + ESLint + pytest + Vite build が自動実行される**。push 前に `ruff check .` と `npm run lint` でローカル確認すると速い
- **大型改修は新しい Claude チャットで開始** (context window 圧迫回避)
- **改修毎に `bash scripts/take_snapshot.sh` で snapshot を取得** し Claude 側で実機照合
- **新規 fetch スクリプト追加時は最初から `scripts/common.py` を使う** (DECISION v13.3-01..05)
- **新規セクション抽出時は依存方向ルール** (DECISION v13.1-03) を遵守
- **新規 fetch スクリプトを追加する時は知財・規約に注意**: EDINET / TDnet は公開 API なので問題なし、kabutan などのスクレイピングは要確認
- **Japan Equities Layer の UI 表現**: 「シグナル」「アラート」などの断定的ラベルは避け、「最近の開示」「該当企業」の中立的表現で統一 (DECISION v13.4-plan-03)
- **PR フローへの段階移行**: 中規模変更以上は PR を使う運用に慣れていく
- **新規データソース追加時は `data/*.json` のスキーマ変更を JSX 側でも対応**、コミット済み `data/*.json` のプレースホルダ役も忘れずに更新
- **`requirements.txt` の更新を忘れない**
- **ワークフローへの新ステップ追加時は実行順序に注意** (smoke test → 中銀ファクト → ニュース、市場データ → listed_alts、Commit 直前に archive)
- **新規 Python ファイル追加時は `ruff check .` を pass させる**: import 順序 (isort) と未使用 import を自動修正可能
