# Monitoring Setup — Market Monitor

v13.5 で導入された監視・観測レイヤの設定手順。
コードや CI workflow は zip で適用されるが、外部サービスの登録・連携は kk が GitHub UI / 各 SaaS の Web UI で行う必要がある。

最終更新: 2026-05-12 (v13.5.1 で Sentry を取り下げ、項目数を 4→3 に縮小)

---

## 目次

1. [エラー監視 — 採用見送り (v13.5.1)](#1-エラー監視--採用見送り-v1351) — Sentry を取り下げて ErrorBoundary のみで運用
2. [Codecov セットアップ](#2-codecov-セットアップ) — Python テストカバレッジ可視化
3. [Lighthouse CI](#3-lighthouse-ci) — パフォーマンス・アクセシビリティ計測
4. [Cloudflare Pages PR preview](#4-cloudflare-pages-pr-preview) — PR ごとの実機確認環境

すべて **free tier 内 / 月コスト 0 円** で完結する設計 (DECISION v13.4-plan-06)。

---

## 1. エラー監視 — 採用見送り (v13.5.1)

### 経緯

v13.5 で Sentry を導入したが、v13.5.1 で取り下げた。理由は DECISION v13.5.1-01 を参照。要点:

- Sentry 公式ドキュメント上は **Developer plan が無料** (5K events/月、1 user、30 日 retention)
- 実際の signup フローは **14 日 Business trial に強制 enroll** され、その間「trial 終了まで残り X 日」のリマインダーが続く
- trial 終了後に Developer plan に自動降格するが、UX 上の friction が個人プロジェクト向きでない
- DECISION v13.4-plan-06 の月コスト 0 円維持と、心理的負担ゼロ運用を優先

### 現在の代替手段 (v13.5.1 以降)

| 機能 | 現在の手段 |
|---|---|
| React render エラー検知 | `src/ErrorBoundary.jsx` (vanilla React) で fallback UI を表示 |
| 未捕捉例外のローカル確認 | ブラウザ DevTools の `console.error` |
| データ取得失敗 | UI 上部の **Stale Data 警告** (`generatedAt` が 36 時間以上古い時) |
| Actions ワークフロー失敗 | GitHub の **自動通知メール** |
| 動作確認 | kk の **朝の目視確認** (毎日 8 時更新) |

→ 9 割の障害ケースはカバーできる前提。残りの「UI は表示されているが内部状態が壊れている」ケースは見逃すが、毎日 1 回 kk が見るので発見遅延は 24 時間以内。

### 将来再検討する場合の候補

`@sentry/react` の取り下げと vanilla `ErrorBoundary` の導入は意図的に「再導入しやすい構造」にしている (DSN-gated 設計の名残)。将来エラー監視が欲しくなったら以下を順に検討:

| 候補 | 月額 | 評価 |
|---|---|---|
| **GlitchTip (hosted)** | 0 円 | Sentry 互換 SDK、1K events/月の hosted free tier。Sentry より UX のしがらみが少ない |
| **Rollbar** | 0 円 | 5K events/月、トラフィック想定にちょうど合う |
| **Highlight.io** | 0 円 | 500 sessions + 1K errors。session replay 付き |
| **GlitchTip (self-host)** | サーバー代 | Fly.io / Railway の free tier に乗せられるが運用負荷あり |
| Sentry に課金 | $26/月 ≒ 約 4,000 円 | API コスト (約 1,200 円) の 3 倍、見合わない |

再導入する場合は:
1. `@sentry/react` (または GlitchTip SDK) を `package.json` に追加
2. `src/sentry.js` 相当を新設 (DSN-gated init)
3. `src/main.jsx` の `import { ErrorBoundary } from "./ErrorBoundary"` を Sentry 系の ErrorBoundary に差し替え
4. `daily-update.yml` の build に DSN env を追加
5. このドキュメントを書き換え + DECISIONS に新エントリ

---

## 2. Codecov セットアップ

### Codecov 側で行うこと

1. https://codecov.io にアクセス → "Sign up with GitHub"
2. リポジトリ一覧から `other9/market-monitor` を選んで Activate
3. **public repo なので token は不要** (Codecov Token を使わない方針)

Codecov Action は public repo であれば tokenless で動作する。

### GitHub 側で行うこと

特になし。`.github/workflows/ci.yml` に既に `codecov/codecov-action@v4` ステップが入っている。

### 動作確認

1. 適当な PR を作って CI を回す
2. Codecov の Dashboard → market-monitor で coverage 推移が見える
3. PR には Codecov のコメントが自動的に付く (もし付かなければ Codecov 側で repo の "PR Comment" を有効化)

### v13.5 時点のベースライン

```
scripts/fetch_macro_indicators.py  92%
scripts/fetch_market_data.py       84%
scripts/common.py                  53%
TOTAL                              24%
```

`scripts/fetch_news.py` / `fetch_central_banks.py` / `fetch_economic_chart.py` / `fetch_featured_charts.py` / `fetch_listed_alts.py` / `fetch_valuations.py` / `archive_data.py` は 0% (v13.4.2 の統合テスト対象外)。

将来 v13.5.x で段階的にテスト追加していく余地あり。

### 閾値 enforce はしない方針

v13.5 では「可視化のみ、`fail_under` 無し」(DECISION v13.4-plan-01)。
カバレッジが安定してきたら段階的に閾値を入れる余地あり。

---

## 3. Lighthouse CI

### 何もしなくて動く

`.lighthouserc.cjs` と `.github/workflows/ci.yml` の Lighthouse ステップで完結。
PR ごとに CI 内で Lighthouse が動き、結果は **temporary-public-storage** (Google が無料提供する一時 URL) にアップロードされる。

### 結果の見方

1. PR ページ → CI run → "Lighthouse CI" ステップを展開
2. 最後の方に "Open the report at https://storage.googleapis.com/..." と出力される
3. その URL を開くと通常の Lighthouse レポート (パフォーマンス・アクセシビリティ・SEO・ベスト プラクティス) が見える

### v13.5 時点の閾値

```
performance:     0.5  (warn 未満で警告)
accessibility:   0.85
best-practices:  0.85
seo:             0.85
```

すべて **warn** レベル (CI を落とさない)。実情を見て閾値を調整するつもり。

### LHCI_GITHUB_APP_TOKEN (オプション)

GitHub Status Check と連携したい場合、Lighthouse CI GitHub App を install して `LHCI_GITHUB_APP_TOKEN` を Secrets に追加できる。
v13.5 時点では未設定でも問題なく動く (上記の temporary URL で十分)。

---

## 4. Cloudflare Pages PR preview

### 目的

PR ごとに preview URL が自動生成される環境。merge 前に実機で UI を確認できる。
GitHub Pages 自体は `main` ブランチのみデプロイなので、PR 段階での確認手段がない。

### Cloudflare 側で行うこと

1. https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
2. GitHub アカウントを連携 (まだなら)
3. `other9/market-monitor` を選択
4. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: (空欄、リポジトリルート)
5. Environment variables:
   - `BASE_URL` = `/` (Cloudflare Pages はサブパスではないので `/`)
   - `VITE_SENTRY_DSN` = (Sentry を有効にしたいなら同じ DSN を入れる)
6. Save and Deploy

### 自動的に起こること

- `main` への push → Production deployment (`https://market-monitor.pages.dev/`)
- PR (branch push) → Preview deployment (`https://<random>.market-monitor.pages.dev/`)
- PR には Cloudflare のコメントが自動で付く (preview URL リンク)

### GitHub Pages との関係

- **GitHub Pages**: `main` のデプロイ先 (`https://other9.github.io/market-monitor/`、本番)
- **Cloudflare Pages**: PR preview 用 + 副 production (`https://market-monitor.pages.dev/`、こちらは preview メイン用途)

両方が動いている状態を維持する。Cloudflare 側を本番に切り替える必要はない (GitHub Pages の本番運用は変えない方針)。

### BASE_URL の違いに注意

- GitHub Pages: `BASE_URL=/market-monitor/` (project page なのでサブパス)
- Cloudflare Pages: `BASE_URL=/` (カスタムドメイン or サブドメイン)

`.github/workflows/daily-update.yml` では `/market-monitor/` を渡すが、Cloudflare Pages の build settings では `/` を指定する。

---

## トラブルシューティング

各サービスでの障害は `docs/RUNBOOK.md` の対応する節を参照。

- Sentry が反応しない → DSN が Secrets に正しく入っているか、build ログで `VITE_SENTRY_DSN` が non-empty か
- Codecov コメントが付かない → public repo として activate 済みか、PR Comment が有効か
- Lighthouse CI が temporary-public-storage に上げられない → ネットワーク or Google 側障害。CI ログ上のスコアだけで確認
- Cloudflare Pages の preview が建たない → Cloudflare の Build log を見る、`BASE_URL=/` になっているか確認

---

## 関連ドキュメント

- [`PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) — 全体方針
- [`ROADMAP.md`](../ROADMAP.md) — v13.5 のスコープ詳細
- [`DECISIONS.md`](../DECISIONS.md) — DECISION v13.5-01 〜 05
- [`RUNBOOK.md`](RUNBOOK.md) — 障害時の参照
