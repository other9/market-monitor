"""
fetch_yield_curves.py
日・米・独の主要年限の国債利回りを yfinance / stooq から取得し、
data/yields.json に書き出す。

- 当日終値
- 前日終値
- 差分 (bp)

GitHub Actions で毎朝7時(JST)に実行される想定。
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf

try:
    import pandas_datareader.data as pdr  # for stooq fallback
    HAS_PDR = True
except ImportError:
    HAS_PDR = False


OUTPUT_PATH = Path("data/yields.json")


# ─────────────────────────────────────────────────────────
# 取得する年限
#   yfinance で取れる: 米 ^IRX(13W), ^FVX(5Y), ^TNX(10Y), ^TYX(30Y)
#   他国は stooq 経由が安定: 10yjpy.b, 2yjpy.b, ... / 10yde.b, 10yusy.b など
#   ※ stooq が不安定な場合に備え、欠損はスキップ。
# ─────────────────────────────────────────────────────────

# (country, tenor_years, source, symbol)
#   source == "yf"    → yfinance (利回りは % 値そのまま)
#   source == "stooq" → stooq経由 (pandas-datareader), Close は % 値
TENORS: list[dict[str, Any]] = [
    # --- United States ---
    {"country": "US", "tenor": 2,  "source": "yf",    "symbol": "^UST2YR"},   # 代替
    {"country": "US", "tenor": 5,  "source": "yf",    "symbol": "^FVX"},
    {"country": "US", "tenor": 10, "source": "yf",    "symbol": "^TNX"},
    {"country": "US", "tenor": 30, "source": "yf",    "symbol": "^TYX"},

    # --- Japan ---
    {"country": "JP", "tenor": 2,  "source": "stooq", "symbol": "2yjpy.b"},
    {"country": "JP", "tenor": 5,  "source": "stooq", "symbol": "5yjpy.b"},
    {"country": "JP", "tenor": 10, "source": "stooq", "symbol": "10yjpy.b"},
    {"country": "JP", "tenor": 20, "source": "stooq", "symbol": "20yjpy.b"},
    {"country": "JP", "tenor": 30, "source": "stooq", "symbol": "30yjpy.b"},

    # --- Germany ---
    {"country": "DE", "tenor": 2,  "source": "stooq", "symbol": "2yde.b"},
    {"country": "DE", "tenor": 5,  "source": "stooq", "symbol": "5yde.b"},
    {"country": "DE", "tenor": 10, "source": "stooq", "symbol": "10yde.b"},
    {"country": "DE", "tenor": 30, "source": "stooq", "symbol": "30yde.b"},
]


def fetch_yf(symbol: str) -> pd.Series:
    """yfinance から直近2営業日の終値を Series で返す。"""
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


def fetch_stooq(symbol: str) -> pd.Series:
    """stooq 経由で利回りを取得。失敗時は空 Series。"""
    if not HAS_PDR:
        return pd.Series(dtype="float64")
    try:
        df = pdr.DataReader(symbol, "stooq")
        if df is None or df.empty or "Close" not in df.columns:
            return pd.Series(dtype="float64")
        # stooq は新しい順なので時系列順にソート
        return df["Close"].dropna().sort_index()
    except Exception as e:
        print(f"[WARN] stooq {symbol}: {e}")
        return pd.Series(dtype="float64")


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

        # bp差分
        diff_bp = round((last - prev) * 100, 1)

        curves[t["country"]].append({
            "tenor":       t["tenor"],
            "yield":       round(last, 3),
            "prevYield":   round(prev, 3),
            "diffBp":      diff_bp,
            "asOf":        last_date.strftime("%Y-%m-%d") if hasattr(last_date, "strftime") else str(last_date),
        })
        print(f"[OK]  {t['country']}-{t['tenor']:>2d}Y  {last:>6.3f}%  ({diff_bp:+.1f} bp)")

    # 各国、tenor順でソート
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
