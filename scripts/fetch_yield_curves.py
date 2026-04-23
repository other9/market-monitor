"""
fetch_yield_curves.py  (v2 — uses direct stooq CSV download)

日・米・独の主要年限の国債利回りを取得し data/yields.json に書き出す。

- 米: yfinance 経由
- 日・独: stooq CSV ダウンロード (pandas.read_csv を直接使用)

GitHub Actions で毎朝7時(JST)に実行される想定。
"""

from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yfinance as yf


OUTPUT_PATH = Path("data/yields.json")


# ─────────────────────────────────────────────────────────
# 取得する年限とソース
#   source == "yf"    → yfinance
#   source == "stooq" → stooq CSV を直接 HTTP 取得
# ─────────────────────────────────────────────────────────
TENORS: list[dict[str, Any]] = [
    # --- United States (yfinance) ---
    {"country": "US", "tenor": 2,  "source": "yf",    "symbol": "^UST2YR"},
    {"country": "US", "tenor": 5,  "source": "yf",    "symbol": "^FVX"},
    {"country": "US", "tenor": 10, "source": "yf",    "symbol": "^TNX"},
    {"country": "US", "tenor": 30, "source": "yf",    "symbol": "^TYX"},

    # --- Japan (stooq) ---
    {"country": "JP", "tenor": 2,  "source": "stooq", "symbol": "2yjpy.b"},
    {"country": "JP", "tenor": 5,  "source": "stooq", "symbol": "5yjpy.b"},
    {"country": "JP", "tenor": 10, "source": "stooq", "symbol": "10yjpy.b"},
    {"country": "JP", "tenor": 20, "source": "stooq", "symbol": "20yjpy.b"},
    {"country": "JP", "tenor": 30, "source": "stooq", "symbol": "30yjpy.b"},

    # --- Germany (stooq) ---
    {"country": "DE", "tenor": 2,  "source": "stooq", "symbol": "2yde.b"},
    {"country": "DE", "tenor": 5,  "source": "stooq", "symbol": "5yde.b"},
    {"country": "DE", "tenor": 10, "source": "stooq", "symbol": "10yde.b"},
    {"country": "DE", "tenor": 30, "source": "stooq", "symbol": "30yde.b"},
]


# ─────────────────────────────────────────────────────────
# yfinance 取得
# ─────────────────────────────────────────────────────────
def fetch_yf(symbol: str) -> pd.Series:
    df = yf.download(symbol, period="10d", interval="1d", progress=False, auto_adjust=False)
    if df is None or df.empty:
        return pd.Series(dtype="float64")

    if isinstance(df.columns, pd.MultiIndex):
        if "Close" in df.columns.get_level_values(0):
            close_df = df.xs("Close", axis=1, level=0)
            if isinstance(close_df, pd.DataFrame) and close_df.shape[1] > 0:
                return close_df.iloc[:, 0].dropna()
        return pd.Series(dtype="float64")

    if "Close" in df.columns:
        s = df["Close"]
        if isinstance(s, pd.DataFrame):
            return s.iloc[:, 0].dropna() if s.shape[1] > 0 else pd.Series(dtype="float64")
        return s.dropna()

    return pd.Series(dtype="float64")


# ─────────────────────────────────────────────────────────
# stooq 取得 (CSV 直接ダウンロード)
#   URL 仕様: https://stooq.com/q/d/l/?s=SYMBOL&i=d
# ─────────────────────────────────────────────────────────
STOOQ_URL = "https://stooq.com/q/d/l/"


def fetch_stooq(symbol: str) -> pd.Series:
    try:
        resp = requests.get(
            STOOQ_URL,
            params={"s": symbol, "i": "d"},
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (MarketMonitor GitHub Action)"},
        )
        resp.raise_for_status()
        text = resp.text

        # stooq はデータがないときに "No data" などを返すことがある
        if not text or text.startswith("No data") or "Date,Open,High,Low,Close" not in text.split("\n")[0]:
            print(f"[WARN] stooq {symbol}: no data returned")
            return pd.Series(dtype="float64")

        df = pd.read_csv(io.StringIO(text), parse_dates=["Date"])
        if df.empty or "Close" not in df.columns:
            return pd.Series(dtype="float64")

        df = df.sort_values("Date").set_index("Date")
        return df["Close"].dropna()

    except Exception as e:
        print(f"[WARN] stooq {symbol}: {e}")
        return pd.Series(dtype="float64")


# ─────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────
def main() -> None:
    now = datetime.now(timezone.utc)
    curves: dict[str, list[dict[str, Any]]] = {"JP": [], "US": [], "DE": []}

    for t in TENORS:
        if t["source"] == "yf":
            s = fetch_yf(t["symbol"])
        else:
            s = fetch_stooq(t["symbol"])

        if s.empty or len(s) < 2:
            print(f"[WARN] {t['country']}-{t['tenor']}Y ({t['symbol']}): insufficient data")
            continue

        last = float(s.iloc[-1])
        prev = float(s.iloc[-2])
        last_date = s.index[-1]
        if hasattr(last_date, "to_pydatetime"):
            last_date = last_date.to_pydatetime()

        diff_bp = round((last - prev) * 100, 1)

        curves[t["country"]].append({
            "tenor":     t["tenor"],
            "yield":     round(last, 3),
            "prevYield": round(prev, 3),
            "diffBp":    diff_bp,
            "asOf":      last_date.strftime("%Y-%m-%d") if hasattr(last_date, "strftime") else str(last_date),
        })
        print(f"[OK]  {t['country']}-{t['tenor']:>2d}Y  {last:>6.3f}%  ({diff_bp:+.1f} bp)")

    for k in curves:
        curves[k].sort(key=lambda x: x["tenor"])

    payload = {
        "generatedAt": now.isoformat(),
        "curves":      curves,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: "
          f"JP={len(curves['JP'])} US={len(curves['US'])} DE={len(curves['DE'])} tenors")


if __name__ == "__main__":
    main()
