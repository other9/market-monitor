# Market Monitor

毎朝 **8:00 (JST)** に自動更新される個人用マーケット日報ダッシュボード。
東京の機関投資家向け、PE/PD/不動産/インフラ等のオルタナティブ資産にフォーカス。

GitHub Actions + GitHub Pages + Anthropic Claude API + FRED API + yfinance で構成。

- **公開URL**: https://other9.github.io/market-monitor/
- **リポジトリ**: https://github.com/other9/market-monitor (Public)
- **開発**: GitHub Codespaces (`/workspaces/market-monitor`)
- **現行バージョン**: v12.2

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

---

## ページ構成 (v12)

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

---

## 開発フロー (zip 受け取り時)

```bash
cd /workspaces/market-monitor
git pull --rebase origin main
unzip -o market-monitor-vN.zip && cp -r market-monitor/. . && rm -rf market-monitor market-monitor-vN.zip
git add . && git commit -m "feat: ..." && git push
```

GitHub Actions の自動コミット (`chore: update market data ...`) との競合は通常 `git pull --rebase` で吸収できる。
コンフリクトしたら `git checkout --theirs data/ && git add data/ && git rebase --continue` で data/ を Actions 側優先で解決。

### 改修動作確認 — snapshot を取って Claude に渡す

zip 適用 & push → Actions 完走を確認したあと、以下のコマンドで作業領域全体の zip を作る:

```bash
bash scripts/take_snapshot.sh
```

リポジトリ直下に `mm-snapshot-YYYYMMDD-HHMM.zip` が作られる。VS Code エクスプローラーで右クリック → **Download** → Claude チャットに添付 → 私が想定どおりに反映されているか実機照合する。

`.gitignore` の `*.zip` で git tracked にはならないので、不要になったら `rm mm-snapshot-*.zip` で削除すれば良い。

---

## ローカル開発

```bash
# Python 側
pip install -r requirements.txt
FRED_API_KEY=xxx python scripts/fetch_market_data.py

# テスト
pytest tests/ -v

# フロントエンド側
npm install
npm run dev
```

`http://localhost:5173/` で確認できる。

---

## 重要な技術的決定 (絶対に忘れない)

1. **TOPIX**: `^TOPX` は yfinance で delisted。代替に `1306.T` (NEXT FUNDS TOPIX ETF) を使用
2. **日銀政策金利**: `IRSTCB01JPM156N` (Central Bank Rate) を使用。`IRSTCI01JPM156N` (マネーマーケット) は誤り
3. **他中銀**: BOE/BOC/SNB/RBA/RBNZ もすべて `IRSTCB01...` ファミリーに統一
4. **CSS は外部ファイル必須**: Vite minifier が `<style>{STYLES}</style>` 内の template literal `${PALETTE.x}` を minify 変数名 `${D.x}` に置換するバグあり。インライン CSS は禁止、CSS 変数 (`var(--accent)` 等) で管理
5. **cron は UTC 23:00 (JST 8:00)**: 7 時だと yfinance の日経データ更新が間に合わず、誤って前々日データになる事例あり
6. **GitHub Actions cron は数〜十数分遅延**する。バッファ込みの設計
7. **Claude API モデル**: `claude-opus-4-7` (Deep Dive・解説の品質を重視)
8. **Public リポジトリの Secrets 安全性**: Fork では Secrets が読めない仕様
9. **モニタリング不要**: Actions 失敗の即時検知は GitHub の通知メール + UI 側の Stale Data 警告で代替
10. **プレースホルダ JSON**: コミット済みの `data/*.json` 自体が本番データ兼初期表示の二重役割。スキーマ変更時は最新の JSON も合わせて更新
11. **PYTHONPATH=scripts**: `fetch_news.py` などが内部で `from chart_universe import ...` のような相対 import を使っているため、Actions では PYTHONPATH 環境変数経由で解決している。CWD はリポジトリ root のまま

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
`scripts/fetch_macro_indicators.py` の `INDICATORS` リストを編集。FRED の系列 ID を Yahoo Finance 互換ティッカーで指定。

### Listed Alts プロキシを変える
`scripts/fetch_listed_alts.py` の `LISTED_ALTS` リストを編集。

### 実行時刻を変える
`.github/workflows/daily-update.yml` の cron を編集。
注意: GitHub Actions の cron は数分〜十数分遅延することがある。

### 色・タイポグラフィ
`src/index.css` の CSS 変数 (`--accent`, `--accent2`, `--bg`, `--fg` 等) と
`src/MarketMonitor.jsx` の `PALETTE` オブジェクト (Recharts 用) を同期して編集。

---

## 想定コスト

- GitHub Actions: 無料枠で十分 (1 回 3 分強 × 30 日 = 月 100 分弱)
- GitHub Pages: 無料
- Anthropic API (claude-opus-4-7): 月 **約 1,600 円** (入力 ~10k / 出力 ~3k トークン × 30 日)
- FRED API: 無料

コストを抑えるなら、`fetch_news.py` のモデルを `claude-haiku-4-5-20251001` に切り替えると 1/10 程度になるが、Deep Dive の品質は落ちる。**v13.2 で予定されている API multi-call 化により、Muse など軽い創作タスクのみを Haiku に切り替えてコスト削減する見込み**。

---

## トラブルシューティング

### Actions の特定ステップが失敗する場合 (一般)

1. Actions タブ → 失敗した run をクリック → 失敗ステップを展開してログを読む
2. `[WARN]` 行に注目 (各 fetch スクリプトはエラーがあっても WARN を吐いて継続する設計)
3. **手動再実行**: Actions タブ → ワークフロー名 (Daily Market Update) → "Run workflow" ボタン → main ブランチを選択 → 実行
4. それでも直らない場合は **Codespaces で直接実行**して切り分け:
   ```bash
   FRED_API_KEY=$FRED_API_KEY ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
     PYTHONPATH=scripts \
     python scripts/fetch_news.py
   ```

### `market.json` が空または古い (yfinance レート制限)

yfinance は Yahoo Finance のレートリミット (15 分内 X 回など) に掛かることがある。
- 数時間待って手動再実行 (上記)
- 単一銘柄が問題なら `scripts/fetch_market_data.py` の `INSTRUMENTS` から一時的に外す
- 慢性的なら Alpha Vantage 等への切替を v14 で検討予定

### Claude API が 429 (Rate limit exceeded)

Anthropic の tier 上限に当たっている。
- `scripts/fetch_news.py` の `max_tokens` を減らす (現在 4096 程度)
- `items[:150]` の引数を減らして送る記事数を絞る
- 数時間待って手動再実行

### Pages のビルドが失敗する

`Settings → Pages → Source` が **GitHub Actions** になっているか確認。「Deploy from a branch」ではこのワークフローは動かない。

過去に **GitHub 側の設定リセット**で「Deploy from a branch」に戻ってしまったケースあり。Pages デプロイステップだけ失敗していたら最初に確認する。

### Stale Data 警告が出ている

`data/*.json` の `generatedAt` が 36 時間以上古い場合、UI 上部に赤いバーが表示される。
- Actions タブで最新 run の状況を確認
- 失敗していれば上記の「手動再実行」
- 連続で失敗するなら Anthropic API キーや FRED API キーの失効を疑う

### Listed Alts や archive の data が古い (rebase 後の症状)

zip 適用後 `git pull --rebase` を忘れると、ローカルが Actions 側の最新 chore commit より古いままになる。
- `git fetch && git log HEAD..origin/main` で差分を見る
- `git pull --rebase` で同期

### Smoke test (pytest) が失敗する

v13.0 で導入された Actions の `Python smoke test` ステップが失敗した場合、コードのリグレッション可能性が高い。
- `pytest tests/ -v` をローカルで実行して詳細を見る
- 失敗テストが指す関数 (例: `extract_close_series`) を確認
- 共通モジュール `scripts/common.py` への変更がテスト前提を壊していないか

---

## v13.0 で導入された土台

### 共通モジュール `scripts/common.py`

FRED API 呼び出し、yfinance MultiIndex 吸収、ログ書式、日付処理を集約。
v13.1 以降で各 `fetch_*.py` を順次これを使う形にリファクタする予定。

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
- `tests/test_common.py` — 共通モジュールの基本動作 + `determine_cadence()` の型チェック
- `tests/conftest.py` — `scripts/` を sys.path に追加するための設定

---

## バージョン履歴 (主要)

- **v13.0** (2026-05): 土台拡充フェーズ初期 — `scripts/common.py` 新設、`scripts/take_snapshot.sh` 追加、pytest 導入と Actions smoke test、トラブルシュート章拡充
- **v12.2** (2026-05): GitHub Actions を Node 24 対応に更新 (checkout@v5 等)、色調をブルー×グリーン基調に変更、`.mm-alt-impact-label` 補修、ルート残骸ファイル削除
- **v12.1** (2026-05): Listed Alts チャートに X/Y 軸・グリッド・Tooltip を追加
- **v12** (2026-05): セクション番号アラビア化、Funding/Vol パネル、Listed Alts プロキシ、Deep Dive アーカイブ、週末/月初の長尺総括モード、Claude モデル `claude-opus-4-7` に更新、Stale Data 警告
- **v11** 以前: 多数の段階的機能追加 (履歴は `DECISIONS.md` 参照)

詳細な決定の経緯は [`DECISIONS.md`](DECISIONS.md) を参照。
今後の開発計画は [`ROADMAP.md`](ROADMAP.md) を参照。
