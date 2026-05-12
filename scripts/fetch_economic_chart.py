"""
fetch_economic_chart.py  (v13.3 — common.py 利用)
news.json の economic_chart_of_the_day で指定された FRED 系列を取得し、
data/economic.json に書き出す。

fetch_news.py の後に実行する。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests

# v13.3: common.py を使う
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.common import fred_observations, log_info, log_ok, log_warn, utc_now_iso

NEWS_PATH   = Path("data/news.json")
OUTPUT_PATH = Path("data/economic.json")


def fetch_fred_series(series_id: str, api_key: str, years: int) -> list[dict[str, Any]]:
    """v13.3: common.fred_observations の薄いラッパ ({d, v} 形式に整形)。"""
    try:
        obs = fred_observations(
            series_id,
            api_key=api_key,
            observation_start=(datetime.now() - pd.DateOffset(years=years)).strftime("%Y-%m-%d"),
        )
    except Exception as e:
        log_warn(f"FRED {series_id}: {e}")
        return []
    out = []
    for o in obs:
        if o["value"] is None:
            continue
        out.append({"d": o["date"], "v": round(float(o["value"]), 4)})
    return out


def fetch_fred_metadata(series_id: str, api_key: str) -> dict[str, Any]:
    """FRED /fred/series エンドポイントから単位・頻度などのメタ情報を取得。"""
    try:
        r = requests.get(
            "https://api.stlouisfed.org/fred/series",
            params={"series_id": series_id, "api_key": api_key, "file_type": "json"},
            timeout=15,
        )
        r.raise_for_status()
        seriesList = r.json().get("seriess", [])
        if seriesList:
            s = seriesList[0]
            return {
                "units":     s.get("units", ""),
                "frequency": s.get("frequency", ""),
                "title":     s.get("title", ""),
            }
    except Exception as e:
        log_warn(f"FRED metadata {series_id}: {e}")
    return {}


def main() -> None:
    if not NEWS_PATH.exists():
        log_warn(f"{NEWS_PATH} not found.")
        return

    news = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    spec = news.get("economic_chart_of_the_day")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not spec:
        log_info("No economic_chart_of_the_day in news.json")
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": utc_now_iso(),
            "chart": None,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    api_key = os.environ.get("FRED_API_KEY", "")
    if not api_key:
        log_warn("FRED_API_KEY is not set")
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": utc_now_iso(),
            "chart": None,
            "error": "FRED_API_KEY not set",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    series_id  = spec.get("series_id", "")
    title      = spec.get("title", series_id)
    subtitle   = spec.get("subtitle", "")
    rationale  = spec.get("rationale", "")
    years      = int(spec.get("period_years", 3))
    years      = max(1, min(years, 10))

    history = fetch_fred_series(series_id, api_key, years)
    if not history or len(history) < 5:
        log_warn(f"{series_id}: insufficient data points ({len(history)})")
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": utc_now_iso(),
            "chart": None,
            "error": f"series {series_id} unavailable",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    meta = fetch_fred_metadata(series_id, api_key)

    last = history[-1]["v"]
    prev = history[-2]["v"] if len(history) >= 2 else None
    diff = round(last - prev, 4) if prev is not None else None

    first = history[0]["v"]
    pct_total = round((last / first - 1) * 100, 2) if first else None

    chart = {
        "series_id":    series_id,
        "title":        title,
        "subtitle":     subtitle,
        "rationale":    rationale,
        "period_years": years,
        "units":        meta.get("units", ""),
        "frequency":    meta.get("frequency", ""),
        "official_title": meta.get("title", ""),
        "last":         last,
        "diff":         diff,
        "pctTotal":     pct_total,
        "asOf":         history[-1]["d"],
        "history":      history,
    }

    OUTPUT_PATH.write_text(json.dumps({
        "generatedAt": utc_now_iso(),
        "chart":       chart,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    log_ok(f"economic/{series_id}  {len(history)} pts, last={last}, {meta.get('frequency','?')}")
    log_info(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
