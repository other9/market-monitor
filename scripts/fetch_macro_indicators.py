"""
fetch_macro_indicators.py  (v2 — expanded)

FRED API から 17 指標を取得し、data/macro.json に書き出す。
金利・信用・金融環境・為替/EM・エネルギーをカバー。
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


OUTPUT_PATH = Path("data/macro.json")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


INDICATORS: list[dict[str, Any]] = [
    # ─── 金利・期待 ───
    {"id": "DGS2",         "name": "米2年国債利回り",       "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "政策金利に近い短中期金利、Fed予想の温度計"},
    {"id": "DGS10",        "name": "米10年国債利回り",      "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "世界金利のベンチマーク"},
    {"id": "DGS30",        "name": "米30年国債利回り",      "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "超長期、年金・インフラ投資の基準"},
    {"id": "T10Y2Y",       "name": "10Y-2Y スプレッド",     "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "景気指標。マイナスで逆イールド警戒"},
    {"id": "T10YIE",       "name": "10年ブレークイーブン",   "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "市場が織り込む期待インフレ率"},
    {"id": "DFII10",       "name": "10年実質金利 (TIPS)",    "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "名目-期待インフレ。金と逆相関"},
    {"id": "SOFR",         "name": "SOFR (担保付翌日物)",    "group": "金利・期待",  "freq": "日次", "unit": "%",  "desc": "米短期金利のベンチマーク"},
    {"id": "MORTGAGE30US", "name": "米30年住宅ローン金利",  "group": "金利・期待",  "freq": "週次", "unit": "%",  "desc": "家計への金利伝達チャネル"},

    # ─── 信用市場 ───
    {"id": "BAMLH0A0HYM2", "name": "HY社債スプレッド (OAS)", "group": "信用市場",    "freq": "日次", "unit": "%",  "desc": "信用ストレスの王様。4%超で警戒"},
    {"id": "BAMLC0A0CM",   "name": "IG社債スプレッド (OAS)", "group": "信用市場",    "freq": "日次", "unit": "%",  "desc": "投資適格債の信用状況"},
    {"id": "BAMLEMCBPIOAS","name": "EM社債スプレッド (OAS)", "group": "信用市場",    "freq": "日次", "unit": "%",  "desc": "新興国クレジット、ドル流動性指標"},

    # ─── 金融環境 ───
    {"id": "NFCI",         "name": "Chicago Fed金融環境",    "group": "金融環境",    "freq": "週次", "unit": "z",  "desc": "+で引き締まり、-で緩和"},
    {"id": "STLFSI4",      "name": "St. Louis金融ストレス",  "group": "金融環境",    "freq": "週次", "unit": "z",  "desc": "18系列統合ストレス指標"},

    # ─── 為替・EM・エネルギー ───
    {"id": "DTWEXBGS",     "name": "ドル指数 (広義)",        "group": "為替・EM",    "freq": "日次", "unit": "idx","desc": "貿易加重、新興国通貨含む"},
    {"id": "DEXBZUS",      "name": "USD/BRL (ブラジル)",     "group": "為替・EM",    "freq": "日次", "unit": "fx", "desc": "中南米EMのベンチマーク"},
    {"id": "DEXMXUS",      "name": "USD/MXN (メキシコ)",     "group": "為替・EM",    "freq": "日次", "unit": "fx", "desc": "北米サプライチェーン連動"},
    {"id": "DHHNGSP",      "name": "天然ガス (Henry Hub)",   "group": "為替・EM",    "freq": "日次", "unit": "$",  "desc": "米国エネルギー価格の基準"},
]


def fetch_fred_series(series_id: str, api_key: str) -> pd.Series:
    params = {
        "series_id":         series_id,
        "api_key":           api_key,
        "file_type":         "json",
        "observation_start": (datetime.now() - pd.DateOffset(years=2)).strftime("%Y-%m-%d"),
    }
    try:
        r = requests.get(FRED_BASE, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[WARN] FRED {series_id}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64")

    obs = data.get("observations", [])
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
    return pd.Series(dict(rows)).sort_index().dropna()


def diff_at(series: pd.Series, days_back: int) -> float | None:
    if series.empty:
        return None
    last_date = series.index[-1]
    target = last_date - pd.Timedelta(days=days_back)
    sliced = series.loc[series.index <= target]
    if sliced.empty:
        return None
    return float(sliced.iloc[-1])


def main() -> None:
    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        print("[ERROR] FRED_API_KEY is not set", file=sys.stderr)
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "indicators": [],
            "error": "FRED_API_KEY not set",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    now = datetime.now(timezone.utc)
    out: list[dict[str, Any]] = []

    for ind in INDICATORS:
        s = fetch_fred_series(ind["id"], api_key)
        if s.empty or len(s) < 2:
            print(f"[WARN] {ind['id']}: insufficient data")
            continue

        last = float(s.iloc[-1])
        prev = diff_at(s, 1)
        prev7 = diff_at(s, 7)
        prev30 = diff_at(s, 30)

        def _diff(now_val, then_val):
            if then_val is None:
                return None
            return round(now_val - then_val, 3)

        entry = {
            "id":       ind["id"],
            "name":     ind["name"],
            "group":    ind["group"],
            "freq":     ind["freq"],
            "unit":     ind["unit"],
            "desc":     ind["desc"],
            "value":    round(last, 3),
            "diff1d":   _diff(last, prev),
            "diff7d":   _diff(last, prev7),
            "diff30d":  _diff(last, prev30),
            "asOf":     s.index[-1].strftime("%Y-%m-%d"),
        }
        out.append(entry)
        print(f"[OK]  {ind['id']:15s} {last:>8.3f}  d1={entry['diff1d']}  asOf {entry['asOf']}  [{ind['freq']}]")

    payload = {
        "generatedAt": now.isoformat(),
        "indicators":  out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: {len(out)} indicators.")


if __name__ == "__main__":
    main()
