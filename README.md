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

---

## ローカル開発

```bash
# Python 側
pip install -r requirements.txt
FRED_API_KEY=xxx python scripts/fetch_market_data.py

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

コストを抑えるなら、`fetch_news.py` のモデルを `claude-haiku-4-5-20251001` に切り替えると 1/10 程度になるが、Deep Dive の品質は落ちる。

---

## トラブルシューティング

### `market.json` が空または古い
yfinance が Yahoo のレートリミットに掛かることがある。Actions のログで `[WARN] ... fetch failed` が出ていたら時間を置いて手動再実行。

### Claude API が 429
tier 上限に当たっている。`fetch_news.py` の `max_tokens` を減らすか、`items[:150]` を減らす。

### Pages のビルドが失敗する
**Settings → Pages → Source** が `GitHub Actions` になっているか確認。「Deploy from a branch」ではこのワークフローは動かない。

### Stale Data 警告が出ている
`data/*.json` の `generatedAt` が 36 時間以上古い。Actions タブで最新 run の状況を確認、必要なら手動再実行。

---

## バージョン履歴 (主要)

- **v12.2** (2026-05): GitHub Actions を Node 24 対応に更新 (checkout@v5 等)、色調をブルー×グリーン基調に変更、`.mm-alt-impact-label` 補修、ルート残骸ファイル削除
- **v12.1** (2026-05): Listed Alts チャートに X/Y 軸・グリッド・Tooltip を追加
- **v12** (2026-05): セクション番号アラビア化、Funding/Vol パネル、Listed Alts プロキシ、Deep Dive アーカイブ、週末/月初の長尺総括モード、Claude モデル `claude-opus-4-7` に更新、Stale Data 警告
- **v11** 以前: 多数の段階的機能追加 (履歴は `DECISIONS.md` 参照)

詳細な決定の経緯は [`DECISIONS.md`](DECISIONS.md) を参照。
