"""
fetch_featured_charts.py  (v2 — retry-based)

news.json の charts_of_the_day (5〜10候補、優先度順) を上から順に試し、
**最初に取得に成功した3本**の1年日次データを取得して data/featured.json に書き出す。

- ticker は Claude が自由に指定できる (個別株・指数・FRED系列 OK)
- source="yf" / source="fred" で分岐
- 存在しないティッカー、データが薄い銘柄は自動スキップ

fetch_news.py の後に実行されること。
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


NEWS_PATH    = Path("data/news.json")
OUTPUT_PATH  = Path("data/featured.json")
FRED_BASE    = "https://api.stlouisfed.org/fred/series/observations"

MIN_POINTS   = 30   # 1年日次で最低これくらいあれば採用
TARGET_COUNT = 3    # ダッシュボードに出す最終チャート数


def fetch_yf_daily(ticker: str) -> list[dict[str, Any]]:
    """yfinance で 1年日次を取得。取れなければ空リスト。"""
    try:
        df = yf.download(ticker, period="1y", interval="1d",
                         progress=False, auto_adjust=False)
    except Exception as e:
        print(f"[WARN] yf {ticker}: exception {e}", file=sys.stderr)
        return []

    if df is None or df.empty:
        return []

    # MultiIndex対応
    if isinstance(df.columns, pd.MultiIndex):
        if "Close" in df.columns.get_level_values(0):
            close_df = df.xs("Close", axis=1, level=0)
            close = close_df.iloc[:, 0].dropna() if isinstance(close_df, pd.DataFrame) and close_df.shape[1] > 0 else pd.Series(dtype="float64")
        else:
            return []
    elif "Close" in df.columns:
        s = df["Close"]
        close = s.iloc[:, 0].dropna() if isinstance(s, pd.DataFrame) else s.dropna()
    else:
        return []

    if close.empty:
        return []

    return [
        {"d": ts.strftime("%Y-%m-%d"), "v": round(float(v), 4)}
        for ts, v in close.items()
    ]


def fetch_fred_daily(series_id: str, api_key: str) -> list[dict[str, Any]]:
    if not api_key:
        return []
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
        print(f"[WARN] fred {series_id}: {e}", file=sys.stderr)
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


def try_fetch(candidate: dict[str, Any], fred_key: str) -> list[dict[str, Any]]:
    src    = candidate.get("source", "yf")
    ticker = candidate.get("ticker", "")
    if not ticker:
        return []

    if src == "fred":
        series = fetch_fred_daily(ticker, fred_key)
    else:
        series = fetch_yf_daily(ticker)

    if len(series) < MIN_POINTS:
        return []
    return series


def main() -> None:
    if not NEWS_PATH.exists():
        print(f"[ERROR] {NEWS_PATH} not found. Run fetch_news.py first.", file=sys.stderr)
        return

    news = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
    candidates = news.get("charts_of_the_day", [])
    if not candidates:
        print("[WARN] No chart candidates in news.json")
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "featured": [],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    fred_key = os.environ.get("FRED_API_KEY", "")

    featured = []
    for cand in candidates:
        if len(featured) >= TARGET_COUNT:
            break

        series = try_fetch(cand, fred_key)
        if not series:
            print(f"[SKIP] {cand.get('source'):4s} {cand.get('ticker'):15s}  (insufficient data)")
            continue

        last = series[-1]["v"]
        first = series[0]["v"]
        pct_1y = round((last / first - 1) * 100, 2) if first else None

        featured.append({
            "source":    cand["source"],
            "ticker":    cand["ticker"],
            "title":     cand.get("title") or cand["ticker"],
            "name":      cand.get("name") or cand.get("title") or cand["ticker"],
            "sub":       cand.get("sub", ""),
            "rationale": cand.get("rationale", ""),
            "last":      last,
            "pct1y":     pct_1y,
            "asOf":      series[-1]["d"],
            "history":   series,
        })
        print(f"[OK]   {cand['source']:4s} {cand['ticker']:15s}  {len(series):>4d}pts, last={last}  ({pct_1y:+}% 1Y)")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "featured":    featured,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: {len(featured)}/{TARGET_COUNT} charts from {len(candidates)} candidates")


if __name__ == "__main__":
    main()
