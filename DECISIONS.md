# Decisions Log — Market Monitor

主要な技術的決定とその背景・トレードオフを記録する。
バージョンが上がっても、なぜそうなっているのかを後から辿れるようにするための文書。

新しい決定は先頭に追記する (新→古の順)。

---

## v13.4.0 で導入された決定 (実装フェーズ着手)

v13.4 計画フェーズ (v13.4-plan-01 〜 06) の方針を踏まえ、Tier 1 の中でも特に
コスト低・効果大の項目を v13.4.0 として一括導入。

### [DECISION v13.4.0-01] Ruff lint のみ導入、formatter は v13.4.0 では強制しない
- **背景**: Black 互換の Ruff formatter を `chart_universe.py` / `fetch_market_data.py` 等に適用すると、新聞風に整列されたテーブル状リテラル (`CHART_UNIVERSE`, `INSTRUMENTS` 等) が多行展開され、kk の「新聞風の格調」と相性が悪い
- **検証**: `ruff format` 試行で 11 ファイル / 1,061 insertions + 490 deletions の大幅変更を確認。整列されたコラム表示が破壊される
- **判断**: v13.4.0 では `ruff check --fix` のみ適用 (45 件自動修正)。formatter は導入見送り
- **トレードオフ**:
  - メリット: 新聞風整列が保持される、diff が小さく review しやすい
  - デメリット: 新規コードの整形は手動責任。kk が一人なので問題は小さい
- **将来計画**: v13.4.1 以降で `# fmt: off` ブロック付きの個別対応として formatter 導入を再検討。または formatter は意図的に永続不採用とする可能性もある
- **採用ルール**: E / W / F / I / B / UP / SIM / C4 / PIE / RUF
- **除外ルール**: E501 (行長) / B008 / B023 (closure pattern、v13.4.1 で修正後に再有効化予定) / SIM108 / RUF001-003 (全角文字検出) / UP007

### [DECISION v13.4.0-02] B023 は ignore して v13.4.1 で default-arg pattern により正しく fix する
- **背景**: `fetch_listed_alts.py` の `_at()` / `_at_date()` 内部関数 (ループ内で定義) が `close` / `last_date` を closure 経由で参照しており、Ruff が B023 (loop variable capture) として 23 件警告
- **実態**: 内部関数はループ内で即時消費されるため、動作上のバグは存在しない (false positive)
- **判断**: v13.4.0 では `ignore = ["B023", ...]` で抑制。動作変更を伴うため別バージョンで対応
- **v13.4.1 での修正方針**: default-arg binding パターンで closure を明示化:
  ```python
  def _at(days_back, *, close=close, last_date=last_date) -> float | None:
      ...
  ```
  動作は完全に同一。修正後に `B023` を ignore から外して再有効化
- **不採用案**:
  - `# noqa: B023` を 23 箇所に追加: ノイズが多い、根本対処にならない
  - 内部関数を module-level にリフト: 引数が増えてシグネチャが汚れる

### [DECISION v13.4.0-03] CI ワークフローは `daily-update.yml` と分離 (`ci.yml` 新設)
- **背景**: 既存 `daily-update.yml` は production fetch + deploy 用 (cron + push to main)。ここに PR チェックを混ぜると役割が混在
- **判断**: 新規 `.github/workflows/ci.yml` を新設。PR と main 以外への push で発火 (`branches-ignore: [main]`)
- **CI スコープ**: Python (Ruff lint + pytest) + Frontend (ESLint + Vite build)。fetch スクリプトは実行しない (API キーが secrets で fork からは見えないため CI でも実行不可)
- **`daily-update.yml` への追加**: Ruff lint ステップだけは追加 (zip + main 直 push でも lint 違反を検知できるように)
- **トレードオフ**: workflow が 2 つになるが、責務分離のメリットが上回る

### [DECISION v13.4.0-04] Dependabot は major version 更新を ignore (手動確認)
- **背景**: React 19 / Vite 6 / Recharts 3 など major 更新は破壊的変更を含み、自動 PR で merge できない
- **判断**: `version-update:semver-major` を ignore。minor/patch のみ自動 PR
- **検査スコープ**: npm + pip + github-actions の 3 つ、週次 (月曜 08:00 JST)
- **PR 上限**: npm 5 件 / pip 5 件 / actions 3 件 (溜まりすぎないように)
- **major 更新の運用**: kk が四半期に 1 度くらい手動で `npm outdated` / `pip list --outdated` をチェックし、必要に応じて個別検討

### [DECISION v13.4.0-05] Prettier は config のみ用意、CI では check しない
- **背景**: Prettier も Ruff formatter と同様、`MarketMonitor.jsx` の整列された useState 宣言や URL 定数を多行展開してしまう
- **検証**: Prettier dry-run で 24 ファイルが「整形対象」として検出された。`MarketMonitor.jsx` の fetch チェーンは inline 整形を維持できず多行化される
- **判断**: `.prettierrc.json` と `npm run format` / `npm run format:check` スクリプトは用意するが、CI では `--check` しない。新規ファイル整形時に手動で使う想定
- **トレードオフ**: フロントエンドの style 強制は ESLint に一任 (ESLint は既存コードに 0 件 issue、最低限の品質ガードは効いている)

### [DECISION v13.4.0-06] ESLint は flat config (v9 形式) で導入、React/React Hooks 最低限のみ
- **判断**: ESLint v9 の flat config (`eslint.config.js`) を採用。`eslint-plugin-react` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` の最低限
- **無効化**: `react/react-in-jsx-scope` (新 JSX transform で不要) / `react/prop-types` (v17.0 で TS 移行予定のため不要)
- **`react-refresh/only-export-components`**: warn 扱い (sections/ で補助コンポーネントを export しているケースを許容)
- **`prettier-eslint` integration**: 不採用。formatter は Prettier 単独 (CLI) で完結させる。`eslint-config-prettier` だけ最後にロードして style 系のルール衝突を回避

---

## v13.4 計画フェーズで導入された決定 (2026-05-12)

### [DECISION v13.4-plan-01] 業界標準項目を Tier 1/2/3 に分類し、Tier 3 は明示的にやらないと決める
- **背景**: kk のプロジェクトはエンタープライズ基準で見ると未実装項目が多い (Linter, 型チェック, エラー監視, PR フロー, etc.)。「全部やる」のは個人プロジェクトには明らかに過剰、「全部やらない」のは保守性で痛む
- **判断**: 未実装項目を 3 階層に分類し、Tier 1/2 は実装、Tier 3 は明示的に「やらない」と決める
  - **Tier 1 (確実にやる、v13.4)**: Ruff + ESLint + Prettier / ブランチ保護 / Runbook / Dependabot / common.py の mypy strict 化
  - **Tier 2 (検討の価値あり、v13.5)**: Sentry / Lighthouse CI / Codecov / Cloudflare Pages PR preview
  - **Tier 3 (やらない)**: E2E テスト / 構造化ログ集約 / Feature flag / SLO/SLA / 有料 SaaS / Datadog APM
- **理由**: 「やらないこと」を明文化することで、ロードマップ完遂後に「未達成項目」として気に病まなくて済む。完璧主義の罠を避ける
- **詳細**: `ROADMAP.md` の「明示的にやらないこと (Tier 3)」節を参照
- **評価軸 (Tier 判定基準)**:
  - 単独開発 + AI 補助 の文脈で価値が出るか
  - 無料サービスで完結するか
  - 長期運用 (3 ヶ月後の自分が他人になる前提) で効くか
  - AI 補助 (Claude) の精度向上に直接寄与するか

### [DECISION v13.4-plan-02] PR フローはハイブリッド運用 (zip + main 直 push を残す)
- **背景**: 業界標準では PR ベースの運用が当然だが、kk は zip + Codespaces `unzip -o` のフローを認知負荷の低さから好む。これを完全に PR に置き換えるのは現実的でない
- **判断**: 変更規模に応じた 3 段ハイブリッド運用
  - **小修正 (1-2 ファイル)**: zip + main 直 push (現行維持)
  - **中規模変更 (1 セクション追加など)**: zip → branch 切って push → PR → Claude レビュー → CI 通過後 merge
  - **大型変更 (TS 移行、新セクション群)**: PR 前提・複数 PR 分割
- **ブランチ保護との整合**: CODEOWNERS で kk を sole reviewer に設定。自分自身を承認者にすれば PR フローも回せるし、bot (Actions の自動コミット) は例外設定で通過させる
- **理由**: kk の利便性 (zip の即時性) と業界標準 (PR のレビュー履歴) の両立。完全置換はトレードオフが見合わない
- **代替案 (不採用)**: 全変更 PR 前提に統一する案 — 小修正の度に branch を切るのは過剰、AI 配布の特性 (zip 形式) との相性も悪い

### [DECISION v13.4-plan-03] Japan Equities Layer を v16 系として独立した枝で位置付け
- **背景**: kk は機関投資家業務の傍ら、個人で日本株個別投資 (TOB 関連 / リサーチ不足小型株) を行っている。これに有用な機能 (EDINET 大量保有 / TDnet 適時開示 / TOB スプレッド / 小型株スクリーナー) を dashboard に統合したい
- **判断**: グローバル・マクロ系の既存 dashboard とは独立した枝 (v16 系) として実装。新セクション「10. 日本株ウォッチ」を追加
- **データ層は完全に独立**: 新規 `fetch_edinet_filings.py`, `fetch_tdnet_disclosures.py`, `fetch_tob_active.py`, `fetch_jp_screener.py` を追加。既存スクリプトには影響を与えない
- **設計原則**: dashboard 上で「買い」「売り」の判断材料に見える構造は避ける。「シグナル」「アラート」のような断定的ラベルではなく、「最近の開示」「該当企業」の中立的表現で統一。投資判断は dashboard を起点として個別リサーチで行う、という線を技術的にも保つ
- **アクティビスト watchlist**: シティインデックス系 / ダルトン / Strategic Capital / 3D Investment Partners / エフィッシモ / オアシス / 村上系
- **データソース**: 全て無料公開 (EDINET API, TDnet RSS, JPX 公開データ)
- **Claude API への影響**: 機械的フィルタリングが中心、要約は最小限 (必要なら Haiku 4.5 で月数十円)

### [DECISION v13.4-plan-04] TypeScript 移行は v17.0 の大型作業として独立、Phase 1/2/3 後に実施
- **背景**: AI 補助時代の個人開発において TS 化は最大の投資の一つ。Claude は JSX より TSX のほうがはるかに精度の高い補助を出せる。一方で 16 セクション全体の型化は 2-4 週間の本格作業
- **判断**: v13.4 / v13.5 (土台固め) と v16.0 (新機能の即応) を先に完了させ、v14.0 (archive UI) も済ませてから v17.0 として腰を据えて取り組む
- **段階的移行**: `tsconfig.json` で `allowJs: true` から開始、最終的に strict 化。1 PR で 1-2 セクションに分割
- **理由**: 大型作業を Phase 1 の最初に置くと、新機能 (v16.0) の着手が遅れる。逆に Phase 1/2 を済ませてからの方が、TS 化対象のコードが安定している
- **代替案 (不採用)**: Tier 1 の一部として v13.4 に含める案 — 規模が大きすぎて v13.4 のスコープが破綻する

### [DECISION v13.4-plan-05] パターン C (交互前進) を基本線として採用
- **背景**: 議論の過程で 4 つのロードマップパターンが検討された
  - A: 保守第一 (リファクタを全部終わらせてから新機能)
  - B: 個人投資直行 (Japan Layer を最優先)
  - C: 交互前進 (リファクタと新機能を交互に挟む)
  - D: マクロ深化 (機関投資家業務 dashboard の更なる深化)
- **判断**: パターン C を採用
- **理由**:
  - v13.4 の小さなリファクタは v16 系の安全性に直結する (新規 fetch スクリプト追加時、既存への副作用を確認できる手段が必要)
  - 個人投資への関心は「熱いうちに着手」した方がコミットメントが続く
  - Python 中心の v16 系と React 中心の v14 が交互に来ることで作業の単調化を回避
- **D 不採用の理由**: 個人投資 (TOB / 小型株) への関心に応えないため、kk の現在のニーズと整合しない
- **A 不採用の理由**: 個人投資ニーズへの対応が数ヶ月遅れ、関心が冷めるリスク
- **B 不採用の理由**: テスト不足のまま新規スクリプト 4-5 本を追加することになり、回帰リスクが高まる

### [DECISION v13.4-plan-06] 月額コスト 0 円維持を方針として確定
- **背景**: 現状の Anthropic API コストが月 1,000-1,200 円。これに有料 SaaS を上乗せすると見過ごせない額になりかねない
- **判断**: 業界標準ツールの導入は全て free tier 内で完結させる
  - Sentry: free tier (個人プロジェクト規模なら events 数が free tier 内に収まる)
  - Codecov: public repo は無料
  - Cloudflare Pages: free tier で月 500 ビルドまで
  - Lighthouse CI: GitHub Actions 内で完結
  - Dependabot: GitHub 標準機能で無料
- **意思**: 有料 SaaS (Datadog, LaunchDarkly, Sentry Pro 等) は明示的に Tier 3 に分類
- **見直し条件**: イベント数や利用量が free tier 上限を超えるようになったら個別に再検討

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
- **Phase 1 (v13.1.2)** に入れたもの (6 個): MastheadSection / EconomicChartSection / DeepDiveSection / AlternativesSpotlightSection / MarketMuseSection / FooterSection
- **Phase 2 (v13.1.3)** に回したもの (10 個): FeaturedCharts / MarketTable / SectorHeatmap / MacroBarometer / FundingVol / Valuations / CentralBanks / IndicatorCharts / News / ListedAlts
- **意図**: Phase 2 のものは内部に共通可能なサブコンポーネントを抱えているため、抽出時に「これは sections 内に隠すか、common に昇格させるか」の判断が必要。Phase 1 が安定してから腰を据えて取り組む

### [DECISION v13.1.2-03] Masthead/Epigraph/Ticker は 1 つのセクションに統合
- **判断**: ROADMAP の初期計画では 3 セクションとして並んでいたが、`MastheadSection` 1 つにまとめた
- **理由**:
  - 視覚的に新聞紙面のヘッダ部 (見出し+引用+ティッカー) として一体運用される
  - 「Masthead を変えたい」と言われた時、3 ファイル横断より 1 ファイル内のほうが AI 補助が安定
- **Fragment 戻り値**: `<>...</>` で 3 ブロックを返すため、wrapper div を増やさずに済んでいる

### [DECISION v13.1.2-04] AltCategoryCard と ALT_IMPACT_CONFIG は section 内部に隠蔽
- **判断**: `AlternativesSpotlightSection.jsx` 1 ファイルに `ALT_IMPACT_CONFIG` (定数) + `AltCategoryCard` (内部関数) を同居させ、export しない
- **理由**: `AltCategoryCard` は本セクション以外から参照されないため、`@/components/common` に上げる必要がない。公開 API を small surface に保つ
- **将来の昇格条件**: 別セクションでも impact 表示が必要になったら `@/components/common` 行き

### [DECISION v13.1.2-05] FooterSection に version プロップを予約 (default 維持で挙動不変)
- **判断**: `<FooterSection version="v13.0" />` のように外から差し込み可能だが、`version="v13.0"` を default にして見た目を完全維持
- **理由**: 将来「自動でバージョンを刻む」ようにしたくなった時、orchestrator から渡せばよい

### [DECISION v13.1.2-06] `nowJst` / `latestAsOf` / `tickerCells` の算出を MastheadSection 内部に移す
- **判断**: 元々 `MarketMonitor` の本体関数で計算していた 3 つの派生値を `MastheadSection` 内部に移動
- **理由**: これらは Masthead のヘッダー表示にしか使われていない (純粋に Masthead の責務)。props は `news` と `market` の 2 つだけに収まり、責務分離が明確に

### [DECISION v13.1.2-07] `museStories` 算出を MarketMuseSection 内部に移す
- **判断**: `news.funny_stories || (news.funny_story ? [news.funny_story] : [])` の旧単数→複数 fallback ロジックを `MarketMuseSection` 内部に隠蔽
- **理由**: この fallback はほぼ歴史的経緯で、本セクション以外から参照されない

---

## v13.1.1 で導入された決定

### [DECISION v13.1.1-01] CHART_UNIVERSE_LABELS の v13.1.0 不一致を修正
- **背景**: v13.1.0 で `theme.js` を新設した際、Project Knowledge にあった古い MarketMonitor.jsx (v5/v11 想定) を参照したため、`CHART_UNIVERSE_LABELS` の内容が実機 (v12 系) のものと乖離していた
- **影響**: v13.1.0 では `theme.js` が未使用のため本番影響ゼロ。v13.1.1 で import を有効化する前に修正する必要があった
- **対応**: `theme.js` の `CHART_UNIVERSE_LABELS` を実機の本物に合わせて差し替え
- **再発防止**: snapshot 取得→実機ファイルを基準に編集する運用を徹底

### [DECISION v13.1.1-02] URL 定数は MarketMonitor.jsx に残す
- **判断**: `MARKET_URL`, `NEWS_URL` などのデータ取得先 URL は分離せず本体に維持
- **理由**: データ取得は `MarketMonitor.jsx` のトップレベル `useEffect` 一箇所に集約されている。一覧性: 「このアプリが何を fetch しているか」が一画面で見える方が良い

### [DECISION v13.1.1-03] v12 → v13.1.x のヘッダコメントは履歴形式に変更
- **判断**: 冒頭コメントを単純な「v12」表記から、層状の履歴形式に変更
- **理由**: バージョンが進むごとに「このファイルで何が起きたか」が一目で分かる
- **運用**: v13.1.3 以降も同形式を踏襲。古い行は適宜要約・削除して 5 行程度に保つ

---

## v13.1 で導入された決定

### [DECISION v13.1-01] フロント分割は `@/` 単一エイリアスで進める
- **判断**: `@components/`, `@utils/` のような細分化はせず、`@/` → `src/` の 1 本のみ
- **理由**: 設定が増えるとエイリアスの解決ルールが重複しやすく、IDE 補完や TypeScript 移行 (将来) の互換性も損なわれる

### [DECISION v13.1-02] フロント分割は段階的に細分化
- **段階** (v13.1.2-01 で 4 段階に確定):
  - **v13.1.0**: 土台ファイルの新設のみ (本番に push してもビルド出力不変)
  - **v13.1.1**: MarketMonitor.jsx 冒頭の import 付け替え (JSX 本体は不変)
  - **v13.1.2**: 独立性の高い 6 セクションを切り出し (Phase 1)
  - **v13.1.3**: 残り 10 セクションを切り出し (Phase 2)

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

### [DECISION v13.1-04] `tone()` は utils.js に置く (色判定だが純関数優先)
- **判断**: 色を返す関数だが utils.js 側に配置 (theme.js には置かない)
- **理由**: `tone()` の本質は「数値の符号 → 何かを返す」ロジック。theme.js は値の集合、utils.js は変換関数の集合、という線引きを保つ

### [DECISION v13.1-05] PALETTE は CSS 変数と二重定義のまま維持
- **背景**: `index.css` の `:root` と `theme.js` の `PALETTE` で同じ値を 2 箇所書く
- **理由**: Recharts や inline style は CSS 変数を直接読めないため、JS 値が必要
- **同期義務**: 値を変える時は両方を必ず一致させる。`theme.js` の冒頭コメントに明記

---

## v13.0 で導入された決定

### [DECISION v13.0-01] 「土台拡充フェーズ」を機能追加と分離する
- **背景**: v12 系で機能拡充がひと段落。今後の保守性・コスト効率・運用品質を高めるため、機能追加を一旦止めて土台を整備する判断
- **方針**: v13 系全体を「土台拡充」と位置付け、各バージョンを以下の責務で分割:
  - v13.0: 共通モジュールの足場 (動作変えず)
  - v13.1: フロントのコンポーネント分割
  - v13.2: Claude API 呼び出しの分割
  - v13.3: common.py の全面活用
- **詳細**: `ROADMAP.md` を新設して全体方針を文書化

### [DECISION v13.0-02] `scripts/common.py` を新設したが既存スクリプトはリファクタしない
- **新設内容**: `scripts/common.py` に以下を集約
  - `fred_observations()`, `fred_latest_value()` — FRED API client
  - `extract_close_series()` — yfinance MultiIndex 列吸収
  - `log_ok / log_warn / log_skip / log_info` — 共通ロガー
  - `jst_today_iso / jst_now / utc_now_iso / utc_now / JST` — 日付ヘルパー
- **方針**: v13.0 では既存スクリプトをリファクタしない。`common.py` を「使える状態」にするだけ
- **理由**: 共通モジュール導入とリファクタを同時にやるとバグの切り分けが困難

### [DECISION v13.0-03] `scripts/take_snapshot.sh` で改修確認フローを定着
- **対応**: `scripts/take_snapshot.sh` をリポジトリに置き、`bash scripts/take_snapshot.sh` で 1 コマンド化
- **連携**: `.gitignore` の `*.zip` で git tracked にはならない

### [DECISION v13.0-04] pytest と Actions smoke test の導入
- **対応**:
  - `requirements.txt` に `pytest>=8.0.0` を追加
  - `tests/test_common.py` で 18 ケース
  - Actions ワークフローの最初に `Python smoke test` ステップを追加

### [DECISION v13.0-05] サブエージェント機能の必要性 — 現時点では不要
- **結論**:
  - Claude Code subagents: 不要
  - Agent SDK subagents: 不要
  - API multi-call 化: v13.2 で実装する価値あり

---

## v12.2 で導入された決定

### [DECISION v12.2-01] GitHub Actions を Node 24 対応バージョンに更新
- **更新内容**: `actions/checkout@v4` → `@v5`、`actions/setup-python@v5` → `@v6`、`actions/setup-node@v4` → `@v5` (Node 20 → 22 LTS)、`actions/configure-pages@v4` → `@v5`、`actions/upload-pages-artifact@v3` → `@v4`、`actions/deploy-pages@v4` → `@v5`

### [DECISION v12.2-02] 色調をブルー × グリーン基調に変更
- **新色**:
  - `--accent`: `#1A4D7A` (深いブルー、Bloomberg/FT 系金融情報誌のトーン)
  - `--accent2`: `#4A6E6A` (セージティール)
- **維持**: `--up: #2D6A4F` (上昇緑) と `--down: #C0392B` (下落赤) は慣習色なので変更しない

### [DECISION v12.2-03] `.mm-alt-impact-label` の font-size を補修
- **対応**: `font-size: 10.5px` を CSS に追加。`.mm-alt-impact-arrow` (11px) と整合

### [DECISION v12.2-04] ルート残骸ファイルの削除
- **対象**: `MarketMonitor.jsx` / `chart_universe.py` / `daily-update.yml` / `fetch_market_data.py` の root 直下残骸

### [DECISION v12.2-05] README を v12 構成に合わせて全面書き換え

---

## v12.1 で導入された決定

### [DECISION v12.1-01] Listed Alternatives Proxies のチャートに軸を追加
- **修正**: X 軸: 月単位の tick (`MM/YY` 形式)、Y 軸: 右寄せ、`CartesianGrid` 水平のみ薄く追加、`Tooltip` 追加
- **CSS 影響**: `.mm-alts-spark` の高さを 50px → 110px (モバイル時 90px)

---

## v12 で導入された決定

### [DECISION v12-01] セクション番号をローマ → アラビア数字に統一
### [DECISION v12-02] Claude モデルを `claude-opus-4-7` に更新
### [DECISION v12-03] zip 投入フローを簡素化
### [DECISION v12-04] Stale Data 警告バーを UI に追加 (36 時間閾値)
### [DECISION v12-05] 信用市場グループの強調
### [DECISION v12-06] ボラティリティ・ファンディング・パネル新設 (VIX 期間構造 / MOVE / SOFR-IORB)
### [DECISION v12-07] Listed Alternatives Proxies 新設 (PSP/BIZD/IFRA/NFRA/VNQ/1343.T)
### [DECISION v12-08] Deep Dive アーカイブ機構 (`data/archive/YYYY-MM-DD/`)
### [DECISION v12-09] 週末・月初の Deep Dive を長尺総括モードに
### [DECISION v12-10] プレースホルダ JSON はコミット済みデータが兼任

---

## v11 以前の決定 (継続)

### [DECISION] バリュエーション指標の Shiller データ取得
- **取得方法**: `pandas.read_html()` で月次テーブルをパース
- **依存パッケージ**: `lxml`, `beautifulsoup4`, `html5lib`

### [DECISION] Bloomberg / WSJ / FT は Google News RSS 経由
- **背景**: 公式RSSが廃止 (Bloomberg/WSJ) または有料 (FT)
- **方法**: `https://news.google.com/rss/search?q=site:bloomberg.com+when:1d&...` で代替

### [DECISION] 日銀の政策金利系列を修正
- **誤り**: `IRSTCI01JPM156N` (3M money market 近似)
- **正解**: `IRSTCB01JPM156N` (Central Bank Rate)
- **波及**: BOE/BOC/SNB/RBA/RBNZ も `IRSTCB01...` ファミリーに統一

### [DECISION] 中銀コメントは単一文章形式
- **現行**: `comment` 単一フィールド (200-350字)
- **理由**: 毎日4要素を埋めると冗長、当日トピックに集中した自然な日本語の方が読みやすい

### [DECISION] Claude API で一括生成
- **モデル**: v12 で `claude-opus-4-5` → `claude-opus-4-7`、v13.2 で 4 分割
- **コスト**: 月額約1,600円 → v13.2 後は 1,000-1,200円見込み

### [DECISION] ソースリンクの紐付け方式
- **手法**: Claude には記事ごとに `[N]` インデックス番号を提示し、`source_index: N` で参照させる
- **理由**: Claude に URL を直接生成させると hallucination リスク

### [DECISION] 注目チャート3本の選定はリトライ型
- **手法**: Claude は 5-8 候補を優先度順に提示、Python が上から取得試行、最初の3本成功で確定

### [DECISION] バリュエーション指標は5本
- Shiller CAPE / Buffett Indicator 近似 / S&P 500 配当利回り / Fed Model / VVIX/VIX 比率

### [DECISION] CSS は外部ファイル化必須
- **バグ**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minified 変数名 `${D.x}` に置換し、本番環境でスタイルが剥がれる
- **対応**: インラインCSSは禁止、CSS変数 (`var(--accent)`) で管理、外部 .css ファイル
