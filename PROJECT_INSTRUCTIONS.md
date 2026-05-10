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
- 地政学・マクロ経済の構造的分析を好む
- 詳細で構造化された説明・解説を好む傾向

## ファイル受け渡しの好み
- **zipファイルでの受け渡しを最優先**。Codespaces にアップロード→`unzip -o`→上書きの流れが定着
- ターミナルでの `sed` や逐次的な `cat <<EOF` 上書きより、zipの方を強く好む
- 個別ファイルパッチも可だが、複数ファイル変更時はzipにまとめる
- zipに `__pycache__/`, `node_modules/`, `dist/`, `.git/`, `*.pyc` を含めないこと

## 開発・配布フロー (簡素版)
```bash
git pull --rebase origin main
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push
```
GitHub Actions の自動コミット (`chore: update market data ...`) との競合は通常 `git pull --rebase` で吸収できる。
万一コンフリクトしたら `git checkout --theirs data/ && git add data/ && git rebase --continue` で data/ を Actions 側優先で解決。

## 中核アーキテクチャ
- **データレイヤ**: Pythonスクリプト群 (scripts/) が1日1回 (UTC 23:00 = JST 8:00) 走り、data/*.json を生成
- **配信レイヤ**: GitHub Actions が data/ をリポジトリにコミット後、Vite で React アプリをビルド、GitHub Pages にデプロイ
- **アーカイブレイヤ**: コミット直前に data/ のスナップショットを `data/archive/YYYY-MM-DD/` にコピー (Deep Dive・経済指標の蓄積用)
- **フロントエンド**: React + Vite + Recharts、CSS は外部ファイル (MarketMonitor.css, index.css)

## 重要な技術的決定 (絶対に忘れない)
1. **TOPIX**: `^TOPX` は yfinance で delisted。代替に `1306.T` (NEXT FUNDS TOPIX ETF) を使用
2. **日銀政策金利**: `IRSTCI01JPM156N` (マネーマーケット) は誤り。正しくは `IRSTCB01JPM156N` (中央銀行金利)
3. **他中銀**: BOE/BOC/SNB/RBA/RBNZ もすべて `IRSTCB01...` ファミリーに統一
4. **CSSは外部ファイル化必須**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minified変数名 `${D.x}` に置換する重大バグあり。インラインCSSは禁止、CSS変数 (`var(--accent)`) で管理
5. **cron は UTC 23:00 (JST 8:00)**: 7時だと yfinance の日経データ更新が間に合わず、4/24実行で4/23データになる事例があった
6. **GitHub Actions cron は数〜十数分遅延**: バッファを見込んだ設計
7. **Claude API**: モデルは `claude-opus-4-7` (最新)。Deep Dive・解説の品質を重視
8. **Public リポジトリの安全性**: Forkリポジトリでは Secrets が読めない仕様 (Anthropic API キー悪用は不可能)
9. **モニタリング無し**: Actions失敗の即時検知は GitHub の通知メール頼み。代わりに UI 側で `generatedAt` が古ければ Stale Data 警告を出す
10. **プレースホルダ JSON**: 専用ディレクトリは存在せず、コミット済みの `data/*.json` 自体が二重の役割 (本番データ兼初期表示) を担う。`fetch_news.py` には RSS 全滅時のインライン fallback あり

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

## ページ構成 (現行 v12 — アラビア数字に統一)
1. Masthead + Epigraph + Ticker (＋ Stale Data 警告バー)
2. **1. 本日の注目チャート** (3本、Claude動的選定)
3. **2. 昨日の主要市場** + セクター・ヒートマップ
4. **3. マクロ・バロメーター** (FRED 17指標 — 金利／信用／金融環境／為替・実物)
5. **4. ボラティリティ・流動性** (新規 — VIX 期間構造・MOVE・SOFR-IORB)
6. **5. バリュエーション・ゲージ** (Shiller CAPE / Buffett / Fed Model)
7. **6. 中央銀行ウォッチ** (Fed/ECB/BOJ + 日替わり1中銀)
8. **7. 重要指標・5年チャート** (日次)
9. **8. 市場を動かしたニュース** (7本)
10. **9. Listed Alternatives Proxies** (新規 — PSP/BIZD/IFRA/VNQ/1343.T)
11. Deep Dive 解説記事 (土曜は週次総括、月初は前月総括に切替)
12. Economic Indicator (日替わりFRED指標)
13. Alternatives Spotlight (PE/PD と 不動産・インフラ、impact + sources)
14. Market Muse (3片のユーモア小話)
15. Footer

## ニュースソース (現行14本)
**一般金融・マーケット (7)**:
Yahoo!ファイナンス / Reuters Japan / マネクリ / Reuters Business / MarketWatch / CNBC / Yahoo Finance US

**オルタナティブ専門 (4)**:
Pensions & Investments / DailyAlts / PE Hub / AltAssets PE

**Bloomberg / WSJ / FT (Google News RSS経由) (3)**:
公式RSSが廃止されたため、Google News の `site:` 検索 RSS で代替

## 開発時の応答方針
- 大きな変更は zip パッケージで提供 (例: market-monitor-v13.1.3.zip)
- Knowledge md ファイルの更新は別 zip で出す (market-monitor-vN-knowledge.zip)
- 小さな修正 (1-2 ファイル) はファイル単独でも可
- 変更点は箇条書きで明確に提示
- 適用手順 (git pull → unzip → push) を毎回付記
- バージョン番号は連番で増やす (現行 v13.1.2)
- 軽い修正は v13.1.3 のような小数刻みも可

## 現状のステータス
最新バージョン: **v13.1.2**

v13 は「土台拡充フェーズ」 (機能追加と分離して保守性・コスト効率・運用品質を高める)。
全体方針は [`ROADMAP.md`](ROADMAP.md) を参照。

### v13.1.2 で完了したこと
- **`MarketMonitor.jsx` のセクション切り出し Phase 1**: 1263 → 959 行 (-304)
  - 6 つの独立性が高いセクションを `src/components/sections/` 配下に新規作成
  - 抽出したもの: `MastheadSection` (Masthead+Epigraph+Ticker 統合) / `EconomicChartSection` / `DeepDiveSection` / `AlternativesSpotlightSection` (`AltCategoryCard` + `ALT_IMPACT_CONFIG` 内包) / `MarketMuseSection` / `FooterSection`
  - 派生値の所属移動: `nowJst` / `latestAsOf` / `tickerCells` を `MastheadSection` 内へ、`museStories` を `MarketMuseSection` 内へ
  - barrel `src/components/sections/index.js` 新設
- **依存方向ルール検査**: `theme.js → utils.js → common/* → sections/* → MarketMonitor.jsx` の単方向を grep で確認

### v13.1.0 / v13.1.1 で導入された土台 (継続)
- **`@/` エイリアス**: `vite.config.js` の `resolve.alias`
- **`src/theme.js`** — PALETTE / FONT_MONO / CHART_UNIVERSE_LABELS
- **`src/utils.js`** — fmt / fmtPct / fmtSigned / tone / fmtDate / fmtDay / safe
- **`src/components/common/`** — Pct.jsx / Signed.jsx / MiniChart.jsx / StaleDataWarning.jsx + barrel index.js
- **MarketMonitor.jsx の import 付け替え** — 上記モジュールから引いている

### v13.0 で導入された土台 (継続)
- **`scripts/common.py`** 新設 — FRED API client / yfinance MultiIndex 吸収 / 共通ロガー / 日付ヘルパー (まだ既存スクリプトでは使用していない、土台のみ)
- **`scripts/take_snapshot.sh`** — 改修確認用 zip を 1 コマンド化 (`bash scripts/take_snapshot.sh`)
- **`tests/`** — pytest 導入、最小 18 テスト
- **Actions の Python smoke test ステップ** — 共通モジュール import チェック + pytest を最初に実行
- **README にトラブルシュート章を厚く** — 失敗時の手動再実行、yfinance/Claude API のエラー対処、smoke test 失敗時のデバッグ手順
- **`ROADMAP.md`** — v13.x / v14+ の方針文書化

### v12 系の主要機能 (継続)
- セクション 9 つ (アラビア数字)
- ブルー×グリーン基調
- Claude モデル `claude-opus-4-7`
- Stale Data 警告 (36 時間以上古い `generatedAt` で赤バー)
- Deep Dive アーカイブ (`data/archive/YYYY-MM-DD/`)
- 週末/月初の長尺コンテンツ分岐 (土曜=週次総括、月初2日=前月総括)
- Listed Alternatives Proxies (PSP/BIZD/IFRA/NFRA/VNQ/1343.T、軸付きチャート)
- Funding & Volatility パネル (VIX 期間構造 / MOVE / SOFR-IORB)
- バリュエーション・ゲージ (Shiller CAPE / Buffett / Fed Model)
- 中央銀行ウォッチ (Fed/ECB/BOJ + 日替わり 1 中銀)

## 次回以降の開発で気を付けたいこと
- 新規データソース追加時は data/*.json のスキーマ変更を JSX 側でも対応
- コミット済み `data/*.json` 自体がプレースホルダ役なので、スキーマ変更時は最新の JSON も一緒に更新
- requirements.txt の更新を忘れない
- ワークフローへの新ステップ追加時は実行順序に注意 (smoke test → 中銀ファクト → ニュース、市場データ → listed_alts、Commit直前に archive)
- **大型改修 (v13.1.3 以降) は新しい Claude チャットで開始** (context window 圧迫回避)
- **改修毎に `bash scripts/take_snapshot.sh` で snapshot を取得** し Claude 側で実機照合
- **新規セクション抽出時は依存方向ルール (DECISION v13.1-03) を遵守**: sections は common/utils/theme を参照してよいが、その逆は禁止
