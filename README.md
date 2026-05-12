# Market Monitor

毎朝 **8:00 (JST)** に自動更新される個人用マーケット日報ダッシュボード。
東京の機関投資家向け、PE/PD/不動産/インフラ等のオルタナティブ資産にフォーカス。

GitHub Actions + GitHub Pages + Anthropic Claude API + FRED API + yfinance で構成。

- **公開URL**: https://other9.github.io/market-monitor/
- **リポジトリ**: https://github.com/other9/market-monitor (Public)
- **開発**: GitHub Codespaces (`/workspaces/market-monitor`)
- **現行バージョン**: v13.5.1 (**Phase 1 全完了**、Sentry のみ取り下げ、Phase 2 = v16.0 着手予定)

---

## 構成

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions  (cron: UTC 23:00 = JST 08:00)          │
│  ├─ fetch_market_data.py        → data/market.json     │
│  ├─ fetch_macro_indicators.py   → data/macro.json      │
│  ├─ fetch_valuations.py         → data/valuations.json │
│  ├─ fetch_central_banks.py      → data/central_banks.json │
│  ├─ fetch_listed_alts.py        → data/listed_alts.json   │
│  ├─ fetch_news.py (Claude API)  → data/news.json       │
│  ├─ fetch_featured_charts.py    → data/featured.json   │
│  ├─ fetch_economic_chart.py     → data/economic.json   │
│  ├─ archive_data.py             → data/archive/YYYY-MM-DD/ │
│  ├─ vite build                  → dist/                │
│  └─ deploy-pages                → GitHub Pages         │
└─────────────────────────────────────────────────────────┘
```

共通レイヤ: `scripts/common.py` が FRED API client / yfinance MultiIndex 吸収 / 共通ロガー / 日付ヘルパーを集約。
フロント: `src/MarketMonitor.jsx` (134 行のオーケストレータ) + `src/components/sections/` (16 セクション) + `src/components/common/`。

---

## ページ構成 (v13.3)

1. **本日の注目チャート** — Claude が選定する 3 本 (1Y daily)
2. **昨日の主要市場** — 日米欧の指数・先物・為替・コモディティ + セクター・ヒートマップ
3. **マクロ・バロメーター** — FRED 18 指標 (金利・期待 / 信用 / 金融環境 / 為替・実物)
4. **ボラティリティ・流動性** — VIX 期間構造 / MOVE / SOFR-IORB
5. **バリュエーション・ゲージ** — Shiller CAPE / Buffett / Fed Model / VVIX/VIX
6. **中央銀行ウォッチ** — Fed/ECB/BOJ + 日替わり 1 中銀
7. **重要指標・5年チャート** — 日替わり FRED 指標
8. **市場を動かしたニュース** — 7 本 (Claude 要約)
9. **Listed Alternatives Proxies** — PSP / BIZD / IFRA / NFRA / VNQ / 1343.T
+ Deep Dive 解説 (土曜 = 週次総括 / 月初 = 前月総括 / 平日 = 当日深掘り)
+ Economic Indicator (日替わり)
+ Alternatives Spotlight (PE/PD と 不動産・インフラ)
+ Market Muse (3 片の小話)
+ Stale Data 警告バー (`generatedAt` が 36 時間以上古い場合に表示)

v16.0 で **10. 日本株ウォッチ** (EDINET 大量保有 + TDnet 適時開示) を追加予定。

---

## 開発フロー (ハイブリッド運用)

変更規模に応じて 3 段使い分ける (DECISION v13.4-plan-02 参照)。

### 小修正 (1-2 ファイル)
```bash
cd /workspaces/market-monitor
git pull --rebase origin main
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push
```

### 中規模変更 (1 セクション追加など)
```bash
git pull --rebase origin main
git checkout -b feat/v16.0-edinet
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push -u origin feat/v16.0-edinet
gh pr create --fill
```

### 大型変更 (TS 移行など)
複数 PR (1 PR で 1-2 セクション) に分割し段階的に merge。

GitHub Actions の自動コミットとの競合は通常 `git pull --rebase` で吸収できる。
コンフリクトしたら `git checkout --theirs data/ && git add data/ && git rebase --continue` で data/ を Actions 側優先で解決。

### 改修動作確認 — snapshot を取って Claude に渡す

zip 適用 & push → Actions 完走を確認したあと、以下のコマンドで作業領域全体の zip を作る:

```bash
bash scripts/take_snapshot.sh
```

リポジトリ直下に `mm-snapshot-YYYYMMDD-HHMM.zip` が作られる。VS Code エクスプローラーで右クリック → **Download** → Claude チャットに添付 → 実機照合する。

`.gitignore` の `*.zip` で git tracked にはならないので、不要になったら `rm mm-snapshot-*.zip` で削除すれば良い。

---

## ローカル開発

```bash
# Python 側
pip install -r requirements.txt                 # ruff / mypy / pytest-cov / stubs 含む
FRED_API_KEY=xxx python scripts/fetch_market_data.py

# Python lint + 型チェック + テスト + カバレッジ
ruff check .                                    # lint
ruff check . --fix                              # 自動修正
mypy                                            # 型チェック (scripts/common.py、v13.4.1)
pytest tests/ -v                                # 35 件
pytest tests/ --cov=scripts --cov-report=term   # カバレッジ計測 (v13.5)

# フロントエンド側
npm install
npm run dev                                     # localhost:5173

# JS lint + テスト + 整形
npm run lint                                    # ESLint
npm run lint:fix                                # ESLint 自動修正
npm run test                                    # Vitest watch
npm run test:ci                                 # Vitest 1 回実行
npm run test:ui                                 # Vitest ブラウザ UI
npm run format                                  # Prettier (任意、CI では check しない)
```

`http://localhost:5173/` で確認できる。

PR を作ると `.github/workflows/ci.yml` で **Ruff + mypy + pytest + Codecov + ESLint + Vitest + Vite build + Lighthouse CI** が自動実行される。
main 直 push 時は `daily-update.yml` で Ruff + mypy + pytest が走り、Sentry DSN が build に注入される。

### 監視サービスのセットアップ (v13.5、任意)

[`docs/MONITORING.md`](docs/MONITORING.md) に Sentry / Codecov / Lighthouse CI / Cloudflare Pages の登録手順を集約。全て free tier 内で完結。

---

## 重要な技術的決定 (絶対に忘れない)

1. **TOPIX**: `^TOPX` は yfinance で delisted。代替に `1306.T` (NEXT FUNDS TOPIX ETF) を使用
2. **日銀政策金利**: `IRSTCB01JPM156N` (Central Bank Rate) を使用。`IRSTCI01JPM156N` (マネーマーケット) は誤り
3. **他中銀**: BOE/BOC/SNB/RBA/RBNZ もすべて `IRSTCB01...` ファミリーに統一
4. **CSS は外部ファイル必須**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minify 変数名 `${D.x}` に置換するバグあり。インライン CSS は禁止、CSS 変数 (`var(--accent)` 等) で管理
5. **cron は UTC 23:00 (JST 8:00)**: 7 時だと yfinance の日経データ更新が間に合わず、誤って前々日データになる事例あり
6. **GitHub Actions cron は数〜十数分遅延**する。バッファ込みの設計
7. **Claude API モデル**: 役割別に `claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5` を使い分け (v13.2 以降)
8. **Public リポジトリの Secrets 安全性**: Fork では Secrets が読めない仕様
9. **モニタリング不要**: Actions 失敗の即時検知は GitHub の通知メール + UI 側の Stale Data 警告で代替 (v13.5 で Sentry を追加予定)
10. **プレースホルダ JSON**: コミット済みの `data/*.json` 自体が本番データ兼初期表示の二重役割。スキーマ変更時は最新の JSON も合わせて更新
11. **PYTHONPATH=scripts**: `fetch_news.py` などが内部で `from chart_universe import ...` のような相対 import を使っているため、Actions では PYTHONPATH 環境変数経由で解決している
12. **scripts/__init__.py は作らない**: PEP 420 namespace package で動作 (DECISION v13.3-05)
13. **依存方向ルール**: `theme.js → utils.js → components/common → components/sections → MarketMonitor.jsx` の単方向 (DECISION v13.1-03)

---

## ニュースソース (現行 14 本)

**一般金融・マーケット (7)**: Yahoo!ファイナンス / Reuters Japan / マネクリ / Reuters Business / MarketWatch / CNBC / Yahoo Finance US

**オルタナティブ専門 (4)**: Pensions & Investments / DailyAlts / PE Hub / AltAssets PE

**Bloomberg / WSJ / FT (Google News RSS 経由)**: 公式 RSS 廃止のため `site:` 検索 RSS で代替

---

## カスタマイズ

### 対象銘柄を変える
`scripts/fetch_market_data.py` の `INSTRUMENTS` リストを編集。

### マクロ指標を変える
`scripts/fetch_macro_indicators.py` の `INDICATORS` リストを編集。FRED の系列 ID を指定。

### Listed Alts プロキシを変える
`scripts/fetch_listed_alts.py` の `LISTED_ALTS` リストを編集。

### 実行時刻を変える
`.github/workflows/daily-update.yml` の cron を編集。
注意: GitHub Actions の cron は数分〜十数分遅延することがある。

### 色・タイポグラフィ
`src/index.css` の CSS 変数 (`--accent`, `--accent2`, `--bg`, `--fg` 等) と
`src/theme.js` の `PALETTE` オブジェクト (Recharts 用) を同期して編集。

---

## 想定コスト

- GitHub Actions: 無料枠で十分 (1 回 3 分強 × 30 日 = 月 100 分弱)
- GitHub Pages: 無料
- Anthropic API (4 分割、Opus + Sonnet + Haiku 併用): 月 **約 1,000-1,200 円**
- FRED API / EDINET / TDnet: 全て無料
- Sentry / Codecov / Cloudflare Pages (v13.5 以降): 全て free tier

**月コスト 0 円維持を方針** とする (DECISION v13.4-plan-06)。

---

## 今後の開発計画

v13 系 (土台拡充) 完了後、Phase 1-5 を順次進行する:

| Phase | 主眼 | バージョン |
|---|---|---|
| Phase 1: 業界標準の足場固め | 保守性・観測性の底上げ | v13.4, v13.5 |
| Phase 2: Japan Equities Layer 第一段 | 個人投資ニーズへの即応 | v16.0 |
| Phase 3: archive UI + Japan 拡張 | 蓄積資産活用 + TOB 機能 | v14.0, v16.1 |
| Phase 4: 大型構造改革 | AI 補助精度の本格向上 | v17.0 (TS 移行) |
| Phase 5: 残務処理 | データ冗長化と運用課題 | v14.x, v16.2, v15 |

詳細は [`ROADMAP.md`](ROADMAP.md) を参照。

---

## トラブルシューティング

詳細は [`docs/RUNBOOK.md`](docs/RUNBOOK.md) を参照。よくある問題の入り口だけ:

### Actions の特定ステップが失敗する場合

1. Actions タブ → 失敗した run をクリック → ログを読む
2. **手動再実行**: Actions タブ → "Daily Market Update" → "Run workflow" → main → 実行
3. それでも直らない場合は Codespaces で `python scripts/fetch_XXX.py` を直接実行して切り分け

### CI (PR) が失敗した時

`docs/RUNBOOK.md` の「Quality gates が失敗した時」を参照。よく出るパターン:

- Ruff lint: `ruff check . --fix` で自動修正
- mypy: `pandas-stubs` / `types-requests` の追加忘れ、または unreachable 判定の type ignore コメント検討
- Vitest snapshot diff: 意図的な UI 変更なら `npm run test:ci -- -u` で更新

### Stale Data 警告が出ている

`data/*.json` の `generatedAt` が 36 時間以上古い時に表示される。Actions の最新 run を確認 → 手動再実行。連続で失敗するなら API キーの失効を疑う。

### Pages のビルドが失敗する

`Settings → Pages → Source` が **GitHub Actions** になっているか最初に確認 (過去にリセットされた事例あり)。

> その他の症状、過去のインシデント、再発防止メモは [`docs/RUNBOOK.md`](docs/RUNBOOK.md) に詳しく。

---

## v13.0 で導入された土台 (現役)

### 共通モジュール `scripts/common.py`

FRED API 呼び出し、yfinance MultiIndex 吸収、ログ書式、日付処理を集約。
v13.3 で全 fetch スクリプトがこれを利用するようになった。

利用例:
```python
from scripts.common import fred_observations, extract_close_series, log_ok, utc_now_iso

obs = fred_observations("DGS10", observation_start="2024-01-01")
log_ok(f"DGS10: {len(obs)} points")
```

### 自動化スクリプト `scripts/take_snapshot.sh`

改修確認用の snapshot zip を 1 コマンドで作成。詳細は **「改修動作確認 — snapshot を取って Claude に渡す」** 章を参照。

### 単体テスト `tests/`

`pytest tests/` で実行。Actions ワークフローの最初に smoke test として走る。
- `tests/test_common.py` — 共通モジュールの基本動作 + `determine_cadence()` の型チェック (18 ケース)
- `tests/conftest.py` — `scripts/` を sys.path に追加するための設定

v13.4 で Python 統合テスト (mock yfinance + mock FRED) と Vitest スナップショットが追加される予定。

---

## バージョン履歴 (主要)

- **v13.5.1** (2026-05): Sentry を取り下げ → `src/ErrorBoundary.jsx` (vanilla React) に置き換え。Sentry の signup フローが 14 日 Business trial 強制 enroll で月コスト 0 円方針と相性が悪かったため (DECISION v13.5.1-01)。`docs/MONITORING.md` は 4 → 3 サービスに縮小
- **v13.5** (2026-05): 監視・観測レイヤ — Sentry (`@sentry/react` v8、DSN-gated) + React ErrorBoundary、Codecov 連携 (`pytest --cov`、可視化のみ)、Lighthouse CI (`.lighthouserc.cjs`、warn 閾値)、Cloudflare Pages PR preview セットアップ手順 (`docs/MONITORING.md`)。**Phase 1 全完了**
- **v13.4.2** (2026-05): Python 統合テスト 17 件 (yfinance / FRED mock、計 35 件構成) + `docs/RUNBOOK.md` 新設 + `.github/CODEOWNERS` + `docs/BRANCH_PROTECTION.md` (UI 設定手順)。v13.4 (Phase 1 前半) 完了
- **v13.4.1** (2026-05): 共通 component 抽出 (`SectionHeader` / `GroupHeader` / `ExternalLink`、19 箇所置換) + Vitest スナップショット 16 件 + `scripts/common.py` の mypy strict 化 (`pandas-stubs` + `types-requests`) + B023 default-arg pattern 修正
- **v13.4.0** (2026-05): Linter/Formatter 導入 — Ruff (Python) + ESLint v9 flat config (JS) + Prettier (config のみ)、Dependabot 設定、CI ワークフロー新設 (`ci.yml`)、`daily-update.yml` に Ruff lint 追加、`ruff check --fix` で 45 件自動修正
- **v13.3** (2026-05): `scripts/common.py` の全面活用 — 9 ファイルが共通モジュールに乗り換え、ログ書式統一、JST/UTC ヘルパ集約
- **v13.2** (2026-05): Claude API 4 分割 — Opus×2 + Sonnet + Haiku、失敗の独立性とコスト効率改善
- **v13.1** (2026-05): フロント分割 — MarketMonitor.jsx 1513 行 → 134 行、16 セクションを独立コンポーネント化
- **v13.0** (2026-05): 土台拡充フェーズ初期 — `scripts/common.py` 新設、pytest 導入、ROADMAP/DECISIONS 文書化
- **v12.2** (2026-05): GitHub Actions を Node 24 対応に更新、色調をブルー×グリーン基調に変更
- **v12.1** (2026-05): Listed Alts チャートに X/Y 軸・グリッド・Tooltip を追加
- **v12** (2026-05): セクション番号アラビア化、Funding/Vol パネル、Listed Alts プロキシ、Deep Dive アーカイブ、Claude モデル `claude-opus-4-7` に更新、Stale Data 警告
- **v11** 以前: 多数の段階的機能追加 (履歴は `DECISIONS.md` 参照)

詳細な決定の経緯は [`DECISIONS.md`](DECISIONS.md) を参照。
今後の開発計画は [`ROADMAP.md`](ROADMAP.md) を参照。
