"""
archive_data.py  (v13.3 — common.py 利用)

コミット直前に、当日の data/*.json のスナップショットを
data/archive/YYYY-MM-DD/ にコピーする。

Deep Dive・経済指標・ニュース等を蓄積し、過去のダッシュボードを後から辿れるようにする。

歴史:
  v13.3: scripts/common.py の jst_today_iso / utc_now_iso / log_* に乗せ替え
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

# v13.3: common.py を使う
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.common import jst_today_iso, utc_now_iso, log_ok, log_warn, log_skip, log_info


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
    today_jst = jst_today_iso()
    target_dir = ARCHIVE_DIR / today_jst
    target_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    for name in TARGETS:
        src = DATA_DIR / name
        if not src.exists():
            log_skip(f"{name} not found")
            continue
        dst = target_dir / name
        try:
            shutil.copy2(src, dst)
            copied += 1
            log_ok(f"{name} -> archive/{today_jst}/")
        except Exception as e:
            log_warn(f"{name}: {e}")

    # archive 全体のインデックスを更新 (ディレクトリ一覧)
    index_path = ARCHIVE_DIR / "index.json"
    days = sorted([p.name for p in ARCHIVE_DIR.iterdir() if p.is_dir()], reverse=True)
    index_path.write_text(
        json.dumps({
            "generatedAt": utc_now_iso(),
            "days":        days,
            "latest":      days[0] if days else None,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log_info(f"Wrote {target_dir}: {copied} files. index.json updated ({len(days)} days).")


if __name__ == "__main__":
    main()
