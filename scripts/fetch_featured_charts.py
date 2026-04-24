"""
fetch_featured_charts.py
news.json の charts_of_the_day (3本) で指定された銘柄の
1年日次データを取得し、data/featured.json に書き出す。

- yfinance / FRED 両方に対応
- fetch_news.py の後に実行されること
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
import yfinance as yf

from chart_universe import CHART_UNIVERSE, get_by_key


NEWS_PATH    = Path("data/news.json")
OUTPUT_PATH  = Path("data/featured.json")
FRED_BASE    = "https://api.stlouisfed.org/fred/series/observations"


def fetch_yf_daily(ticker: str) -> list[dict[str, Any]]:
    df = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=False)
    if df is None or df.empty:
        return []

    if isinstance(df.columns, pd.MultiIndex):
        if "Close" in df.columns.get_level_values(0):
            close_df = df.xs("Close", axis=1, level=0)
            if isinstance(close_df, pd.DataFrame) and close_df.shape[1] > 0:
                close = close_df.iloc[:, 0].dropna()
            else:
                return []
        else:
            return []
    elif "Close" in df.columns:
        s = df["Close"]
        close = s.iloc[:, 0].dropna() if isinstance(s, pd.DataFrame) else s.dropna()
    else:
        return []

    return [
        {"d": ts.strftime("%Y-%m-%d"), "v": round(float(v), 4)}
        for ts, v in close.items()
    ]


def fetch_fred_daily(series_id: str, api_key: str) -> list[dict[str, Any]]:
    params = {
        "series_id":         series_id,
        "api_key":           api_key,
        "file_type":         "json",
        "observation_start": (datetime.now() - pd.DateOffset(years=1)).strftime("%Y-%m-%d"),
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


def main() -> None:
    if not NEWS_PATH.exists():
        print(f"[ERROR] {NEWS_PATH} not found. Run fetch_news.py first.", file=sys.stderr)
        return

    news = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    picks = news.get("charts_of_the_day", [])
    if not picks:
        print("[WARN] No charts_of_the_day in news.json")
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "featured": [],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    fred_key = os.environ.get("FRED_API_KEY", "")

    featured = []
    for pick in picks:
        key = pick.get("key")
        uni = get_by_key(key)
        if not uni:
            print(f"[WARN] Unknown chart key: {key}")
            continue

        if uni["source"] == "fred":
            if not fred_key:
                print(f"[WARN] FRED_API_KEY not set; skipping {key}")
                continue
            series = fetch_fred_daily(uni["id"], fred_key)
        else:
            series = fetch_yf_daily(uni["id"])

        if not series:
            print(f"[WARN] {key} ({uni['id']}): no data")
            continue

        last_val = series[-1]["v"]
        first_val = series[0]["v"]
        pct_1y = round((last_val / first_val - 1) * 100, 2) if first_val else None

        featured.append({
            "key":       key,
            "title":     pick.get("title") or uni["name"],
            "rationale": pick.get("rationale", ""),
            "name":      uni["name"],
            "sub":       uni["sub"],
            "source":    uni["source"],
            "last":      last_val,
            "pct1y":     pct_1y,
            "asOf":      series[-1]["d"],
            "history":   series,
        })
        print(f"[OK]  {key:12s} {len(series):>4d} points, last={last_val}  ({pct_1y:+}% 1Y)")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "featured":    featured,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: {len(featured)} featured charts")


if __name__ == "__main__":
    main()
