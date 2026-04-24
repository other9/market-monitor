"""
fetch_economic_chart.py
news.json の economic_chart_of_the_day で指定された FRED 系列を取得し、
data/economic.json に書き出す。

fetch_news.py の後に実行する。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests


NEWS_PATH   = Path("data/news.json")
OUTPUT_PATH = Path("data/economic.json")
FRED_BASE   = "https://api.stlouisfed.org/fred/series/observations"


def fetch_fred_series(series_id: str, api_key: str, years: int) -> list[dict[str, Any]]:
    params = {
        "series_id":         series_id,
        "api_key":           api_key,
        "file_type":         "json",
        "observation_start": (datetime.now() - pd.DateOffset(years=years)).strftime("%Y-%m-%d"),
    }
    try:
        r = requests.get(FRED_BASE, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[WARN] FRED {series_id}: {e}", file=sys.stderr)
        return []

    out = []
    for o in data.get("observations", []):
        if o.get("value") in (".", "", None):
            continue
        try:
            out.append({"d": o["date"], "v": round(float(o["value"]), 4)})
        except (ValueError, TypeError):
            continue
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
        print(f"[WARN] FRED metadata {series_id}: {e}", file=sys.stderr)
    return {}


def main() -> None:
    if not NEWS_PATH.exists():
        print(f"[ERROR] {NEWS_PATH} not found.", file=sys.stderr)
        return

    news = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    spec = news.get("economic_chart_of_the_day")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not spec:
        print("[INFO] No economic_chart_of_the_day in news.json")
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "chart": None,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    api_key = os.environ.get("FRED_API_KEY", "")
    if not api_key:
        print("[ERROR] FRED_API_KEY is not set", file=sys.stderr)
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
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
        print(f"[WARN] {series_id}: insufficient data points ({len(history)})")
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
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
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "chart":       chart,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK]  economic/{series_id}  {len(history)} pts, last={last}, {meta.get('frequency','?')}")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
