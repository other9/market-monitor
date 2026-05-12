# RUNBOOK — Market Monitor

運用上のトラブルシューティングと過去のインシデント記録。
README が「使い方の入り口」なら、これは「障害時の最初の参照先」。

> 履歴は新しいものを上に追記する。古い事例も削らずに残す (パターンの再発検知が目的)。

最終更新: 2026-05-12 (v13.4.2 で `docs/RUNBOOK.md` 新設)

---

## 目次

1. [Quality gates が失敗した時](#1-quality-gates-が失敗した時) — Ruff / mypy / pytest / ESLint / Vitest / Vite build
2. [Actions ワークフローが失敗した時](#2-actions-ワークフローが失敗した時) — daily-update.yml / ci.yml
3. [外部 API のトラブル](#3-外部-api-のトラブル) — yfinance / FRED / Anthropic
4. [UI に問題が出ている時](#4-ui-に問題が出ている時)
5. [zip 適用後の症状](#5-zip-適用後の症状)
6. [過去のインシデント](#6-過去のインシデント) — 再発防止用の時系列ログ

---

## 1. Quality gates が失敗した時

v13.4.0 以降、PR と main 直 push で以下の quality gates が自動実行される。失敗時の典型対応:

### Ruff lint (Python)

```bash
ruff check .                   # 失敗内容の確認
ruff check . --fix             # 自動修正可能なものは fix する
ruff check . --statistics      # ルール別の件数
```

- **import 順序エラー (I001)** → `ruff check . --fix` で解決
- **未使用 import (F401)** → 同上
- **`datetime.timezone.utc` → `datetime.UTC` (UP017)** → 自動修正可能、Python 3.11+ で利用
- **B023 (loop variable capture)** → false positive の場合は default-arg binding (`*, close=close`) で明示束縛 (DECISION v13.4.1-02 参照)
- **E402 (module level import not at top)** → 意図的な `sys.path.insert` 後の import なら `# noqa: E402 — sys.path 操作後の意図的な import` を付与

### mypy strict (Python 型チェック)

```bash
mypy                           # pyproject.toml の files= 設定に従う
mypy scripts/common.py --strict --show-error-codes   # 個別実行
```

- v13.4.1 時点で対象は `scripts/common.py` のみ
- **import-untyped エラー** → `pandas-stubs` / `types-requests` を `requirements.txt` に追加するか、`[[tool.mypy.overrides]]` で `ignore_missing_imports = true`
- **unreachable エラー** → 型システムの推論と runtime 実態にズレがある場合 (例: yfinance の `df["Close"]` が DataFrame を返すケース)。`# type: ignore[unreachable]` でコメント付きの抑制が許容される (DECISION v13.4.1-03)
- **「mypy が common.py を strict で通すのに新規 fetch スクリプトを段階展開するには」** → `pyproject.toml` の `[tool.mypy] files = [...]` に追加

### pytest (Python テスト)

```bash
pytest tests/ -v               # 詳細表示
pytest tests/ -k "test_name"   # 特定テストのみ
pytest tests/ --tb=long        # 詳細スタックトレース
```

- **35 件構成** (v13.4.2 時点):
  - `test_common.py` (18): 共通モジュール基本動作
  - `test_fetch_market_data.py` (9): yfinance mock 統合テスト
  - `test_fetch_macro_indicators.py` (8): FRED mock 統合テスト
- **新規 fetch スクリプト追加時**: mock パターンの参考に `test_fetch_market_data.py` / `test_fetch_macro_indicators.py` を見る
- **既存テストが落ちる時**: `scripts/common.py` の interface 変更が前提を壊している可能性 (テスト失敗の関数名から推測)

### ESLint (JS lint)

```bash
npm run lint                   # 失敗内容の確認
npm run lint:fix               # 自動修正
```

- v13.4.0 時点で既存コードは 0 issues。新規ファイル追加で issue が出ることが多い
- **react/no-unknown-property** → SVG プロパティを camelCase で書いていないなど
- **react-hooks/exhaustive-deps** → useEffect の dependencies 欠落。意図的な場合は `// eslint-disable-next-line react-hooks/exhaustive-deps`

### Vitest スナップショット (JS テスト)

```bash
npm run test:ci                # CI モードで 1 回実行
npm run test                   # watch モード (開発時)
npm run test:ci -- -u          # スナップショット更新 (UI 変更が意図的な時のみ)
npm run test:ui                # ブラウザ UI で diff 確認
```

- **スナップショット diff が出た時の判断**:
  1. **意図しない変更** → コードのリグレッション。元のコードを直す
  2. **意図的な UI 変更** → `npm run test:ci -- -u` で更新 → 差分を `git diff src/__tests__/__snapshots__/` で再確認 → PR コミット
- **新規セクション追加時**: `src/__tests__/sections.test.jsx` にエントリ 1 件追加 + `fixtures.js` に必要なら mock データ追加
- **ExternalLink のリグレッションガード** (`a.getAttribute("target") === "_blank"` 等) は スナップショットとは別の明示的 assert。これが落ちたらセキュリティ属性の付け忘れを疑う

### Vite build

```bash
npm run build                  # 本番ビルド (dist/ 生成)
npm run preview                # ビルド成果物のローカル確認
```

- **build error** → import パスの typo / TS 移行前のため型エラーは出ない
- **dist サイズ警告 (500kB 超)** → 既知 (Recharts 同梱のため)、v17.0 の TS 移行時に code-splitting 検討

---

## 2. Actions ワークフローが失敗した時

### Daily update (`.github/workflows/daily-update.yml`)

毎日 JST 8:00 (UTC 23:00) に走る本番ワークフロー。失敗時は GitHub から通知メール。

```
1. Actions タブ → 失敗した run をクリック → 失敗ステップを展開してログを読む
2. [WARN] 行に注目 (fetch スクリプトはエラー時 WARN を吐いて継続する設計)
3. 手動再実行: Actions タブ → "Daily Market Update" → "Run workflow" → main → 実行
4. それでも直らない場合は Codespaces で直接実行して切り分け:
   FRED_API_KEY=$FRED_API_KEY ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
     PYTHONPATH=scripts \
     python scripts/fetch_news.py
```

実行順序:
1. **Python smoke test** (Ruff lint → mypy → pytest)
2. **データ取得** (market → macro → valuations → central_banks → listed_alts → news → featured → economic)
3. **archive スナップショット** (`data/archive/YYYY-MM-DD/`)
4. **Commit + push** (`chore: update market data ...`)
5. **Vite build → GitHub Pages デプロイ**

### CI (`.github/workflows/ci.yml`)

PR と non-main push 時に走る。並列 2 ジョブ (Python / Frontend)。

**Python ジョブ失敗時の見方**:
- Ruff lint → mypy → pytest の順で実行。最初に止まったステップが原因
- ローカル再現: `ruff check . && mypy && pytest tests/`

**Frontend ジョブ失敗時の見方**:
- ESLint → Vitest → Vite build の順で実行
- ローカル再現: `npm run lint && npm run test:ci && npm run build`

### Pages のビルドが失敗する

- **`Settings → Pages → Source` が「GitHub Actions」になっているか確認**
- 過去に GitHub 側の設定リセットで「Deploy from a branch」に戻ってしまったケースあり (2026-04 頃)
- Pages デプロイステップだけ失敗していたら最初にここを確認する

---

## 3. 外部 API のトラブル

### yfinance レートリミット (`market.json` が空または古い)

yfinance は Yahoo Finance のレートリミット (15 分内 X 回など) に掛かることがある。

- **数時間待って手動再実行**
- 単一銘柄が問題なら `scripts/fetch_market_data.py` の `INSTRUMENTS` から一時的に外す
- 慢性的なら **v14.x で Alpha Vantage への fallback 切替予定**

### Claude API が 429 (Rate limit exceeded)

Anthropic の tier 上限に当たっている。

- `scripts/fetch_news.py` の各 call の `max_tokens` を減らす
- `items[:150]` の引数を減らして送る記事数を絞る
- 数時間待って手動再実行
- v13.2 以降の 4 分割呼び出しで、特定の call (例: Deep Dive 用 Opus) だけ失敗することもある。その場合 `_FALLBACK_DEEP_DIVE` 等で他のセクションは生成される

### FRED API キー失効

`fetch_macro_indicators.py` などが `FRED_API_KEY is not set` を出して空 JSON を書く場合:

- GitHub Secrets で `FRED_API_KEY` が設定されているか確認
- FRED のアカウントページでキーが有効か確認 (https://fred.stlouisfed.org/docs/api/api_key.html)
- キーを再生成して Secrets を更新

### Bloomberg / WSJ / FT の Google News RSS が機能していない

公式 RSS 廃止のため Google News の `site:` 検索 RSS で代替している。Google News 側の仕様変更で取れなくなる可能性あり。

- `scripts/fetch_news.py` の各 RSS URL を curl で叩いて中身を確認
- 1 ソースが落ちても他 13 ソースで継続するため、致命的ではない

---

## 4. UI に問題が出ている時

### Stale Data 警告が出ている

`data/*.json` の `generatedAt` が 36 時間以上古い場合、UI 上部に赤いバーが表示される。

- Actions タブで最新 run の状況を確認
- 失敗していれば「手動再実行」
- 連続で失敗するなら Anthropic API キーや FRED API キーの失効を疑う

### CSS が剥がれる (v12 で経験済の minifier bug)

Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minified 変数名 `${D.x}` に置換する重大バグあり。

- **絶対にインライン CSS を使わない**
- CSS は `MarketMonitor.css` / `index.css` の外部ファイルで管理
- CSS 変数 (`var(--accent)` 等) を使う
- 詳細: DECISION (v11 以前のセクション)

### チャートが描画されない

- ブラウザコンソールで Recharts エラーを確認
- データ構造の変更が JSX 側の expect とズレている可能性
- v13.5 で導入予定の Sentry で自動検知できるようになる

---

## 5. zip 適用後の症状

### Listed Alts や archive の data が古い (rebase 後の症状)

zip 適用後 `git pull --rebase` を忘れると、ローカルが Actions 側の最新 chore commit より古いままになる。

```bash
git fetch
git log HEAD..origin/main      # 差分を見る
git pull --rebase              # 同期
```

### `git pull --rebase` でコンフリクト

GitHub Actions の自動コミットが data/ を更新した直後に zip を適用すると `data/` 配下でコンフリクトする。Actions 側 (新しい data) を優先で解決:

```bash
git checkout --theirs data/
git add data/
git rebase --continue
```

### npm ci で `package-lock.json` の差異エラー

v13.4.x 以降、zip には `package-lock.json` を含めない方針 (依存解決を環境ごとに任せる)。zip 適用後は:

```bash
npm install                    # package-lock.json を再生成
```

または既存 lock を保持したい場合は zip 内の `package.json` から手動で `devDependencies` を `package-lock.json` に反映する手間が必要。基本は `npm install` で問題ない。

### mypy / Vitest 関連の初回エラー

```bash
pip install -r requirements.txt   # mypy / pandas-stubs / types-requests を入れる
npm install                       # vitest / jsdom / @testing-library/* を入れる
```

を忘れていないか確認。

---

## 6. 過去のインシデント

### 2026-05 (v13.4.1) — pandas-stubs vs yfinance runtime のギャップ

- **症状**: `mypy --strict scripts/common.py` で `extract_close_series` 内の `isinstance(s, pd.DataFrame)` が「unreachable」と判定される
- **原因**: pandas-stubs は `df["Close"]` を `Series` と型推論するが、yfinance の MultiIndex ケースでは `DataFrame` が返る (runtime 実態)
- **対処**: `# type: ignore[unreachable]` を 2 行に付与 + コメントで理由を明記
- **教訓**: 型システムと runtime 実態がズレるケースは、`# type: ignore` よりも修正の判断は慎重に。runtime 側のテスト (`test_close_column_with_dataframe_value`) が cover していることを確認した上で抑制する

### 2026-05 (v13.4.1) — B023 が `fetch_market_data.py` にもあった

- **症状**: `fetch_listed_alts.py` の closure を default-arg pattern に直して B023 ignore を外したら、`fetch_market_data.py` でも同じ B023 が 2 箇所検出
- **原因**: initial migration で 1 ファイルのみ確認して別ファイルへの波及を見落とした
- **対処**: 同じ pattern を `fetch_market_data.py` の 2 closure にも適用
- **教訓**: ルール ignore を外すときは全ファイルで再検出をかける。`ruff check . --select B023` を必ず実行

### 2026-05 (v13.4.0) — Ruff formatter が新聞風タブラを破壊

- **症状**: `ruff format` を試行したら `chart_universe.py` / `fetch_market_data.py` 等のテーブル状リテラル (`CHART_UNIVERSE`, `INSTRUMENTS`) が多行展開されて整列が崩れた
- **原因**: Ruff formatter (Black 互換) は line-length=100 を超える整列リテラルを 1 要素 1 行に展開する。kk の「新聞風の格調」と相性が悪い
- **対処**: pyproject.toml から `[tool.ruff.format]` セクションを削除し、formatter は意図的に未導入。lint のみ使用
- **教訓**: チームコーディング規約より、個人プロジェクトでは「コードの読みやすさを保つ意図」の方が優先されることがある

### 2026-05 (v13.4.0) — Prettier も同様にタブラを破壊

- **症状**: Prettier dry-run で 24 ファイルが整形対象として検出。`MarketMonitor.jsx` の useState 宣言の整列が破壊される
- **対処**: `.prettierrc.json` は用意するが、CI では `--check` しない方針。`npm run format` は新規ファイル整形用の任意ツール
- **教訓**: Python と JS で同じ「整列されたコラム」の文化があるなら、両言語で formatter スタンスは揃える

### 2026-04 頃 — GitHub Pages の Source 設定がリセット

- **症状**: ある日突然 Pages ビルドが失敗
- **原因**: `Settings → Pages → Source` が「Deploy from a branch」に戻っていた
- **対処**: 「GitHub Actions」に再設定
- **教訓**: 月 1 回くらいは Settings → Pages を確認する習慣を

### 2026 早期 — `cd scripts` で `data/news.json` が `scripts/data/news.json` に書かれる

- **症状**: news.json が想定外のパスに書かれる
- **原因**: workflow で `cd scripts` してから python を実行すると CWD が scripts/ になり、`Path("data/news.json")` がそこからの相対になる
- **対処**: workflow は CWD をルートのまま、`PYTHONPATH=scripts` 環境変数で import を解決する
- **教訓**: パスは絶対に CWD 依存にしない。Path リテラルは常にプロジェクトルートからの相対と決めておく

### 2026 早期 — TOPIX (`^TOPX`) が delisted

- **症状**: yfinance で TOPIX のデータが取れなくなった
- **原因**: yfinance / Yahoo Finance 側で `^TOPX` シンボルが delisted
- **対処**: `1306.T` (NEXT FUNDS TOPIX ETF) に代替
- **教訓**: 主要指数でも yfinance のシンボル変更は突然起こる。代替候補を頭に入れておく

### 2026 早期 — 日銀政策金利が間違った系列

- **症状**: 日銀の政策金利が異常な値を示す
- **原因**: `IRSTCI01JPM156N` (マネーマーケット) を使っていた。正解は `IRSTCB01JPM156N` (Central Bank Rate)
- **対処**: 系列 ID を `IRSTCB01...` ファミリーに統一 (BOE/BOC/SNB/RBA/RBNZ も同様)
- **教訓**: FRED の中央銀行金利系列は `IRSTCB01...` 始まり。`IRSTCI01...` (マネーマーケット) ではない

---

## 関連ドキュメント

- [`PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) — プロジェクト全体方針
- [`ROADMAP.md`](../ROADMAP.md) — 今後の開発計画 (Phase 1-5)
- [`DECISIONS.md`](../DECISIONS.md) — 意思決定の経緯
- [`README.md`](../README.md) — 構成・使い方
