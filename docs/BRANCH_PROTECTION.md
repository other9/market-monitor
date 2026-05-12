# Branch Protection Setup — Market Monitor

GitHub UI でしか設定できないため、手順を文書化しておく (v13.4.2 で導入)。

---

## 目的

- main ブランチへの誤プッシュを防ぐ
- PR を作って CI が通ってから merge する流れを定着させる
- ただし **kk の小修正 zip フローは維持** したいので、kk アカウント自身は bypass 許可
- GitHub Actions の自動コミット (`chore: update market data ...`) も継続させる

---

## 手順

### 1. CODEOWNERS の有効化を確認

`.github/CODEOWNERS` が存在することを確認 (v13.4.2 で追加済)。
内容:
```
* @other9
```

これだけで PR を作ったとき kk が自動的にレビュアー候補として表示されるようになる。

### 2. ブランチ保護ルールの設定

`Settings → Branches → Branch protection rules → Add rule`

#### Branch name pattern
```
main
```

#### 設定する項目

✅ **Require a pull request before merging**
   - ☐ Require approvals (オフ — sole reviewer なので自分自身を approve できない)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners

✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - Status checks (検索して追加):
     - `python` (= ci.yml の Python ジョブ)
     - `frontend` (= ci.yml の Frontend ジョブ)

✅ **Require conversation resolution before merging**

☐ Require signed commits (オフ — Codespaces からの push との相性)

☐ Require linear history (オフ — Actions の自動 commit がぶら下がるため)

✅ **Do not allow bypassing the above settings** はオフ
   - 代わりに **Restrict who can push to matching branches** で例外設定:
     - ☑ Restrict pushes that create matching branches
     - Allow specific actors to bypass required pull requests:
       - `@other9` を追加 (= kk の zip + 直 push フロー維持)
       - `github-actions[bot]` を追加 (= chore: update market data の自動 commit)

✅ **Allow force pushes** はオフ
✅ **Allow deletions** はオフ

### 3. 設定の確認

- 別 branch を作って PR を出してみる → CI が必須 status check として表示されるか
- `gh pr merge` で merge できるか (Code Owner review が approve として効くか)
- kk アカウントから main へ直 push できるか (bypass が効いているか)
- Actions の chore commit が引き続き push できるか (`github-actions[bot]` の bypass が効いているか)

---

## 想定される運用フロー (v13.4.2 以降)

### 小修正 (1-2 ファイル) — bypass 利用
```bash
cd /workspaces/market-monitor
git pull --rebase origin main
# zip 適用 or 直接編集
git add . && git commit -m "fix: typo"
git push    # bypass 許可されているので直 push 可
```

### 中規模変更 (1 セクション追加など) — PR フロー
```bash
git pull --rebase origin main
git checkout -b feat/v16.0-edinet
# 編集
git add . && git commit -m "feat: ..."
git push -u origin feat/v16.0-edinet
gh pr create --fill
# → CI 待ち (Ruff + mypy + pytest + ESLint + Vitest + Vite build)
# → Code Owner review (自分で approve)
# → gh pr merge
```

### Dependabot 自動 PR
- 週次 (月曜 08:00 JST) に minor/patch 更新の PR が自動生成される
- CI が通れば kk が review → merge
- major 更新は ignore 設定済 (DECISION v13.4.0-04)

---

## 落とし穴

- **Code Owner review が approve 必須にできない**: sole reviewer (= 自分自身) では PR を自分で approve できない。なので「Require approvals」は **オフ**、「Require review from Code Owners」だけ有効化する
- **github-actions[bot] の bypass を忘れると毎朝の自動 commit が止まる**: daily-update.yml が main に push できなくなる
- **status check 名は CI 実行後に検索可能になる**: 一度 PR を作って CI を回さないと、ドロップダウンに `python` / `frontend` が出てこない。最初は手動で 1 つ PR を作って CI を回してから protection rule に追加する

---

## 関連ドキュメント

- [`PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) — 全体方針
- [`RUNBOOK.md`](RUNBOOK.md) — 障害時の参照
- [`../DECISIONS.md`](../DECISIONS.md) — DECISION v13.4-plan-02 (ハイブリッド運用) / v13.4.2-XX (本ガイド)
