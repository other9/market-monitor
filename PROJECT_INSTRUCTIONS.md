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
- 大きな変更は zip パッケージで提供 (例: market-monitor-v13.zip)
- 小さな修正 (1-2 ファイル) はファイル単独でも可
- 変更点は箇条書きで明確に提示
- 適用手順 (git pull → unzip → push) を毎回付記
- バージョン番号は連番で増やす (現行 v12)
- 軽い修正は v12.1 のような小数刻みも可

## 現状のステータス
最新バージョン: **v12.2**
- v12.2 修正点: GitHub Actions を Node 24 対応に更新 (checkout@v5 系統)、色調をブルー×グリーン基調に変更、`.mm-alt-impact-label` の font-size 補修、ルート残骸ファイル削除指示、README 全面書き換え
- v12.1 修正点: Listed Alternatives Proxies のチャートに X/Y 軸・グリッド・Tooltip を追加 (機関投資家用途で「月別・価格水準」が読み取れるようにした)
- v12 主要点 (継続): ローマ数字 → アラビア数字に統一
- Claude モデルを `claude-opus-4-7` に更新
- 信用市場グループ (HY/IG/EM Corp OAS) を強調 (v11時点で取得済みだったが、UI/lede で明示的に位置付け)
- ボラティリティ・流動性セクション新設 (MOVE / VIX期間構造 / SOFR-IORB)
- Listed Alternatives Proxies セクション新設 (PSP/BIZD/IFRA/VNQ/1343.T)
- Stale Data 警告バー (`generatedAt` が 36時間以上古い場合に表示)
- Deep Dive アーカイブ機構 (data/archive/YYYY-MM-DD/ に日次スナップショット)
- 週末・月初の長尺コンテンツ分岐 (土曜は週次総括、月初2日間は前月総括)

## 次回以降の開発で気を付けたいこと
- 新規データソース追加時は data/*.json のスキーマ変更を JSX 側でも対応
- コミット済み `data/*.json` 自体がプレースホルダ役なので、スキーマ変更時は最新の JSON も一緒に更新
- requirements.txt の更新を忘れない
- ワークフローへの新ステップ追加時は実行順序に注意 (中銀ファクト → ニュース、市場データ → listed_alts、Commit直前に archive)
