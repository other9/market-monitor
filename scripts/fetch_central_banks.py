"""
fetch_central_banks.py
主要中央銀行の政策金利を FRED から取得し、data/central_banks.json に書き出す。

- 常設: Fed, ECB, BOJ
- ローテーション候補: BOE, SNB, RBA, RBNZ, BOC など (Claude側で日替わり選定)

Claude側 (fetch_news.py) で要人発言・市場見方のコメントを生成する際の
「事実ベース」を提供する。
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


OUTPUT_PATH = Path("data/central_banks.json")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


# ─────────────────────────────────────────────────────────
# 中央銀行リスト (常設 + ローテ候補)
# code: Claude が日替わり選定で使う識別子
# ─────────────────────────────────────────────────────────
CENTRAL_BANKS: list[dict[str, Any]] = [
    # ── 常設 ──
    {"code": "FED",   "name": "FRB (米連邦準備理事会)",       "country": "米国",      "always_show": True,
     "rate_id": "DFEDTARU",                                                                   # Fed Funds Target Upper
     "rate_name": "FF金利(上限)",
     "next_meeting_hint": "FOMC は約6週間ごと"},

    {"code": "ECB",   "name": "ECB (欧州中央銀行)",            "country": "ユーロ圏",  "always_show": True,
     "rate_id": "ECBDFR",                                                                     # ECB Deposit Facility Rate
     "rate_name": "預金ファシリティ金利",
     "next_meeting_hint": "ECB理事会は約6週間ごと"},

    {"code": "BOJ",   "name": "BOJ (日本銀行)",                "country": "日本",      "always_show": True,
     "rate_id": "IRSTCB01JPM156N",                                                            # JP central bank rate (短期政策金利)
     "rate_name": "無担保コール翌日物 (誘導目標)",
     "next_meeting_hint": "金融政策決定会合は年8回"},

    # ── ローテ候補 (Claude が選択) ──
    {"code": "BOE",   "name": "BOE (イングランド銀行)",        "country": "英国",      "always_show": False,
     "rate_id": "IRSTCB01GBM156N",
     "rate_name": "Bank Rate",
     "next_meeting_hint": "MPC は約6週間ごと"},

    {"code": "BOC",   "name": "BOC (カナダ銀行)",              "country": "カナダ",    "always_show": False,
     "rate_id": "IRSTCB01CAM156N",
     "rate_name": "翌日物金利目標",
     "next_meeting_hint": "8回/年"},

    {"code": "SNB",   "name": "SNB (スイス国立銀行)",          "country": "スイス",    "always_show": False,
     "rate_id": "IRSTCB01CHM156N",
     "rate_name": "政策金利",
     "next_meeting_hint": "四半期ごと"},

    {"code": "RBA",   "name": "RBA (豪州準備銀行)",            "country": "豪州",      "always_show": False,
     "rate_id": "IRSTCB01AUM156N",
     "rate_name": "キャッシュレート",
     "next_meeting_hint": "8回/年"},

    {"code": "RBNZ",  "name": "RBNZ (ニュージーランド準備銀行)","country": "ニュージーランド", "always_show": False,
     "rate_id": "IRSTCB01NZM156N",
     "rate_name": "Official Cash Rate",
     "next_meeting_hint": "7回/年"},
]


def fetch_fred(series_id: str, api_key: str, years: int = 2) -> pd.Series:
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
        return pd.Series(dtype="float64")

    rows = []
    for o in data.get("observations", []):
        if o.get("value") in (".", "", None):
            continue
        try:
            rows.append((pd.Timestamp(o["date"]), float(o["value"])))
        except (ValueError, TypeError):
            continue
    if not rows:
        return pd.Series(dtype="float64")
    return pd.Series(dict(rows)).sort_index().dropna()


def main() -> None:
    api_key = os.environ.get("FRED_API_KEY", "")
    out: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for cb in CENTRAL_BANKS:
        entry: dict[str, Any] = {
            "code":              cb["code"],
            "name":              cb["name"],
            "country":           cb["country"],
            "always_show":       cb["always_show"],
            "rate_name":         cb["rate_name"],
            "next_meeting_hint": cb["next_meeting_hint"],
        }

        if api_key and cb.get("rate_id"):
            s = fetch_fred(cb["rate_id"], api_key, years=2)
            if not s.empty:
                last = float(s.iloc[-1])
                last_date = s.index[-1]

                # 1ヶ月前との差 (基本的に変動が少ないので、3ヶ月前との差も計算)
                target_3m = last_date - pd.Timedelta(days=95)
                sliced = s.loc[s.index <= target_3m]
                prev_3m = float(sliced.iloc[-1]) if not sliced.empty else None

                # 直近の利上げ/利下げを判定 (履歴を遡って前回変更点を探す)
                last_change = None
                last_change_amount = None
                last_change_date = None
                for i in range(len(s) - 2, -1, -1):
                    if abs(float(s.iloc[i]) - last) > 0.01:
                        last_change_amount = round(last - float(s.iloc[i]), 3)
                        last_change_date = s.index[i + 1].strftime("%Y-%m-%d")
                        last_change = "利上げ" if last_change_amount > 0 else "利下げ"
                        break

                entry.update({
                    "rate_value":         round(last, 3),
                    "rate_asof":          last_date.strftime("%Y-%m-%d"),
                    "rate_3m_change":     round(last - prev_3m, 3) if prev_3m is not None else None,
                    "last_change":        last_change,
                    "last_change_amount": last_change_amount,
                    "last_change_date":   last_change_date,
                })
                print(f"[OK]  {cb['code']:5s} {cb['rate_name']:20s} {last:>6.3f}%  asOf {last_date.date()}")
            else:
                print(f"[WARN] {cb['code']}: no rate data")
                entry["rate_value"] = None
        else:
            entry["rate_value"] = None

        out.append(entry)

    payload = {
        "generatedAt":   now.isoformat(),
        "central_banks": out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: {len(out)} central banks")


if __name__ == "__main__":
    main()
