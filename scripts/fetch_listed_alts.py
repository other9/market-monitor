"""
fetch_listed_alts.py  (v13.3 — common.py 利用)
オルタナティブ資産の上場プロキシ ETF を yfinance で取得し、
data/listed_alts.json に書き出す。

PE / PD / インフラ / 不動産 (米・日) を一覧で見れる「日次プロキシ・ボード」を提供。
非上場アセットの解説 (Alternatives Spotlight) を数値で補強する役割。

各銘柄について:
  - 終値・1D / 1W / 1M / 3M / YTD リターン
  - 1年日次データ (スパークライン用)

カテゴリ別に並べる:
  Listed PE  : PSP
  BDC (PD)   : BIZD
  Infra      : IFRA, NFRA
  US REIT    : VNQ
  J-REIT     : 1343.T
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf

# v13.3: common.py を使う
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.common import extract_close_series, log_info, log_ok, log_warn, utc_now_iso

OUTPUT_PATH = Path("data/listed_alts.json")


# 表示順序がそのままダッシュボードの並び。
LISTED_ALTS: list[dict[str, str]] = [
    {"category": "Listed PE",  "ticker": "PSP",     "name": "Invesco Listed PE",   "sub": "上場PE株バスケット",         "desc": "Apollo, KKR, Brookfield 等の GP 株。プライベート市場のセンチメント・プロキシ"},
    {"category": "BDC (PD)",   "ticker": "BIZD",    "name": "VanEck BDC",          "sub": "米国 BDC ETF",            "desc": "ダイレクト・レンディング上場プロキシ。PD ファンドの絶対リターンと相関"},
    {"category": "Infra",      "ticker": "IFRA",    "name": "iShares US Infra",    "sub": "米国インフラ",            "desc": "電力・水・輸送インフラ株。利回り低下・財政出動局面で追い風"},
    {"category": "Infra",      "ticker": "NFRA",    "name": "FlexShares Global Infra", "sub": "グローバル·インフラ",     "desc": "OECD インフラ株のグローバル・ポートフォリオ"},
    {"category": "US REIT",    "ticker": "VNQ",     "name": "Vanguard Real Estate","sub": "米REIT全体",             "desc": "米 REIT ベンチマーク。利回り敏感、商業不動産価格と連動"},
    {"category": "J-REIT",     "ticker": "1343.T",  "name": "NEXT FUNDS J-REIT",   "sub": "東証REIT指数",           "desc": "日本 REIT 指数 ETF。日本円ベースの不動産プロキシ"},
]


# v13.3: extract_close_series は scripts/common.py から import 済み

def pct_change(now: float, then: float) -> float | None:
    if then is None or then == 0 or pd.isna(then) or pd.isna(now):
        return None
    return round((now / then - 1) * 100, 2)


def main() -> None:
    today = datetime.now(UTC)
    year_start = datetime(today.year, 1, 1)

    out: list[dict[str, Any]] = []

    for asset in LISTED_ALTS:
        ticker = asset["ticker"]
        try:
            df = yf.download(ticker, period="1y", interval="1d",
                             progress=False, auto_adjust=False)
        except Exception as e:
            log_warn(f"{ticker} fetch failed: {e}")
            continue

        close = extract_close_series(df)
        if close.empty or len(close) < 5:
            log_warn(f"{ticker} empty.")
            continue

        last_date = close.index[-1].to_pydatetime()
        last_close = float(close.iloc[-1])

        # v13.4.1: ループ変数 (close, last_date) を default-arg binding で明示的に束縛
        # することで Ruff B023 (function-uses-loop-variable) を回避する。
        # 動作はループ内で即時消費されるため従来と完全に同一。
        def _at(days_back: int, *, close=close, last_date=last_date) -> float | None:
            target = last_date - timedelta(days=days_back)
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index <= target]
            return float(sliced.iloc[-1]) if not sliced.empty else None

        def _at_date(target: datetime, *, close=close) -> float | None:
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index >= target]
            return float(sliced.iloc[0]) if not sliced.empty else None

        ytd_start_val = _at_date(year_start)

        # 1年日次の軽量履歴 (スパークライン用、最大 252 ポイント)
        history = [
            {"d": ts.strftime("%Y-%m-%d"), "v": round(float(v), 2)}
            for ts, v in close.items()
        ]

        entry = {
            "category": asset["category"],
            "ticker":   ticker,
            "name":     asset["name"],
            "sub":      asset["sub"],
            "desc":     asset["desc"],
            "close":    round(last_close, 2),
            "asOf":     last_date.strftime("%Y-%m-%d"),
            "day":      pct_change(last_close, _at(1)),
            "week":     pct_change(last_close, _at(7)),
            "month":    pct_change(last_close, _at(30)),
            "threeM":   pct_change(last_close, _at(91)),
            "ytd":      pct_change(last_close, ytd_start_val) if ytd_start_val else None,
            "history":  history,
        }
        out.append(entry)
        log_ok(f"{ticker:8s} {last_close:>9.2f}  1D={entry['day']}  YTD={entry['ytd']}")

    payload = {
        "generatedAt": utc_now_iso(),
        "assets":      out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log_info(f"Wrote {OUTPUT_PATH}: {len(out)} listed alt proxies")


if __name__ == "__main__":
    main()
