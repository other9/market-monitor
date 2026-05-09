"""
fetch_valuations.py
バリュエーション指標を取得し、data/valuations.json に書き出す。

取得対象:
  1. S&P 500 配当利回り (FRED 逆計算)
  2. Shiller CAPE 比率 (multpl.com の月次CSV)
  3. Buffett Indicator (Wilshire 5000 ÷ 名目GDP)
  4. Fed Model: Earnings Yield - 10Y金利
  5. VIX / VVIX 比率 (yfinance)

各指標について:
  - 最新値
  - 1ヶ月前との差
  - 1年前との差
  - 5年中央値からの乖離
  - 5年分の月次履歴 (チャート用)
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
import yfinance as yf


OUTPUT_PATH = Path("data/valuations.json")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


# ─────────────────────────────────────────────────────────
# FRED ヘルパー
# ─────────────────────────────────────────────────────────
def fetch_fred(series_id: str, api_key: str, years: int = 10) -> pd.Series:
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


# ─────────────────────────────────────────────────────────
# yfinance ヘルパー
# ─────────────────────────────────────────────────────────
def yf_close(ticker: str, period: str = "5y", interval: str = "1mo") -> pd.Series:
    try:
        df = yf.download(ticker, period=period, interval=interval,
                         progress=False, auto_adjust=False)
    except Exception as e:
        print(f"[WARN] yf {ticker}: {e}", file=sys.stderr)
        return pd.Series(dtype="float64")

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
        return s.iloc[:, 0].dropna() if isinstance(s, pd.DataFrame) else s.dropna()

    return pd.Series(dtype="float64")


# ─────────────────────────────────────────────────────────
# Shiller CAPE (multpl.com)
# ─────────────────────────────────────────────────────────
def fetch_shiller_cape() -> pd.Series:
    """multpl.com の Shiller CAPE 月次CSVを取得。"""
    url = "https://www.multpl.com/shiller-pe/table/by-month"
    try:
        tables = pd.read_html(url)
        if not tables:
            print("[WARN] Shiller CAPE: no tables found")
            return pd.Series(dtype="float64")

        df = tables[0]
        if df.shape[1] < 2:
            return pd.Series(dtype="float64")

        df.columns = ["Date", "Value"][:len(df.columns)]
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df["Value"] = pd.to_numeric(
            df["Value"].astype(str).str.replace(r"[^\d.]", "", regex=True),
            errors="coerce",
        )
        df = df.dropna().sort_values("Date").set_index("Date")
        return df["Value"].dropna()

    except Exception as e:
        print(f"[WARN] Shiller CAPE fetch failed: {e}", file=sys.stderr)
        return pd.Series(dtype="float64")


# ─────────────────────────────────────────────────────────
# メトリクス計算ヘルパー
# ─────────────────────────────────────────────────────────
def value_at_or_before(s: pd.Series, target: pd.Timestamp) -> float | None:
    sliced = s.loc[s.index <= target]
    if sliced.empty:
        return None
    return float(sliced.iloc[-1])


def make_entry(name: str, group: str, freq: str, unit: str, desc: str,
               series: pd.Series, decimals: int = 2) -> dict[str, Any] | None:
    if series.empty:
        return None

    last = float(series.iloc[-1])
    last_date = series.index[-1]

    one_month_ago = last_date - pd.Timedelta(days=35)
    one_year_ago  = last_date - pd.Timedelta(days=370)
    five_y_ago    = last_date - pd.Timedelta(days=365 * 5)

    prev_m = value_at_or_before(series, one_month_ago)
    prev_y = value_at_or_before(series, one_year_ago)

    s_5y = series.loc[series.index >= five_y_ago]
    median_5y = float(s_5y.median()) if not s_5y.empty else None
    deviation = round(last - median_5y, decimals) if median_5y is not None else None

    history = []
    if not series.empty:
        try:
            monthly = series.resample("M").last().dropna()
            for ts, v in monthly.items():
                history.append({"d": ts.strftime("%Y-%m"), "v": round(float(v), decimals)})
        except Exception:
            for ts, v in series.items():
                history.append({"d": ts.strftime("%Y-%m"), "v": round(float(v), decimals)})

    return {
        "name":      name,
        "group":     group,
        "freq":      freq,
        "unit":      unit,
        "desc":      desc,
        "value":     round(last, decimals),
        "diff1m":    round(last - prev_m, decimals) if prev_m is not None else None,
        "diff1y":    round(last - prev_y, decimals) if prev_y is not None else None,
        "median5y":  round(median_5y, decimals) if median_5y is not None else None,
        "deviation": deviation,
        "asOf":      last_date.strftime("%Y-%m-%d"),
        "history":   history,
    }


# ─────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────
def main() -> None:
    fred_key = os.environ.get("FRED_API_KEY", "")
    out: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    # ── 1. S&P 500 配当利回り ──
    if fred_key:
        sp500 = fetch_fred("SP500", fred_key, years=10)
        sp500div = fetch_fred("SP500DIV", fred_key, years=10)

        if not sp500.empty and not sp500div.empty:
            sp_m  = sp500.resample("M").last()
            div_m = sp500div.resample("M").last().reindex(sp_m.index, method="ffill")
            divy = (div_m / sp_m * 100).dropna()
            entry = make_entry(
                name="S&P 500 配当利回り",
                group="米国バリュエーション",
                freq="月次",
                unit="%",
                desc="配当指数 ÷ S&P 500 値。長期平均は約2%",
                series=divy,
                decimals=2,
            )
            if entry:
                out.append(entry)
                print(f"[OK]  S&P 500 配当利回り: {entry['value']}%")

    # ── 2. Shiller CAPE ──
    cape = fetch_shiller_cape()
    if not cape.empty:
        entry = make_entry(
            name="Shiller CAPE",
            group="米国バリュエーション",
            freq="月次",
            unit="x",
            desc="景気循環調整後PER。長期平均は約17倍、30倍超は警戒",
            series=cape.tail(120),
            decimals=2,
        )
        if entry:
            out.append(entry)
            print(f"[OK]  Shiller CAPE: {entry['value']}x")

    # ── 3. Buffett Indicator (Wilshire 5000 ÷ GDP) ──
    if fred_key:
        wilshire = fetch_fred("WILL5000PRFC", fred_key, years=10)
        gdp = fetch_fred("GDP", fred_key, years=10)
        if not wilshire.empty and not gdp.empty:
            wilshire_q = wilshire.resample("Q").last()
            gdp_q = gdp.resample("Q").last().reindex(wilshire_q.index, method="ffill")
            ratio = (wilshire_q / gdp_q).dropna() * 100
            entry = make_entry(
                name="Buffett Indicator (近似)",
                group="米国バリュエーション",
                freq="四半期",
                unit="ratio",
                desc="米株時価総額/GDP相当。100超で警戒、150超で割高",
                series=ratio,
                decimals=2,
            )
            if entry:
                out.append(entry)
                print(f"[OK]  Buffett Indicator: {entry['value']}")

    # ── 4. Fed Model: Earnings Yield - 10Y ──
    if fred_key:
        try:
            pe_url = "https://www.multpl.com/s-p-500-pe-ratio/table/by-month"
            tables = pd.read_html(pe_url)
            if tables:
                pe_df = tables[0]
                pe_df.columns = ["Date", "Value"][:len(pe_df.columns)]
                pe_df["Date"] = pd.to_datetime(pe_df["Date"], errors="coerce")
                pe_df["Value"] = pd.to_numeric(
                    pe_df["Value"].astype(str).str.replace(r"[^\d.]", "", regex=True),
                    errors="coerce",
                )
                pe_series = pe_df.dropna().sort_values("Date").set_index("Date")["Value"]
                pe_series = pe_series.tail(120)

                dgs10 = fetch_fred("DGS10", fred_key, years=10)
                if not pe_series.empty and not dgs10.empty:
                    pe_m = pe_series.resample("M").last()
                    dgs10_m = dgs10.resample("M").last().reindex(pe_m.index, method="ffill")
                    earnings_yield = (1 / pe_m) * 100
                    fed_model = (earnings_yield - dgs10_m).dropna()
                    entry = make_entry(
                        name="Fed Model (E/P − 10Y金利)",
                        group="米国バリュエーション",
                        freq="月次",
                        unit="%",
                        desc="株式益回りと10年金利の差。+で株式有利、−で債券有利",
                        series=fed_model,
                        decimals=2,
                    )
                    if entry:
                        out.append(entry)
                        print(f"[OK]  Fed Model: {entry['value']}%")
        except Exception as e:
            print(f"[WARN] Fed Model calculation: {e}", file=sys.stderr)

    # ── 5. VIX / VVIX 比率 ──
    vix  = yf_close("^VIX",  period="5y", interval="1mo")
    vvix = yf_close("^VVIX", period="5y", interval="1mo")
    if not vix.empty and not vvix.empty:
        vix_aligned, vvix_aligned = vix.align(vvix, join="inner")
        ratio = (vvix_aligned / vix_aligned).dropna()
        entry = make_entry(
            name="VVIX/VIX 比率",
            group="ボラティリティ",
            freq="月次",
            unit="ratio",
            desc="ボラのボラ。3倍超で市場の不安定性が増している",
            series=ratio,
            decimals=2,
        )
        if entry:
            out.append(entry)
            print(f"[OK]  VVIX/VIX: {entry['value']}")

    payload = {
        "generatedAt": now.isoformat(),
        "indicators":  out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: {len(out)} valuation indicators.")


if __name__ == "__main__":
    main()
