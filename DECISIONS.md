# Decisions Log — Market Monitor

主要な技術的決定とその背景・トレードオフを記録する。
バージョンが上がっても、なぜそうなっているのかを後から辿れるようにするための文書。

---

## v12.1 で導入された決定

### [DECISION v12.1-01] Listed Alternatives Proxies のチャートに軸を追加
- **背景**: v12 でスパークライン的に軸を `hide` していたが、機関投資家のユースケースでは
  「どの月にどの値段だったか」が読み取れないと意味がない、というユーザー指摘
- **修正**:
  - X 軸: 月単位の tick (`MM/YY` 形式)、`interval` で 4-5 ポイントに間引き
  - Y 軸: 右寄せ、3-4 tick、価格は整数または小数1桁で表示
  - `CartesianGrid` を水平のみ薄く追加 (`stroke-dasharray="2 4"`)
  - `Tooltip` を追加し、ホバー時に正確な日付・値を表示
- **CSS 影響**: `.mm-alts-spark` の高さを 50px → 110px (モバイル時 90px) に拡張、
  カード自体のサイズはそれ以外変更なし

---

## v12 で導入された決定

### [DECISION v12-01] セクション番号をローマ → アラビア数字に統一
- **背景**: v11 のコードは I, II, III, VI, VII, IV, V の順序で render しており、
  リファクタの履歴で不整合が残っていた
- **方針**: アラビア数字 1〜9 に統一、配置順そのものは現状維持で番号だけ揃える
- **副次効果**: 新規セクション追加時にローマ数字の組み合わせを考えなくてよい

### [DECISION v12-02] Claude モデルを `claude-opus-4-7` に更新
- **旧**: `claude-opus-4-5`
- **新**: `claude-opus-4-7` (最新)
- **背景**: Deep Dive・解説の品質が依然最大の差別化要因。最新の Opus を使う
- **コスト影響**: 価格は同等系列、月額約1,600円水準を維持

### [DECISION v12-03] zip 投入フローを簡素化
- **旧**: `git checkout --theirs data/` を予防的に毎回実行
- **新**: 通常は `git pull --rebase` のみ。コンフリクトが起きた時だけ `--theirs` で対処
- **背景**: 毎回打つには長く、実際にコンフリクトする頻度は低い

### [DECISION v12-04] Stale Data 警告バーを UI に追加
- **背景**: モニタリング基盤は無く、Actions 失敗の即時検知ができない
- **手段**: フロントで `generatedAt` を見て、36時間以上古ければ赤バーを表示
- **トレードオフ**: ユーザがダッシュボードを開いた時にしか気付けないが、
  GitHub の通知メール頼みより視認性が高い
- **閾値**: 36時間 (24時間 cron + cron 遅延 + 余裕)

### [DECISION v12-05] 信用市場グループの強調
- **背景**: HY/IG/EM Corp OAS は v11 時点で取得済みだったが、
  Macro Barometer の中で他指標と同列の扱いだった
- **方針**: lede で「プライベート・デットの絶対リターンを規定する公的市場の状態」と
  明示的に位置付け、データ・グループ自体は維持
- **追加**: 信用ストレスの説明を「4%超で警戒、6%超でリセッション圏」と具体化

### [DECISION v12-06] ボラティリティ・ファンディング・パネル新設
- **構成**: 3カード
  - VIX 期間構造 (3M ÷ 1M) — Contango / Flat / Backwardation の3レジーム
  - MOVE (国債ボラ) — 3レジーム (Calm / Normal / Elevated)
  - SOFR − IORB (bp) — Easy / Neutral / Stressed の3レジーム
- **背景**: 東京の機関投資家にとって、ボラ期間構造とファンディング状況は
  円ヘッジコストや海外債券判断の前提
- **新規データ取得**:
  - `^VIX3M`, `^VIX9D`, `^MOVE` を `fetch_market_data.py` の INSTRUMENTS に追加
  - `IORB` を `fetch_macro_indicators.py` の INDICATORS (金利・期待) に追加
- **判定ロジック**: フロント (MarketMonitor.jsx) で計算。閾値はコード内コメント参照

### [DECISION v12-07] Listed Alternatives Proxies 新設
- **背景**: PE/PD/インフラ/不動産の解説 (Alternatives Spotlight) を、
  日次で値段の出る上場プロキシで数値裏付けする
- **構成銘柄**:
  - Listed PE : `PSP` (Invesco)
  - BDC (PD) : `BIZD` (VanEck)
  - Infra    : `IFRA` (iShares US), `NFRA` (FlexShares global)
  - US REIT  : `VNQ` (Vanguard)
  - J-REIT   : `1343.T` (NEXT FUNDS 東証REIT指数)
- **新規スクリプト**: `scripts/fetch_listed_alts.py` → `data/listed_alts.json`
- **UI**: 各銘柄カードに 1Y スパークライン + 1D/1W/1M/3M/YTD パフォーマンス
- **チャート候補プールにも追加**: PSP/BIZD/IFRA/NFRA/VNQ/1343.T を `chart_universe.py` に登録

### [DECISION v12-08] Deep Dive アーカイブ機構
- **背景**: 日次の Deep Dive・経済指標・ニュースが翌日には消えるため、
  蓄積すれば月単位で「何が起きたか」を辿れる資産になる
- **手法**: コミット直前に `data/*.json` のスナップショットを `data/archive/YYYY-MM-DD/` にコピー
- **新規スクリプト**: `scripts/archive_data.py`
- **インデックス**: `data/archive/index.json` に日付一覧を維持
- **UI**: 現時点ではアーカイブ専用画面は未実装 (v13以降)。データ蓄積を先行

### [DECISION v12-09] 週末・月初の Deep Dive を長尺総括モードに
- **判定**: JST 基準で
  - 月初2日間 (1日, 2日) → 前月総括モード
  - 土曜日 (weekday == 5) → 週次総括モード
  - 上記以外 → 通常モード (当日最重要ニュース解説)
- **実装**: `fetch_news.py` の `determine_cadence()` で判定し、
  Claude へのシステムプロンプトを切り替える
- **payload**: `news.json` に `cadence` フィールドを追加 (mode/label/context)
- **UI**: Deep Dive のキッカー文言を mode に応じて切替

### [DECISION v12-10] プレースホルダ JSON はコミット済みデータが兼任
- **整理**: 専用ディレクトリは存在せず、コミットされている `data/*.json` 自体が
  本番データ兼初期表示の二重役割を担う
- **fallback**: `fetch_news.py` には RSS 全滅時のインライン fallback あり
- **影響**: スキーマを変更したら、コミット済みの最新 JSON も合わせて更新する運用

---

## v11 以前の決定 (継続)

### [DECISION] バリュエーション指標の Shiller データ取得
- **背景**: Robert Shiller のオリジナルデータ、公式CSVなし
- **取得方法**: `pandas.read_html()` で月次テーブルをパース
- **依存パッケージ**: `lxml`, `beautifulsoup4`, `html5lib`
- **リスク**: サイト構造変更で壊れる可能性、失敗時はその指標だけスキップ

### [DECISION] Bloomberg / WSJ / FT は Google News RSS 経由
- **背景**: 公式RSSが廃止 (Bloomberg/WSJ) または有料 (FT)
- **方法**: `https://news.google.com/rss/search?q=site:bloomberg.com+when:1d&...` で代替
- **トレードオフ**: ヘッドラインしか取れない (本文要約は短い)
- **狙い**: ニュースソースの「格調」を上げる、オルタナ系記事の網羅性

### [DECISION] 日銀の政策金利系列を修正
- **誤り**: `IRSTCI01JPM156N` (3M money market 近似)
- **正解**: `IRSTCB01JPM156N` (Central Bank Rate)
- **理由**: ユーザー指摘で発覚。マネーマーケット金利と政策金利は別物
- **波及**: BOE/BOC/SNB/RBA/RBNZ も `IRSTCB01...` ファミリーに統一

### [DECISION] 中銀コメントは単一文章形式
- **元案**: 「直近の決定」「次回会合」「要人発言」「市場の見方」の4フィールド
- **現行**: `comment` 単一フィールド (200-350字)
- **理由**: 毎日4要素を埋めると冗長、当日トピックに集中した自然な日本語の方が読みやすい
- **設計**: Claude が当日のニュース文脈で重要なものを選んで織り込む

### [DECISION] Claude API で一括生成
- **要素数**: 10要素 (epigraph / headline / news 7本 / muse 3本 / charts / deep_dive / economic chart / CB watch 4本 / PE/PD view / real assets view)
- **モデル**: v12 で `claude-opus-4-5` → `claude-opus-4-7`
- **コスト**: 月額約1,600円
- **トレードオフ**: Haiku なら 1/5 だが Deep Dive の質が落ちる懸念

### [DECISION] ソースリンクの紐付け方式
- **手法**: Claude には記事ごとに `[N]` インデックス番号を提示し、`source_index: N` で参照させる
- **Python側**: index → URL/source 名 を解決して JSON に注入
- **理由**: Claude に URL を直接生成させると hallucination リスク

### [DECISION] 注目チャート3本の選定はリトライ型
- **背景**: 個別銘柄も含めて Claude に自由にティッカー指定させたい
- **手法**: Claude は 5-8 候補を優先度順に提示、Python が上から取得試行、最初の3本成功で確定
- **利点**: 存在しないティッカー、データ薄い銘柄を自動スキップ
- **構造**: `chart_universe.py` のキーリスト or 直接 ticker 指定の両対応

### [DECISION] バリュエーション指標は5本
- Shiller CAPE (multpl.com)
- Buffett Indicator 近似 (FRED WILL5000PRFC ÷ GDP)
- S&P 500 配当利回り (FRED SP500DIV ÷ SP500)
- Fed Model (E/P − DGS10、multpl.com の PE Ratio 経由)
- VVIX/VIX 比率 (yfinance)

### [DECISION] CSS は外部ファイル化必須
- **バグ**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を
  minified 変数名 `${D.x}` に置換し、本番環境でスタイルが剥がれる
- **対応**: インラインCSSは禁止、CSS変数 (`var(--accent)`) で管理、外部 .css ファイル
- **波及**: JSX 内では PALETTE 定数を「Recharts などJSで色を直接参照する箇所」のみに使用
