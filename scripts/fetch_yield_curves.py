"""
fetch_yield_curves.py  (v3 — FRED API)

日・米・独の主要年限の国債利回りを FRED API から取得し data/yields.json に書き出す。

- FRED (Federal Reserve Economic Data) 無料API
- 環境変数 FRED_API_KEY が必要 (https://fredaccount.stlouisfed.org/apikeys)
- 米: 日次データ (2Y/5Y/10Y/30Y)
- 日: 月次データ (短期近似/10Y)
- 独: 月次データ (短期近似/10Y)

※ 日独の FRED 系列は月次のみ。直近月末値を当日値として扱う。
   日次データが必要な場合は ECB API 等への拡張が必要。
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


OUTPUT_PATH = Path("data/yields.json")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


# ─────────────────────────────────────────────────────────
# FRED シリーズ ID
# ─────────────────────────────────────────────────────────
SERIES: list[dict[str, Any]] = [
    # --- United States (daily, Treasury CMT) ---
    {"country": "US", "tenor": 2,  "id": "DGS2"},
    {"country": "US", "tenor": 5,  "id": "DGS5"},
    {"country": "US", "tenor": 10, "id": "DGS10"},
    {"country": "US", "tenor": 30, "id": "DGS30"},

    # --- Japan (monthly, IMF/OECD 経由) ---
    {"country": "JP", "tenor": 1,  "id": "IRSTCI01JPM156N"},   # 3ヶ月マネーマーケット (≈短期)
    {"country": "JP", "tenor": 10, "id": "IRLTLT01JPM156N"},   # 10年

    # --- Germany (monthly, 同上) ---
    {"country": "DE", "tenor": 1,  "id": "IRSTCI01DEM156N"},   # 3ヶ月マネーマーケット
    {"country": "DE", "tenor": 10, "id": "IRLTLT01DEM156N"},   # 10年
]


def fetch_fred_series(series_id: str, api_key: str) -> pd.Series:
    """FRED API から系列を取得して Series で返す。直近2年分。"""
    params = {
        "series_id":          series_id,
        "api_key":            api_key,
        "file_type":          "json",
        "observation_start":  (datetime.now() - pd.DateOffset(years=2)).strftime("%Y-%m-%d"),
    }
    try:
        r = requests.get(FRED_BASE, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[WARN] FRED {series_id}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64")

    obs = data.get("observations", [])
    if not obs:
        return pd.Series(dtype="float64")

    rows = []
    for o in obs:
        if o.get("value") in (".", "", None):
            continue
        try:
            rows.append((pd.Timestamp(o["date"]), float(o["value"])))
        except (ValueError, TypeError):
            continue

    if not rows:
        return pd.Series(dtype="float64")

    s = pd.Series(dict(rows)).sort_index()
    return s.dropna()


def main() -> None:
    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        print("[ERROR] FRED_API_KEY is not set", file=sys.stderr)
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "curves": {"JP": [], "US": [], "DE": []},
            "error": "FRED_API_KEY not set",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    now = datetime.now(timezone.utc)
    curves: dict[str, list[dict[str, Any]]] = {"JP": [], "US": [], "DE": []}

    for t in SERIES:
        s = fetch_fred_series(t["id"], api_key)

        if s.empty or len(s) < 2:
            print(f"[WARN] {t['country']}-{t['tenor']}Y ({t['id']}): insufficient data")
            continue

        last = float(s.iloc[-1])
        prev = float(s.iloc[-2])
        last_date = s.index[-1].to_pydatetime()

        diff_bp = round((last - prev) * 100, 1)

        curves[t["country"]].append({
            "tenor":     t["tenor"],
            "yield":     round(last, 3),
            "prevYield": round(prev, 3),
            "diffBp":    diff_bp,
            "asOf":      last_date.strftime("%Y-%m-%d"),
            "seriesId":  t["id"],
        })
        print(f"[OK]  {t['country']}-{t['tenor']:>2d}Y  {last:>6.3f}%  ({diff_bp:+.1f} bp)  [{t['id']}]")

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
