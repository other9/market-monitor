"""
archive_data.py
コミット直前に、当日の data/*.json のスナップショットを
data/archive/YYYY-MM-DD/ にコピーする。

Deep Dive・経済指標・ニュース等を蓄積し、過去のダッシュボードを後から辿れるようにする。
"""

from __future__ import annotations

import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path


DATA_DIR    = Path("data")
ARCHIVE_DIR = Path("data/archive")

# アーカイブ対象 (data/ 直下のもののみ、archive/ 自体は除外)
TARGETS = [
    "market.json",
    "macro.json",
    "valuations.json",
    "central_banks.json",
    "news.json",
    "featured.json",
    "economic.json",
    "listed_alts.json",
]


def main() -> None:
    # JST 基準の日付でフォルダ名を決める
    jst = timezone(timedelta(hours=9))
    today_jst = datetime.now(jst).strftime("%Y-%m-%d")
    target_dir = ARCHIVE_DIR / today_jst
    target_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    for name in TARGETS:
        src = DATA_DIR / name
        if not src.exists():
            print(f"[SKIP] {name} not found")
            continue
        dst = target_dir / name
        try:
            shutil.copy2(src, dst)
            copied += 1
            print(f"[OK]   {name} -> archive/{today_jst}/")
        except Exception as e:
            print(f"[WARN] {name}: {e}")

    # archive 全体のインデックスを更新 (ディレクトリ一覧)
    index_path = ARCHIVE_DIR / "index.json"
    days = sorted([p.name for p in ARCHIVE_DIR.iterdir() if p.is_dir()], reverse=True)
    import json
    index_path.write_text(
        json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "days":        days,
            "latest":      days[0] if days else None,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {target_dir}: {copied} files. index.json updated ({len(days)} days).")


if __name__ == "__main__":
    main()
