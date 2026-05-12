"""
fetch_central_banks.py  (v13.3 — common.py 利用)
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
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

# v13.3: common.py を使う
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.common import fred_observations, log_info, log_ok, log_warn, utc_now_iso

OUTPUT_PATH = Path("data/central_banks.json")


# ─────────────────────────────────────────────────────────
# 中央銀行リスト (常設 + ローテ候補)
# code: Claude が日替わり選定で使う識別子
# ─────────────────────────────────────────────────────────
CENTRAL_BANKS: list[dict[str, Any]] = [
    # ── 常設 ──
    {"code": "FED",   "name": "FRB (米連邦準備理事会)",       "country": "米国",      "always_show": True,
     "rate_id": "DFEDTARU",
     "rate_name": "FF金利(上限)",
     "next_meeting_hint": "FOMC は約6週間ごと"},

    {"code": "ECB",   "name": "ECB (欧州中央銀行)",            "country": "ユーロ圏",  "always_show": True,
     "rate_id": "ECBDFR",
     "rate_name": "預金ファシリティ金利",
     "next_meeting_hint": "ECB理事会は約6週間ごと"},

    {"code": "BOJ",   "name": "BOJ (日本銀行)",                "country": "日本",      "always_show": True,
     "rate_id": "IRSTCB01JPM156N",
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
     "rate_name": "SNB政策金利",
     "next_meeting_hint": "四半期に1回"},

    {"code": "RBA",   "name": "RBA (豪準備銀行)",              "country": "オーストラリア","always_show": False,
     "rate_id": "IRSTCB01AUM156N",
     "rate_name": "キャッシュレート目標",
     "next_meeting_hint": "ほぼ毎月"},

    {"code": "RBNZ",  "name": "RBNZ (NZ準備銀行)",             "country": "ニュージーランド","always_show": False,
     "rate_id": "IRSTCB01NZM156N",
     "rate_name": "OCR (Official Cash Rate)",
     "next_meeting_hint": "年7回"},
]


def fetch_fred(series_id: str, api_key: str, years: int = 2) -> pd.Series:
    """v13.3: common.fred_observations の薄いラッパ (戻り値 pd.Series 維持)。"""
    try:
        obs = fred_observations(
            series_id,
            api_key=api_key,
            observation_start=(datetime.now() - pd.DateOffset(years=years)).strftime("%Y-%m-%d"),
        )
    except Exception as e:
        log_warn(f"FRED {series_id}: {e}")
        return pd.Series(dtype="float64")
    pairs = [(pd.Timestamp(o["date"]), o["value"])
             for o in obs if o["value"] is not None]
    if not pairs:
        return pd.Series(dtype="float64")
    return pd.Series(dict(pairs)).sort_index().dropna()


def main() -> None:
    api_key = os.environ.get("FRED_API_KEY", "")
    out: list[dict[str, Any]] = []

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

                target_3m = last_date - pd.Timedelta(days=95)
                sliced = s.loc[s.index <= target_3m]
                prev_3m = float(sliced.iloc[-1]) if not sliced.empty else None

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
                log_ok(f"{cb['code']:5s} {cb['rate_name']:20s} {last:>6.3f}%  asOf {last_date.date()}")
            else:
                log_warn(f"{cb['code']}: no rate data")
                entry["rate_value"] = None
        else:
            entry["rate_value"] = None

        out.append(entry)

    payload = {
        "generatedAt":   utc_now_iso(),
        "central_banks": out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log_info(f"Wrote {OUTPUT_PATH}: {len(out)} central banks")


if __name__ == "__main__":
    main()
