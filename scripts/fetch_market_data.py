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
    # コモディティ
    {"ticker": "CL=F",    "group": "コモディティ", "name": "WTI原油",   "sub": "NY先物 $/bbl"},
    {"ticker": "BZ=F",    "group": "コモディティ", "name": "Brent原油", "sub": "北海先物 $/bbl"},
    {"ticker": "GC=F",    "group": "コモディティ", "name": "金",        "sub": "COMEX $/oz"},
    {"ticker": "BTC-USD", "group": "コモディティ", "name": "ビットコイン", "sub": "BTC/USD"},
    # ボラティリティ
    {"ticker": "^VIX",    "group": "ボラティリティ", "name": "VIX",     "sub": "恐怖指数"},
]

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
def extract_close_series(df: pd.DataFrame) -> pd.Series:
    """yfinance が返す DataFrame から Close 列を Series として取り出す。

    - 単一ティッカーでも新しい yfinance は MultiIndex カラムで返すことがある
    - その場合 df["Close"] は DataFrame (列: ticker) になる
    - どちらでも最終的に 1 次元の Series になるよう正規化する
    """
    if df is None or df.empty:
        return pd.Series(dtype="float64")

    # MultiIndex カラム (例: ("Close", "^N225")) のケース
    if isinstance(df.columns, pd.MultiIndex):
        # "Close" レベルを選ぶ
        if "Close" in df.columns.get_level_values(0):
            close_df = df.xs("Close", axis=1, level=0)
        else:
            # 最後のレベルに Close が来る形式も一応保険
            close_df = df.iloc[:, [-1]]
        # DataFrame のはず → 最初の列を Series に
        if isinstance(close_df, pd.DataFrame):
            if close_df.shape[1] == 0:
                return pd.Series(dtype="float64")
            return close_df.iloc[:, 0].dropna()
        return close_df.dropna()

    # フラットなカラムのケース
    if "Close" in df.columns:
        s = df["Close"]
        if isinstance(s, pd.DataFrame):
            # 念のため
            if s.shape[1] == 0:
                return pd.Series(dtype="float64")
            return s.iloc[:, 0].dropna()
        return s.dropna()

    # 最悪のフォールバック: 4番目の列を使う (OHLC の C)
    if df.shape[1] >= 4:
        return df.iloc[:, 3].dropna()
    return pd.Series(dtype="float64")


def pct_change(now: float, then: float, *, is_yield: bool = False) -> float | None:
    if then == 0 or pd.isna(then) or pd.isna(now):
        return None
    if is_yield:
        # 利回りは %pt 差を返す
        return round(now - then, 3)
    return round((now / then - 1) * 100, 2)


def fetch_daily(ticker: str) -> pd.DataFrame:
    return yf.download(
        ticker,
        period="2y",
        interval="1d",
        progress=False,
        auto_adjust=False,
    )


def fetch_monthly(ticker: str) -> list[dict[str, Any]]:
    df = yf.download(
        ticker,
        period="5y",
        interval="1mo",
        progress=False,
        auto_adjust=False,
    )
    close = extract_close_series(df)
    if close.empty:
        return []
    return [
        {"d": ts.strftime("%Y-%m"), "v": round(float(val), 2)}
        for ts, val in close.items()
    ]


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
            df = fetch_daily(ticker)
        except Exception as e:
            print(f"[WARN] {ticker} fetch failed: {e}")
            continue

        close = extract_close_series(df)
        if close.empty:
            print(f"[WARN] {ticker} empty after extract.")
            continue

        last_date = close.index[-1].to_pydatetime()
        last_close = float(close.iloc[-1])

        def _at(days_back: int) -> float | None:
            target = last_date - timedelta(days=days_back)
            # index の tz に合わせる
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index <= target]
            if sliced.empty:
                return None
            return float(sliced.iloc[-1])

        prev_d  = _at(1)
        prev_w  = _at(7)
        prev_m  = _at(30)
        prev_6m = _at(182)

        row = {
            "group":   inst["group"],
            "name":    inst["name"],
            "sub":     inst["sub"],
            "close":   round(last_close, 4 if last_close < 10 else 2),
            "asOf":    last_date.strftime("%Y-%m-%d"),
            "day":   pct_change(last_close, prev_d,  is_yield=is_yield) if prev_d  is not None else None,
            "week":  pct_change(last_close, prev_w,  is_yield=is_yield) if prev_w  is not None else None,
            "month": pct_change(last_close, prev_m,  is_yield=is_yield) if prev_m  is not None else None,
            "sixM":  pct_change(last_close, prev_6m, is_yield=is_yield) if prev_6m is not None else None,
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
