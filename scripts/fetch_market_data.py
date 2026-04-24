"""
fetch_market_data.py  (v3)
yfinance で以下を取得し data/market.json に書き出す。

- INSTRUMENTS: 16 指標の終値・1D / 1W / 1M / 6M リターン
- HISTORY: 6 指標の 5 年日次 (ダウンサンプルせず全期間保存)
- SECTORS: 米セクター ETF 11本の 1D / 1W / 1M / YTD リターン (ヒートマップ用)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf


# ─── メイン指標 ───
INSTRUMENTS: list[dict[str, Any]] = [
    {"ticker": "^N225",   "group": "株式",       "name": "日経平均",       "sub": "Nikkei 225 · 東証"},
    {"ticker": "^TOPX",   "group": "株式",       "name": "TOPIX",         "sub": "東証株価指数"},
    {"ticker": "^GSPC",   "group": "株式",       "name": "S&P 500",       "sub": "米国 500大企業"},
    {"ticker": "^IXIC",   "group": "株式",       "name": "NASDAQ",        "sub": "米ハイテク総合"},
    {"ticker": "^DJI",    "group": "株式",       "name": "Dow Jones",     "sub": "米ダウ30種"},
    {"ticker": "^RUT",    "group": "株式",       "name": "Russell 2000",  "sub": "米小型株"},
    {"ticker": "JPY=X",   "group": "為替",       "name": "USD/JPY",       "sub": "ドル円"},
    {"ticker": "EURJPY=X","group": "為替",       "name": "EUR/JPY",       "sub": "ユーロ円"},
    {"ticker": "EURUSD=X","group": "為替",       "name": "EUR/USD",       "sub": "ユーロドル"},
    {"ticker": "^TNX",    "group": "金利",       "name": "米10年債",      "sub": "利回り", "unit": "%", "is_yield": True},
    {"ticker": "CL=F",    "group": "コモディティ","name": "WTI原油",        "sub": "NY先物 $/bbl"},
    {"ticker": "BZ=F",    "group": "コモディティ","name": "Brent原油",      "sub": "北海先物 $/bbl"},
    {"ticker": "GC=F",    "group": "コモディティ","name": "金",             "sub": "COMEX $/oz"},
    {"ticker": "BTC-USD", "group": "コモディティ","name": "ビットコイン",    "sub": "BTC/USD"},
    {"ticker": "^VIX",    "group": "ボラティリティ","name": "VIX",          "sub": "恐怖指数"},
]

# ─── 5年チャート (日次で保存) ───
CHART_TICKERS = {
    "nikkei":  "^N225",
    "sp500":   "^GSPC",
    "usdjpy":  "JPY=X",
    "us10y":   "^TNX",
    "wti":     "CL=F",
    "gold":    "GC=F",
}

# ─── セクターヒートマップ (SPDRセクターETF 11本) ───
SECTORS: list[dict[str, str]] = [
    {"ticker": "XLK",  "name": "Technology",         "short": "IT"},
    {"ticker": "XLC",  "name": "Communication",      "short": "通信"},
    {"ticker": "XLY",  "name": "Cons. Discretionary","short": "消費関連"},
    {"ticker": "XLP",  "name": "Cons. Staples",      "short": "生活必需品"},
    {"ticker": "XLE",  "name": "Energy",             "short": "エネルギー"},
    {"ticker": "XLF",  "name": "Financials",         "short": "金融"},
    {"ticker": "XLV",  "name": "Health Care",        "short": "ヘルスケア"},
    {"ticker": "XLI",  "name": "Industrials",        "short": "資本財"},
    {"ticker": "XLB",  "name": "Materials",          "short": "素材"},
    {"ticker": "XLRE", "name": "Real Estate",        "short": "不動産"},
    {"ticker": "XLU",  "name": "Utilities",          "short": "公益"},
]

OUTPUT_PATH = Path("data/market.json")


def extract_close_series(df: pd.DataFrame) -> pd.Series:
    """yfinance の DataFrame から Close Series を取り出す (MultiIndex 対応)。"""
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

    if df.shape[1] >= 4:
        return df.iloc[:, 3].dropna()
    return pd.Series(dtype="float64")


def pct_change(now: float, then: float, *, is_yield: bool = False) -> float | None:
    if then == 0 or pd.isna(then) or pd.isna(now):
        return None
    if is_yield:
        return round(now - then, 3)
    return round((now / then - 1) * 100, 2)


def fetch_daily(ticker: str, period: str = "2y") -> pd.DataFrame:
    return yf.download(ticker, period=period, interval="1d",
                       progress=False, auto_adjust=False)


def fetch_5y_daily(ticker: str) -> list[dict[str, Any]]:
    """5 年日次データ (営業日のみ) を返す。"""
    df = yf.download(ticker, period="5y", interval="1d",
                     progress=False, auto_adjust=False)
    close = extract_close_series(df)
    if close.empty:
        return []
    return [
        {"d": ts.strftime("%Y-%m-%d"), "v": round(float(v), 2)}
        for ts, v in close.items()
    ]


def main() -> None:
    today = datetime.now(timezone.utc)

    # ── メイン指標 ──
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
            print(f"[WARN] {ticker} empty.")
            continue

        last_date = close.index[-1].to_pydatetime()
        last_close = float(close.iloc[-1])

        def _at(days_back: int) -> float | None:
            target = last_date - timedelta(days=days_back)
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index <= target]
            if sliced.empty:
                return None
            return float(sliced.iloc[-1])

        row = {
            "group":  inst["group"],
            "name":   inst["name"],
            "sub":    inst["sub"],
            "close":  round(last_close, 4 if last_close < 10 else 2),
            "asOf":   last_date.strftime("%Y-%m-%d"),
            "day":    pct_change(last_close, _at(1),   is_yield=is_yield),
            "week":   pct_change(last_close, _at(7),   is_yield=is_yield),
            "month":  pct_change(last_close, _at(30),  is_yield=is_yield),
            "sixM":   pct_change(last_close, _at(182), is_yield=is_yield),
        }
        if "unit" in inst:
            row["unit"] = inst["unit"]
        if is_yield:
            row["isYield"] = True

        indices_out.append(row)
        print(f"[OK]  {ticker:12s} {last_close:>12.2f}  (asOf {last_date.date()})")

    # ── 5年チャート (日次) ──
    history_out: dict[str, list[dict[str, Any]]] = {}
    for key, ticker in CHART_TICKERS.items():
        try:
            history_out[key] = fetch_5y_daily(ticker)
            print(f"[OK]  history/{key:10s} {len(history_out[key]):>4d} points (daily)")
        except Exception as e:
            print(f"[WARN] history {ticker} failed: {e}")
            history_out[key] = []

    # ── セクター ETF (ヒートマップ用) ──
    sectors_out: list[dict[str, Any]] = []
    year_start = datetime(today.year, 1, 1)

    for sec in SECTORS:
        try:
            df = fetch_daily(sec["ticker"])
        except Exception as e:
            print(f"[WARN] sector {sec['ticker']}: {e}")
            continue

        close = extract_close_series(df)
        if close.empty or len(close) < 5:
            continue

        last_date  = close.index[-1].to_pydatetime()
        last_close = float(close.iloc[-1])

        def _at(days_back: int) -> float | None:
            target = last_date - timedelta(days=days_back)
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index <= target]
            return float(sliced.iloc[-1]) if not sliced.empty else None

        def _at_date(target: datetime) -> float | None:
            if close.index.tz is not None and target.tzinfo is None:
                target = target.replace(tzinfo=close.index.tz)
            sliced = close.loc[close.index >= target]
            return float(sliced.iloc[0]) if not sliced.empty else None

        ytd_start_val = _at_date(year_start)

        sectors_out.append({
            "ticker": sec["ticker"],
            "name":   sec["name"],
            "short":  sec["short"],
            "close":  round(last_close, 2),
            "day":    pct_change(last_close, _at(1)),
            "week":   pct_change(last_close, _at(7)),
            "month":  pct_change(last_close, _at(30)),
            "ytd":    pct_change(last_close, ytd_start_val) if ytd_start_val else None,
            "asOf":   last_date.strftime("%Y-%m-%d"),
        })
        print(f"[OK]  sector/{sec['ticker']:5s}  1D={sectors_out[-1]['day']}")

    payload = {
        "generatedAt": today.isoformat(),
        "indices":     indices_out,
        "history":     history_out,
        "sectors":     sectors_out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH} ({len(indices_out)} instruments, "
          f"{sum(len(h) for h in history_out.values())} history points, "
          f"{len(sectors_out)} sectors).")


if __name__ == "__main__":
    main()
