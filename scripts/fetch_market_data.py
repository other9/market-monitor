"""
fetch_market_data.py
yfinance で 16 指標の終値・1D / 1W / 1M / 6M リターン・5年月次履歴を取得し、
data/market.json に書き出す。

GitHub Actions で毎朝7時(JST)に実行される想定。
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf


# ─────────────────────────────────────────────────────────
# 1. 取得する銘柄
#    yfinance のティッカー、表示名、グループ、説明、利回り扱いか
# ─────────────────────────────────────────────────────────
INSTRUMENTS: list[dict[str, Any]] = [
    # 株式
    {"ticker": "^N225",   "group": "株式",   "name": "日経平均",       "sub": "Nikkei 225 · 東証"},
    {"ticker": "^TOPX",   "group": "株式",   "name": "TOPIX",         "sub": "東証株価指数"},
    {"ticker": "^GSPC",   "group": "株式",   "name": "S&P 500",       "sub": "米国 500大企業"},
    {"ticker": "^IXIC",   "group": "株式",   "name": "NASDAQ",        "sub": "米ハイテク総合"},
    {"ticker": "^DJI",    "group": "株式",   "name": "Dow Jones",     "sub": "米ダウ30種"},
    {"ticker": "^RUT",    "group": "株式",   "name": "Russell 2000",  "sub": "米小型株"},
    # 為替
    {"ticker": "JPY=X",   "group": "為替",   "name": "USD/JPY",       "sub": "ドル円"},
    {"ticker": "EURJPY=X","group": "為替",   "name": "EUR/JPY",       "sub": "ユーロ円"},
    {"ticker": "EURUSD=X","group": "為替",   "name": "EUR/USD",       "sub": "ユーロドル"},
    # 金利
    {"ticker": "^TNX",    "group": "金利",   "name": "米10年債",      "sub": "利回り",        "unit": "%", "is_yield": True},
    # 日10年債は yfinance に安定したシンボルがないので、
    # 簡易的に Investing.com 由来の参考値を使う場合は別途RSS化するか手動更新。
    # ここでは省略 (必要なら別途データソース追加)。
    # コモディティ
    {"ticker": "CL=F",    "group": "コモディティ", "name": "WTI原油",   "sub": "NY先物 $/bbl"},
    {"ticker": "BZ=F",    "group": "コモディティ", "name": "Brent原油", "sub": "北海先物 $/bbl"},
    {"ticker": "GC=F",    "group": "コモディティ", "name": "金",        "sub": "COMEX $/oz"},
    {"ticker": "BTC-USD", "group": "コモディティ", "name": "ビットコイン", "sub": "BTC/USD"},
    # ボラティリティ
    {"ticker": "^VIX",    "group": "ボラティリティ", "name": "VIX",     "sub": "恐怖指数"},
]

# 5年チャート用 (キー -> ティッカー)
CHART_TICKERS = {
    "nikkei":  "^N225",
    "sp500":   "^GSPC",
    "usdjpy":  "JPY=X",
    "us10y":   "^TNX",
    "wti":     "CL=F",
    "gold":    "GC=F",
}

OUTPUT_PATH = Path("data/market.json")


# ─────────────────────────────────────────────────────────
# 2. ヘルパー関数
# ─────────────────────────────────────────────────────────
def pct_change(now: float, then: float, *, is_yield: bool = False) -> float | None:
    """利回りは bp 差分風 (% pt change) ではなく、ベース変化率を返す。
    ※ 利回りは通常絶対変化(bp)で表示する流儀もあるが、ここでは率で統一。
    """
    if then == 0 or pd.isna(then) or pd.isna(now):
        return None
    if is_yield:
        # 利回りは「%pt差」を返す方が直感的
        return round(now - then, 3)
    return round((now / then - 1) * 100, 2)


def get_close_at_or_before(history: pd.DataFrame, target_date: datetime) -> tuple[float, datetime] | None:
    """指定日以前で最も近い営業日の終値を返す。"""
    # tz-aware にそろえる
    if history.index.tz is not None:
        target_date = target_date.replace(tzinfo=history.index.tz)
    sliced = history.loc[history.index <= target_date]
    if sliced.empty:
        return None
    last = sliced.iloc[-1]
    return float(last["Close"]), sliced.index[-1].to_pydatetime()


def fetch_one(ticker: str) -> pd.DataFrame:
    """6ヶ月+1ヶ月のバッファを持って日次データを取得。"""
    return yf.download(
        ticker,
        period="2y",          # 6ヶ月比較に余裕を持って2年取る
        interval="1d",
        progress=False,
        auto_adjust=False,
    )


def fetch_monthly(ticker: str) -> list[dict[str, Any]]:
    """5年月次データを返す。"""
    df = yf.download(
        ticker,
        period="5y",
        interval="1mo",
        progress=False,
        auto_adjust=False,
    )
    if df.empty:
        return []
    # マルチカラムだった場合の対応
    close_col = df["Close"] if "Close" in df.columns else df.iloc[:, 3]
    out = []
    for ts, val in close_col.dropna().items():
        out.append({"d": ts.strftime("%Y-%m"), "v": round(float(val), 2)})
    return out


# ─────────────────────────────────────────────────────────
# 3. メイン
# ─────────────────────────────────────────────────────────
def main() -> None:
    today = datetime.now(timezone.utc)

    indices_out: list[dict[str, Any]] = []

    for inst in INSTRUMENTS:
        ticker = inst["ticker"]
        is_yield = inst.get("is_yield", False)

        try:
            df = fetch_one(ticker)
        except Exception as e:
            print(f"[WARN] {ticker} fetch failed: {e}")
            continue

        if df.empty:
            print(f"[WARN] {ticker} empty.")
            continue

        # 終値シリーズ
        if "Close" in df.columns:
            close = df["Close"]
        else:
            close = df.iloc[:, 3]
        close = close.dropna()
        if close.empty:
            continue

        last_date = close.index[-1].to_pydatetime()
        last_close = float(close.iloc[-1])

        # 各期間の参照終値
        def _at(days_back: int) -> float | None:
            target = last_date - timedelta(days=days_back)
            sliced = close.loc[close.index <= target]
            if sliced.empty:
                return None
            return float(sliced.iloc[-1])

        prev_d = _at(1)
        prev_w = _at(7)
        prev_m = _at(30)
        prev_6m = _at(182)

        row = {
            "group":   inst["group"],
            "name":    inst["name"],
            "sub":     inst["sub"],
            "close":   round(last_close, 4 if last_close < 10 else 2),
            "asOf":    last_date.strftime("%Y-%m-%d"),
            "day":   pct_change(last_close, prev_d,  is_yield=is_yield) if prev_d  else None,
            "week":  pct_change(last_close, prev_w,  is_yield=is_yield) if prev_w  else None,
            "month": pct_change(last_close, prev_m,  is_yield=is_yield) if prev_m  else None,
            "sixM":  pct_change(last_close, prev_6m, is_yield=is_yield) if prev_6m else None,
        }
        if "unit" in inst:
            row["unit"] = inst["unit"]
        if is_yield:
            row["isYield"] = True

        indices_out.append(row)
        print(f"[OK]  {ticker:12s} {last_close:>12.2f}  (asOf {last_date.date()})")

    # 5年月次チャート
    history_out: dict[str, list[dict[str, Any]]] = {}
    for key, ticker in CHART_TICKERS.items():
        try:
            history_out[key] = fetch_monthly(ticker)
            print(f"[OK]  history/{key} {len(history_out[key])} points")
        except Exception as e:
            print(f"[WARN] history {ticker} failed: {e}")
            history_out[key] = []

    payload = {
        "generatedAt": today.isoformat(),
        "indices":     indices_out,
        "history":     history_out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH} ({len(indices_out)} instruments).")


if __name__ == "__main__":
    main()
