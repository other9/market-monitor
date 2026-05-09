"""tests/conftest.py — pytest 共通設定。

scripts/ ディレクトリを sys.path に追加することで、
scripts/fetch_news.py 内の `from chart_universe import ...` のような
ローカル import (本番では Actions の PYTHONPATH=scripts 環境変数で解決) が
テスト時にも解決できるようにする。
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"

# リポジトリ root を最優先 (= scripts.common を import できる)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# scripts/ も追加 (= fetch_news.py の "from chart_universe import ..." 等を解決)
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
