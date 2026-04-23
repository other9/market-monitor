# Market Monitor

毎朝7時(JST)に自動更新されるマーケットダッシュボード。
GitHub Actions で前日のマーケットデータを yfinance から取得し、
Claude API で主要ニュースを要約、GitHub Pages に公開します。

---

## 構成

```
 ┌──────────────────────────────────────────────────────┐
 │ GitHub Actions  (cron: 22:00 UTC = JST 07:00)       │
 │  ├─ fetch_market_data.py → data/market.json         │
 │  ├─ fetch_news.py        → data/news.json           │
 │  ├─ vite build           → dist/                    │
 │  └─ deploy-pages         → GitHub Pages             │
 └──────────────────────────────────────────────────────┘
```

---

## セットアップ手順

### 1. リポジトリを作成して push

```bash
# 新規リポジトリを GitHub 上で作成 (例: market-monitor)
# ※ このプロジェクトのファイル一式をそのリポジトリに push
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/market-monitor.git
git push -u origin main
```

### 2. Anthropic API キーを Secrets に登録

1. [Anthropic Console](https://console.anthropic.com/) で API キーを発行
2. リポジトリの **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `ANTHROPIC_API_KEY`、Value: 発行した API キー

### 3. GitHub Pages を有効化

**Settings → Pages** で以下を設定：

- **Source**: `GitHub Actions`

※「Deploy from a branch」ではなく **GitHub Actions** を選択してください。

### 4. Actions の初回実行

以下のいずれかで初回実行します：

- `main` ブランチに push する（push トリガーで自動起動）
- または **Actions タブ → Daily Market Update → Run workflow** で手動実行

初回実行後、`https://<YOUR_USER>.github.io/market-monitor/` で公開されます。

### 5. サブパス設定の確認

`.github/workflows/daily-update.yml` の `BASE_URL` がリポジトリ名と一致しているか確認：

```yaml
- name: Build
  run: npm run build
  env:
    BASE_URL: "/market-monitor/"   # ← リポジトリ名に合わせる
```

リポジトリ名を変えた場合や、ユーザーページ（`<user>.github.io`）として公開する場合は `BASE_URL: "/"` にしてください。

---

## ローカル開発

```bash
# Python 側
pip install -r requirements.txt

# サンプルデータを生成
python scripts/fetch_market_data.py
ANTHROPIC_API_KEY=sk-ant-xxx python scripts/fetch_news.py

# フロントエンド側
npm install
npm run dev
```

`http://localhost:5173/` で確認できます。

---

## ファイル構成

```
market-monitor/
├── .github/workflows/
│   └── daily-update.yml          # 毎朝7時のcron + ビルド + デプロイ
├── scripts/
│   ├── fetch_market_data.py      # yfinance で16指標を取得
│   └── fetch_news.py             # RSS取得 + Claude API要約
├── data/
│   ├── market.json               # 自動生成（価格・履歴）
│   └── news.json                 # 自動生成（要約7本）
├── src/
│   ├── MarketMonitor.jsx         # メインコンポーネント（JSONを読み込む）
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
├── requirements.txt
└── README.md
```

---

## カスタマイズ

### 対象銘柄を変える

`scripts/fetch_market_data.py` の `INSTRUMENTS` リストを編集。
ティッカーは Yahoo Finance の表記に合わせてください（例: `^N225`, `JPY=X`, `CL=F`）。

### ニュースソースを変える

`scripts/fetch_news.py` の `RSS_FEEDS` を編集。
Claude に渡すプロンプト（`SYSTEM_PROMPT`）で選定基準をカスタマイズ可能。

### 実行時刻を変える

`.github/workflows/daily-update.yml` の cron を編集：

```yaml
schedule:
  - cron: "0 22 * * *"   # UTC 22:00 = JST 07:00
  # 例: JST 06:30 にするなら "30 21 * * *"
  # 例: 平日のみ          "0 22 * * 1-5"
```

注意: GitHub Actions の cron は数分〜十数分遅延することがあります。
厳密に7時ちょうどに更新する保証はありません（公式ドキュメント記載の既知の仕様）。

### 色・タイポグラフィ

`src/MarketMonitor.jsx` 冒頭の `PALETTE` / `FONT_*` 定数を編集。

---

## 想定コスト

- GitHub Actions: 無料枠で十分（1回の実行は約2-3分 × 30日 = 月 90分程度）
- GitHub Pages: 無料
- Claude API: 1回あたり入力 ~10k トークン / 出力 ~2k トークン程度。
  claude-opus-4-7 で月 **数百円〜千数百円** 程度。

コストを抑えるなら、`fetch_news.py` のモデルを `claude-haiku-4-5-20251001`
などに切り替えると 1/10 程度になります。

---

## トラブルシューティング

### `market.json` が空で返ってくる

yfinance は Yahoo Finance のレートリミットに引っかかることがあります。
Actions のログを見て、`[WARN] ... fetch failed` が出ていたらリトライを追加するか、
別データソース（Alpha Vantage, Polygon.io）に切り替えてください。

### Claude API が 429 を返す

tier によって rate limit が異なります。`fetch_news.py` で `max_tokens` を減らすか、
入力する記事数（`items[:150]`）を減らしてください。

### Pages のビルドが失敗する

`Settings → Pages → Source` が **GitHub Actions** になっているか確認してください。
「Deploy from a branch」だとこのワークフローは動きません。
