#!/usr/bin/env bash
# take_snapshot.sh — 改修確認用の作業領域 snapshot を作成する。
#
# 用途: 改修 zip 適用後の動作確認のため、Codespaces の現在の状態を
#       1 ファイルの zip に固めて Claude チャットに添付できるようにする。
#
# 出力: リポジトリ直下に mm-snapshot-YYYYMMDD-HHMM.zip を作成。
#       .gitignore で *.zip が除外されているので git に拾われない。

set -euo pipefail
cd "$(dirname "$0")/.."

NAME="mm-snapshot-$(date +%Y%m%d-%H%M).zip"

# 除外パターン:
#   .git/         git 履歴 (大きい、不要)
#   node_modules/ npm パッケージ (大きい、再生成可能)
#   dist/         Vite ビルド成果物 (再生成可能)
#   __pycache__   Python bytecode キャッシュ
#   *.pyc         Python bytecode
#   .DS_Store     macOS 残骸
#   mm-snapshot-*.zip            自分自身を含めない (再帰防止)
#   market-monitor-claude-project.zip   Claude Project 用 zip (もしあれば)

zip -r "$NAME" . \
  -x '.git/*' '*node_modules*' 'dist/*' '*__pycache__*' '*.pyc' '.DS_Store' \
     'mm-snapshot-*.zip' 'market-monitor-claude-project.zip' \
  > /dev/null

SIZE=$(du -h "$NAME" | cut -f1)
COUNT=$(unzip -l "$NAME" | tail -1 | awk '{print $2}')

echo
echo "✓ Snapshot created: $NAME ($SIZE, $COUNT files)"
echo "  Path: $(realpath "$NAME")"
echo
echo "Next steps:"
echo "  1. VS Code エクスプローラーで右クリック → Download"
echo "  2. Claude チャットに添付"
echo "  3. 不要になったら: rm $NAME"
