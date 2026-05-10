# Decisions Log — Market Monitor

主要な技術的決定とその背景・トレードオフを記録する。
バージョンが上がっても、なぜそうなっているのかを後から辿れるようにするための文書。

---

## v13.3 で導入された決定

### [DECISION v13.3-01] 各 `fetch_*.py` を `common.py` の薄いラッパに置き換え (FRED 直叩き廃止)
- **背景**: 5 つのスクリプト (`fetch_macro_indicators.py`, `fetch_valuations.py`, `fetch_central_banks.py`, `fetch_economic_chart.py`, `fetch_featured_charts.py`) が個別に FRED API を直叩きしており、コード重複 + 細かな書式揺れがあった
- **判断**: 各ファイルの `fetch_fred*` 関数を `scripts.common.fred_observations` を呼ぶ薄いラッパに置換
- **戻り値の維持**: 各スクリプトが期待する戻り値型 (`pd.Series` または `[{d, v}]`) は呼び出し側で整形 — 関数シグネチャ・呼び出し箇所は不変
- **効果**: FRED API クライアントを 1 箇所で管理 (将来のリトライ・タイムアウト調整が容易)
- **不採用案**: 各スクリプトを丸ごと `common.py` 経由に書き換える案もあったが、戻り値整形ロジックは個別スクリプトに残し、ライブラリ層 (`common.py`) は薄く保つ方針

### [DECISION v13.3-02] `extract_close_series` の inline 定義を削除し、`common.py` から import に統一
- **対象**: `fetch_market_data.py` (16行)、`fetch_listed_alts.py` (16行)、`fetch_featured_charts.py` (yfinance パスは独自に実装していた、これも置換)、`fetch_valuations.py` (yf_close 内のロジックを `extract_close_series` で簡潔に)
- **判断**: `pd.MultiIndex` 列の吸収は微妙なバグの温床なので、テスト済みの 1 箇所に集約
- **効果**: 将来 yfinance の API 仕様が変わった時に 1 箇所修正で済む
- **テスト**: `tests/test_common.py::TestExtractCloseSeries` の 7 ケースが全 fetch スクリプトの挙動を担保

### [DECISION v13.3-03] `print(f"[OK]/[WARN]/[SKIP]/[INFO] ...")` を `log_*` に統一
- **背景**: 9 ファイル × 平均 4 箇所 = 約 40 箇所で `print` のフォーマットが微妙に揃っていなかった (`[OK] ` vs `[OK]   ` (3 spaces) の混在など)
- **判断**: `scripts.common` の `log_ok / log_warn / log_skip / log_info` に全置換
- **副次効果**: stderr 振り分け (`log_warn` だけ stderr) の一貫性が確保される
- **互換性**: 出力フォーマット (`[OK]   message`) は v13.0 当時の慣習と完全互換

### [DECISION v13.3-04] `datetime.now(timezone(timedelta(hours=9)))` を `jst_now()` / `jst_today_iso()` に集約
- **対象**: `fetch_news.py`, `archive_data.py`
- **判断**: JST タイムゾーン定義を `common.py` の `JST` 定数 1 箇所に集約
- **効果**: 「JST = 日本時間」という暗黙知のコード化、将来 DST がある国に展開する場合も `common.py` の `JST` を差し替えるだけ
- **また**: `datetime.now(timezone.utc).isoformat()` も `utc_now_iso()` に統一 (8 ファイル横断)

### [DECISION v13.3-05] `scripts/__init__.py` は新規追加しない (PEP 420 namespace package のまま)
- **背景**: `from scripts.common import ...` を成立させるには `scripts/__init__.py` を作るのが教科書的
- **判断**: 作らない。PEP 420 の namespace package 機能で十分動く
- **理由**:
  - 既存の `tests/conftest.py` は ROOT を sys.path に追加することで `scripts.common` を namespace package として解決
  - 各 `fetch_*.py` は冒頭で `sys.path.insert(0, str(Path(__file__).resolve().parent.parent))` する
  - `__init__.py` を追加すると、Actions の workflow で `PYTHONPATH=scripts` 環境変数を使った `from chart_universe import ...` のような sibling import の挙動が変わる懸念がある
- **検証**: pytest 18 ケース全 PASS、mock import で 10 モジュール全成功

---

## v13.2 で導入された決定

### [DECISION v13.2-01] Claude API を 4 分割 (1 回の Opus → Opus×2 + Sonnet + Haiku)
- **背景**: v7 の単一 Opus 呼び出しでは「Deep Dive 生成失敗 → 全コンテンツが消える」リスクがあった。また Muse のような軽い創作タスクに Opus は過剰
- **判断**: 4 つの呼び出しに分割。役割別モデル選択でコスト効率も改善
  - Call 1 (Opus 4.7): epigraph + headline + news + charts_of_the_day (最重要)
  - Call 2 (Opus 4.7): deep_dive (cadence 切替で平日/週次/月次)
  - Call 3 (Sonnet 4.6): central_bank_watch + pe_pd_view + real_assets_view
  - Call 4 (Haiku 4.5): funny_stories + economic_chart_of_the_day
- **失敗の独立性**: 各 try/except で独立処理。1 つ失敗しても他は生成される
  ([DECISION v13.2-02] の fallback 戦略と組み合わせ)
- **トレードオフ**:
  - メリット: 失敗独立性、Haiku/Sonnet でコスト ~30% 削減見込み、各 prompt が専用化されて品質向上余地
  - デメリット: ニュース一覧 (~6-8k tokens) を 4 回送る重複コスト、orchestration 複雑度↑
- **JSON schema 不変性**: 出力 `data/news.json` のキー構成は v7 と同一 — フロント側の改修不要

### [DECISION v13.2-02] 各 call が失敗した時の fallback dict をモジュール定数化
- **判断**: `_FALLBACK_NEWS_AND_CHARTS`, `_FALLBACK_DEEP_DIVE`, `_FALLBACK_CB_AND_ALTS`, `_FALLBACK_MUSE_AND_ECON` を上書き用 dict として固定
- **理由**:
  - call ごとに「何をフォールバックするか」が違う (例: news+charts 失敗時の epigraph は短い inspirational メッセージにする)
  - `result.update(_FALLBACK_X)` 1 行で merge できる
  - テスト時にも fallback 内容を assert できる
- **後続処理 (`attach_source_urls` / `normalize_chart_candidates`) は耐性あり**: news[] が空でも壊れないことを確認

### [DECISION v13.2-03] `_call_claude` ヘルパで 4 callers の共通処理を集約
- **判断**: 各 caller (`call_news_and_charts` 等) は (model, max_tokens, system, user_msg, label) を渡すだけ。msg.create + JSON 抽出 + コードブロック除去 + parse + ログは `_call_claude` に集約
- **効果**: 各 caller が ~15 行で済み、JSON parse のミスは 1 箇所で修正可能
- **`label` パラメータ**: ログ ([news+charts]) と error meta に使う。デバッグ時にどの call で失敗したかが即わかる

### [DECISION v13.2-04] `build_news_list()` で 4 callers の共通インプットを生成
- **背景**: 4 つの call はすべて「[N] 付きニュース一覧」を必要とする。各 caller でループを書くと重複
- **判断**: `build_news_list(items, max_items=150)` を共通ヘルパとして用意
- **効果**: items の整形ロジック変更 (例: max_items 調整、要約長カット) が 1 箇所で完結

### [DECISION v13.2-05] `determine_cadence()` は top-level に残置 (テスト互換性)
- **背景**: `tests/test_common.py` が `from scripts.fetch_news import determine_cadence` で import している
- **判断**: 4 分割後も `determine_cadence` を fetch_news.py の top-level で公開し続ける
- **不採用案**: `cadence.py` モジュールに切り出す案もあったが、テスト import パスを変えると CI が壊れる懸念があり保留

---

## v13.1.3 で導入された決定

### [DECISION v13.1.3-01] 残り 10 セクションを一括抽出 (4 段階フロント分割の最終段)
- **背景**: v13.1.2 で 6 セクション (独立性高) を抽出済み。残り 10 セクションは「内部にチャート系の subcomponent を持つ」「inline JSX のため新規抽出が必要」などの理由で後回しになっていた
- **判断**: 1 チャットでまとめて抽出 (= Phase 2 を完了)
- **理由**: パターンが Phase 1 で確立済 → Phase 2 を細分化する追加リスクは小さい
- **検証**: 17 ファイル (16 sections + main) の esbuild parse / 完全バンドル / 依存方向 grep / brace カウントで全 PASS

### [DECISION v13.1.3-02] `IndicatorChartsSection` と `NewsSection` は inline JSX → 新規抽出 (リネームではない)
- **背景**: 既存セクションのうち 2 つ (Section 7「重要指標・5年チャート」と Section 8「市場を動かしたニュース」) は MarketMonitor.jsx の inline JSX として書かれており、独立した関数定義がなかった
- **判断**: これらは新規コンポーネントとして抽出
- **副次設計**:
  - `IndicatorChartsSection`: `CHARTS` 定数 (6 銘柄 × 6 列タプル) と `HIGHLIGHT_DATE = "2026-02-27"` をモジュールスコープに格上げ
  - `NewsSection`: inline スタイル ({fontFamily, fontSize, color, ...}) をそのまま保持 (CSS module 化はスコープ外)
- **将来**: `mm-news-cell` の inline スタイルを CSS class に追い出すリファクタは v13.x ではやらない (動作不変原則)

### [DECISION v13.1.3-03] `SectorHeatmapSection` は内部 `useState` を持つ (sections の中で唯一の state-ful)
- **判断**: 期間タブ切替 (`day` / `week` / `month` / `ytd`) は 1 セクション内のローカル UI 状態として `useState` で管理
- **理由**: 親 (MarketMonitor) に lift up する必要がない。他のセクションが知る必要のない内部状態
- **副次設計**: `PERIOD_TABS` (タブ定義) と `PERIOD_CAP` (色強度の上限値) をモジュールスコープ定数化

### [DECISION v13.1.3-04] `ValuationSection` → `ValuationsSection`、`CentralBankWatch` → `CentralBanksSection` にリネーム
- **背景**: ROADMAP の命名規則が `XxxSection` に統一されている。リネーム済の 6 ファイルとも整合
- **判断**: import 名と export 名を `ValuationsSection` / `CentralBanksSection` に変更 (複数形 + Section suffix)
- **トレードオフ**: git diff が「ファイル名変更」+「中身も少し変わる」の混合になるが、命名一貫性のメリットが上回る

### [DECISION v13.1.3-05] `MarketTableSection` は Fragment を返す (heading + N 個の IndicesGroup)
- **判断**: section heading (`<div className="mm-section-tag">`) と複数の `IndicesGroup` を `<>...</>` で包む
- **理由**:
  - heading は単一セクションに 1 個、IndicesGroup は 5 個 (株式/為替/金利/コモディティ/ボラ) — outer div で wrap すると見た目の margin が変わる可能性
  - Fragment なら DOM 構造完全不変
- **MastheadSection の v13.1.2 設計と一貫**: 複数論理ブロックを 1 セクションコンポーネントで Fragment 返却

---

## v13.1.2 で導入された決定

### [DECISION v13.1.2-01] フロント分割は最終的に 4 段階に拡張 (3 → 4)
- **背景**: ROADMAP 当初の「3 段」(v13.1.0 / v13.1.1 / v13.1.2) では、v13.1.2 で 13 セクション全部を一括抽出する想定だった
- **判断**: v13.1.2 で 6 セクションだけ抽出 (Phase 1)、残り 8 セクションは v13.1.3 (Phase 2) に分離して **4 段** とする
- **理由**:
  - 1 回のチャットで 13 セクションを抽出するのは context window と認知負荷の両方で重い
  - 独立性の高いセクションを先にやることで、Phase 1 で抽出パターンの妥当性を確認 → Phase 2 でリスクの高い (Recharts チャート抱え, サブコンポーネント抱え) セクションに進める
  - 各 Phase で snapshot を取って実機照合すれば、回帰の切り分けが容易
- **トレードオフ**: チャット数が 1 つ増えるが、各回の作業は 1500 字以下の自然な粒度に収まる

### [DECISION v13.1.2-02] 切り出しは「独立性順」(Phase 1 と Phase 2 の振り分け基準)
- **判断**: 「props で受けた値しか使わない / 内部にチャート系の subcomponent を持たない / 共通サブを共有しない」を基準に、**独立性が高いものから先に抽出**
- **Phase 1 (v13.1.2)** に入れたもの (6 個):
  - `MastheadSection` — props は news/market のみ、JSX のみ
  - `EconomicChartSection` — props は econ のみ、内部 Recharts は単独使用
  - `DeepDiveSection` — props は article/chartUniverse/cadence、JSX のみ
  - `AlternativesSpotlightSection` — props は pePd/realAssets、内部 sub (`AltCategoryCard`) は他から参照されない
  - `MarketMuseSection` — props は news のみ、JSX のみ
  - `FooterSection` — props なし、JSX のみ
- **Phase 2 (v13.1.3)** に回したもの (10 個):
  - `FeaturedCharts` (FeaturedChart 内包、Recharts 重い)
  - `MarketTable + IndicesGroup` (テーブル+カード両表示で複雑)
  - `SectorHeatmap` (heatmap 算出ロジックあり)
  - `MacroBarometer` (FRED 18 指標で表が大きい)
  - `FundingVol` (Recharts チャート + 期間構造ロジック)
  - `Valuations` (MiniChart を共有、テーブル+カード+チャートのトリプル表示)
  - `CentralBanks` (`watch` と `factsByCode` の合成プロップ)
  - `IndicatorCharts` (現状 inline JSX、新規抽出が必要)
  - `News` (現状 inline JSX、impact バッジロジックあり)
  - `ListedAlts` (`ListedAltsPanel` + `ListedAltCard` の 2 段、Recharts 軸ロジックあり)
- **意図**: Phase 2 のものは内部に共通可能なサブコンポーネントを抱えているため、抽出時に「これは sections 内に隠すか、common に昇格させるか」の判断が必要。Phase 1 が安定してから腰を据えて取り組む

### [DECISION v13.1.2-03] Masthead/Epigraph/Ticker は 1 つのセクションに統合
- **判断**: ROADMAP の初期計画では 3 セクションとして並んでいた (Masthead / Epigraph / Ticker) が、`MastheadSection` 1 つにまとめた
- **理由**:
  - 視覚的に新聞紙面のヘッダ部 (見出し+引用+ティッカー) として一体運用される
  - Epigraph は条件付きレンダリング (`news.epigraph` がある時だけ)、Ticker は market から派生 — 個別 props にすると orchestrator 側のグルーが煩雑に
  - 「Masthead を変えたい」と言われた時、3 ファイル横断より 1 ファイル内のほうが AI 補助が安定
- **トレードオフ**: 単一テスト時、Epigraph だけ単独で render したい場面では `news.epigraph` モックが必要になる。だが運用上そんな単独テストは想定していない
- **Fragment 戻り値**: `<>...</>` で 3 ブロックを返すため、wrapper div を増やさずに済んでいる

### [DECISION v13.1.2-04] AltCategoryCard と ALT_IMPACT_CONFIG は section 内部に隠蔽
- **判断**: `AlternativesSpotlightSection.jsx` 1 ファイルに `ALT_IMPACT_CONFIG` (定数) + `AltCategoryCard` (内部関数) を同居させ、export しない
- **理由**:
  - `AltCategoryCard` は本セクション以外から参照されないため、`@/components/common` に上げる必要がない
  - `ALT_IMPACT_CONFIG` も同様、PE/PD と Real Assets 両方で使うが、その両方が同セクション内
  - 公開 API (`AlternativesSpotlightSection`) を small surface に保つ
- **将来の昇格条件**: 別セクションでも impact 表示が必要になったら `@/components/common` 行き

### [DECISION v13.1.2-05] FooterSection に version プロップを予約 (default 維持で挙動不変)
- **判断**: `<FooterSection version="v13.0" />` のように外から差し込み可能だが、`version="v13.0"` を default にして見た目を完全維持
- **理由**:
  - v13.1 系は内部リファクタなのでフッターのバージョン文字列は据え置き (kk のポリシー: ビルド出力を変えない)
  - 将来「自動でバージョンを刻む」ようにしたくなった時、orchestrator から渡せばよい
  - default 値の上書きで段階移行できる柔軟性を予約
- **不採用案**: `package.json` から動的読み出し (Vite で可能だが build constraint が増えるのでスキップ)

### [DECISION v13.1.2-06] `nowJst` / `latestAsOf` / `tickerCells` の算出を MastheadSection 内部に移す
- **判断**: 元々 `MarketMonitor` の本体関数で計算していた 3 つの派生値を `MastheadSection` 内部に移動
- **理由**:
  - これらは Masthead のヘッダー表示にしか使われていない (純粋に Masthead の責務)
  - orchestrator 側に残すと「セクション化したのに props 4 つも渡している」状態になる
  - props は `news` と `market` の 2 つだけに収まり、責務分離が明確に
- **トレードオフ**: `MarketMonitor.jsx` から `pickTicker` ヘルパーが消える分、本体がさらに薄くなる (304 行削減の一部)

### [DECISION v13.1.2-07] `museStories` 算出を MarketMuseSection 内部に移す
- **判断**: `news.funny_stories || (news.funny_story ? [news.funny_story] : [])` の旧単数→複数 fallback ロジックを `MarketMuseSection` 内部に隠蔽
- **理由**:
  - この fallback はほぼ歴史的経緯 (single→multi 移行時の互換) で、本セクション以外から参照されない
  - orchestrator 側に置いておくと、責務漏れに見えてきっかけがあれば移動したくなる。最初から正しい場所に置く
- **また**: `KIND_FALLBACKS = ["皮肉", "人間味", "観察"]` も同ファイル内のモジュールスコープ定数に格上げ (元は inline 配列リテラル)

---

## v13.1.1 で導入された決定

### [DECISION v13.1.1-01] CHART_UNIVERSE_LABELS の v13.1.0 不一致を修正
- **背景**: v13.1.0 で `theme.js` を新設した際、Project Knowledge にあった
  古い MarketMonitor.jsx (v5/v11 想定) を参照したため、`CHART_UNIVERSE_LABELS` の内容が
  実機 (v12 系) のものと乖離していた:
  - **誤**: `us02y: "米3ヶ月T-Bill"`
  - **正**: `us02y: "米2年債"`
  - **欠落**: `vix3m`, `move`, `emoas` の 3 エントリ
- **影響**: v13.1.0 では `theme.js` が `MarketMonitor.jsx` から未使用のため本番影響ゼロ。
  v13.1.1 で import を有効化する前に修正する必要があった
- **対応**: `theme.js` の `CHART_UNIVERSE_LABELS` を実機の本物に合わせて差し替え
- **副次効果**: v13.0 比でも改善 — Deep Dive の関連 key 表示で、これまで raw key 表示だった
  `vix3m / move / emoas` が日本語化される
- **再発防止**: snapshot 取得→実機ファイルを基準に編集する運用を徹底。
  Project Knowledge にあるコードは古い場合があるため、最新は必ず snapshot で確認する

### [DECISION v13.1.1-02] URL 定数は MarketMonitor.jsx に残す
- **判断**: `MARKET_URL`, `NEWS_URL` などのデータ取得先 URL は分離せず本体に維持
- **理由**:
  - データ取得は `MarketMonitor.jsx` のトップレベル `useEffect` 一箇所に集約されている
  - URL 定数を別ファイルに切り出すと、その別ファイルが MarketMonitor.jsx と
    `import.meta.env.BASE_URL` の両方に依存することになり、責務が曖昧になる
  - 一覧性: 「このアプリが何を fetch しているか」が一画面で見える方が良い
- **代替案**: `src/dataSources.js` のようなファイルを作る案もあったが上記理由で却下

### [DECISION v13.1.1-03] v12 → v13.1.x のヘッダコメントは履歴形式に変更
- **判断**: 冒頭コメントを単純な「v12」表記から、層状の履歴形式に変更
  ```jsx
  // MARKET MONITOR — v13.1.2
  //   • v12: Section numbering, ...
  //   • v13.1.0–.1: theme/utils/common を別ファイル化 + import 付け替え
  //   • v13.1.2: Masthead / EconomicChart / DeepDive / Alternatives / Muse / Footer
  //             を @/components/sections/ に切り出し (このファイル)
  ```
- **理由**: バージョンが進むごとに「このファイルで何が起きたか」が一目で分かる。
  詳細は `DECISIONS.md` に記録、ヘッダはサマリだけ
- **運用**: v13.1.3 以降も同形式を踏襲。古い行は適宜要約・削除して 5 行程度に保つ
  (実例: v13.1.2 では「v13.1.0 (土台ファイル新設) + v13.1.1 (import 付け替え)」を 1 行に圧縮した)

---

## v13.1 で導入された決定

### [DECISION v13.1-01] フロント分割は `@/` 単一エイリアスで進める
- **判断**: `@components/`, `@utils/` のような細分化はせず、`@/` → `src/` の 1 本のみ
- **実装**: `vite.config.js` の `resolve.alias` に 1 行追加
  ```js
  resolve: { alias: { "@": path.resolve(__dirname, "src") } }
  ```
- **理由**:
  - 設定が増えるとエイリアスの解決ルールが重複しやすく、IDE 補完や TypeScript 移行 (将来) の互換性も損なわれる
  - `@/components/common`, `@/utils`, `@/theme` のように長さも許容範囲
  - 単一の規則 ("@" は src ルート) なので新規ファイル追加時の判断が不要
- **トレードオフ**: import パスが微妙に長くなる場面はあるが、相対パス (`../../../utils`) を回避できる利点が勝る

### [DECISION v13.1-02] フロント分割は段階的に細分化
- **背景**: ROADMAP 当初は「3〜4 段階」と記載。MarketMonitor.jsx 約 1500 行を一発で分割するとリスクが高い
- **段階** (v13.1.2-01 で 4 段階に確定):
  - **v13.1.0**: 土台ファイルの新設のみ (本番に push してもビルド出力不変)
  - **v13.1.1**: MarketMonitor.jsx 冒頭の import 付け替え (JSX 本体は不変)
  - **v13.1.2**: 独立性の高い 6 セクションを切り出し (Phase 1)
  - **v13.1.3**: 残り 10 セクションを切り出し (Phase 2)
- **意図**: 各段階で `bash scripts/take_snapshot.sh` → 実機照合 → 次へ、の検証サイクルを回す
- **検証コスト**: 4 段階それぞれで動作確認するため検証回数が増えるが、回帰時のロールバック範囲が小さい利点が大きい

### [DECISION v13.1-03] コンポーネント間の依存方向を単方向に固定
- **規則**:
  ```
  theme.js (依存なし)
    ← utils.js
      ← components/common/*
        ← components/sections/* (v13.1.2 以降)
          ← MarketMonitor.jsx
  ```
- **理由**: 循環参照の余地をゼロにする。逆方向の import を見つけたら設計ミスのシグナル
- **検査コマンド**:
  ```bash
  grep -rn "from \"@/components/sections" src/{utils.js,theme.js,components/common} 2>/dev/null
  ```
  上記が何かヒットしたら違反。CI に組み込むかは v13.1.3 完了時に再検討
- **検証実績 (v13.1.2)**: grep で違反ゼロを確認

### [DECISION v13.1-04] `tone()` は utils.js に置く (色判定だが純関数優先)
- **判断**: 色を返す関数だが utils.js 側に配置 (theme.js には置かない)
- **理由**:
  - `tone()` の本質は「数値の符号 → 何かを返す」ロジックで、戻り値が色なのは偶然
  - theme.js は値の集合 (定数のみ)、utils.js は変換関数の集合、という線引きを保つ
  - utils.js が theme.js を import する向きにすれば依存方向は単方向
- **代替案**: theme.js に置く案もあったが、theme.js を「色のテーブル」だけに留めた方が将来の差し替えがしやすい

### [DECISION v13.1-05] PALETTE は CSS 変数と二重定義のまま維持
- **背景**: `index.css` の `:root` と `theme.js` の `PALETTE` で同じ値を 2 箇所書く
- **理由**: Recharts や inline style は CSS 変数を直接読めないため、JS 値が必要
  - HTML/CSS 側 (UI 全般): CSS 変数 `var(--accent)`
  - JS 側 (Recharts の `stroke`, inline `style`): `PALETTE.accent`
- **同期義務**: 値を変える時は両方を必ず一致させる。`theme.js` の冒頭コメントに明記
- **将来**: CSS 変数を JS 側から `getComputedStyle(document.documentElement).getPropertyValue('--accent')` で読む手もあるが、SSR や初期描画前のレースを考えるとリスクが大きい。現状維持で良い

---

## v13.0 で導入された決定

### [DECISION v13.0-01] 「土台拡充フェーズ」を機能追加と分離する
- **背景**: v12 系で機能拡充がひと段落。今後の保守性・コスト効率・運用品質を高めるため、機能追加を一旦止めて土台を整備する判断
- **方針**: v13 系全体を「土台拡充」と位置付け、各バージョンを以下の責務で分割:
  - v13.0: 共通モジュールの足場 (動作変えず)
  - v13.1: フロントのコンポーネント分割
  - v13.2: Claude API 呼び出しの分割
  - v13.3 以降の任意項目
- **理由**: 一度に全部やるとリスクが高く、問題発生時の切り分けが難しい。各段階で snapshot を取って動作確認できる粒度に区切る
- **詳細**: `ROADMAP.md` を新設して全体方針を文書化

### [DECISION v13.0-02] `scripts/common.py` を新設したが既存スクリプトはリファクタしない
- **背景**: 5 つの `fetch_*.py` で FRED API 呼び出しが重複、4 つで `extract_close_series` が重複している
- **新設内容**: `scripts/common.py` に以下を集約
  - `fred_observations()`, `fred_latest_value()` — FRED API client
  - `extract_close_series()` — yfinance MultiIndex 列吸収
  - `log_ok / log_warn / log_skip / log_info` — 共通ロガー (既存の `[OK]/[WARN]/[SKIP]` 慣習を踏襲)
  - `jst_today_iso / jst_now / utc_now_iso / utc_now / JST` — 日付ヘルパー
- **方針**: v13.0 では既存スクリプトをリファクタしない。`common.py` を「使える状態」にするだけ
- **理由**: 共通モジュール導入とリファクタを同時にやるとバグの切り分けが困難。v13.1 以降で 1 ファイルずつ慎重に置き換える
- **互換性**: 既存スクリプトは無修正で動作 (= v12.2 と完全に同じ挙動)

### [DECISION v13.0-03] `scripts/take_snapshot.sh` で改修確認フローを定着
- **背景**: 改修毎に kk が手動で zip コマンドを打つ運用は、コマンドを忘れる/再入力する手間がある
- **対応**: `scripts/take_snapshot.sh` をリポジトリに置き、`bash scripts/take_snapshot.sh` で 1 コマンド化
- **副次効果**: 除外パターンが固定化され、誤って `node_modules/` を含めてしまう事故を防ぐ
- **連携**: `.gitignore` の `*.zip` で git tracked にはならない (= push されない)
- **README に運用手順を明文化**

### [DECISION v13.0-04] pytest と Actions smoke test の導入
- **背景**: v13 でコード変更が増える前に、最低限の自動チェックの土台を作る
- **対応**:
  - `requirements.txt` に `pytest>=8.0.0` を追加
  - `tests/test_common.py` で `extract_close_series` (7 ケース)、日付ヘルパー、ロガー、`determine_cadence` の最小テスト (計 18 ケース)
  - `tests/conftest.py` で sys.path に `.` と `scripts/` を追加 (本番の PYTHONPATH=scripts 慣習をテストでも再現)
  - `pytest.ini` で testpath を指定
  - Actions ワークフローの最初に `Python smoke test` ステップを追加 (`import scripts.common` チェック + `pytest tests/`)
- **意図**: 大型リファクタ (v13.1, v13.2) で挙動が壊れた時に Actions が即座に検知してデプロイを止めるセーフティネット
- **将来**: テスト件数は今後 v13.x で順次増やす。当面は土台のみ

### [DECISION v13.0-05] サブエージェント機能の必要性 — 現時点では不要
- **検討対象**:
  - Claude Code subagents (CLI 開発支援用)
  - Anthropic Agent SDK subagents (API 経由で構築)
  - ワークフロー内 Claude API multi-call (= subagents 機能ではない)
- **結論**:
  - Claude Code subagents: 不要 (プロジェクト規模で並列探索が要らない)
  - Agent SDK subagents: 不要 (ETL パイプラインなので対話 agent 機能不要)
  - API multi-call 化: **v13.2 で実装する価値あり** (失敗の独立性 + Haiku 等のモデル使い分けで質とコストを両改善)
- **詳細**: `ROADMAP.md` の「サブエージェント機能の必要性」節を参照

---

## v12.2 で導入された決定

### [DECISION v12.2-01] GitHub Actions を Node 24 対応バージョンに更新
- **背景**: GitHub の deprecation 通告 — Node.js 20 が 2026年6月2日にデフォルト切替、9月16日に runner から完全削除
- **更新内容**:
  - `actions/checkout@v4` → `@v5` (2025年8月リリース、Node 24 対応)
  - `actions/setup-python@v5` → `@v6` (2026年1月リリース)
  - `actions/setup-node@v4` → `@v5` (Node 20 → 22 LTS にも引き上げ)
  - `actions/configure-pages@v4` → `@v5`
  - `actions/upload-pages-artifact@v3` → `@v4`
  - `actions/deploy-pages@v4` → `@v5`
- **方針**: `@v5` 系統 (安定リリース) で揃える。`@v6` も存在するが checkout など一部のみで、混在を避けるため統一
- **副次効果**: Node を 20 → 22 LTS に引き上げ。Vite の build 性能が若干向上する見込み
- **検証**: ローカルでの YAML 構文チェック済み、本番 Actions の実行で確認

### [DECISION v12.2-02] 色調をブルー × グリーン基調に変更
- **背景**: バーガンディ (`#8B2635`) と銅色 (`#B87333`) は新聞風の格調を狙ったが、機関投資家の視覚的期待に対しては暖色寄りで違和感があった (「サーモンピンク」と認識される)
- **新色**:
  - `--accent`: `#1A4D7A` (深いブルー、Bloomberg/FT 系金融情報誌のトーン)
  - `--accent2`: `#4A6E6A` (セージティール、`--up: #2D6A4F` とは色相を変えてある)
- **維持**: `--up: #2D6A4F` (上昇緑) と `--down: #C0392B` (下落赤) は慣習色なので変更しない
- **同期箇所**: `src/index.css` (CSS 変数) と `src/MarketMonitor.jsx` の `PALETTE` オブジェクト (Recharts 用) を必ず一致させる
- **影響範囲**: タイトル飾り罫、引用符マーク、リンク下線、Deep Dive 枠線、Funding/Vol カードのアクセント、ニュースカードのレジーム色など全体

### [DECISION v12.2-03] `.mm-alt-impact-label` の font-size を補修
- **背景**: v11 から継承した軽微な不備 (前回の動作検証で発見)
- **対応**: `font-size: 10.5px` を CSS に追加。`.mm-alt-impact-arrow` (11px) と整合させ、letter-spacing と font-family も明示

### [DECISION v12.2-04] ルート残骸ファイルの削除
- **対象**: v11 以前の遺物として残っていた以下 4 ファイル
  - `MarketMonitor.jsx` (現行は `src/` 配下にあるべき)
  - `chart_universe.py` (現行は `scripts/` 配下)
  - `daily-update.yml` (現行は `.github/workflows/` 配下)
  - `fetch_market_data.py` (現行は `scripts/` 配下)
- **問題**: ビルドや実行には影響しないが、リポジトリの混乱要因
- **対応**: zip では削除できないため、展開後に `git rm` で明示的に削除する手順を README と DECISIONS に明記

### [DECISION v12.2-05] README を v12 構成に合わせて全面書き換え
- **旧版の誤り**: 「毎朝 7 時 (JST)」、claude-opus 旧モデル名、v11 以前のページ構成
- **新版**: cron は 8 時、claude-opus-4-7、v12 のページ構成 (1〜9 章 + 補助セクション)、現状 14 RSS、archive レイヤ、Stale Data 警告

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
