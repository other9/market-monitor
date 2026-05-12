"""
scripts/common.py — 共通ユーティリティ

v13.0 で新設。FRED API 呼び出し、yfinance の MultiIndex 列吸収、
ログ書式の統一、日付・タイムゾーン処理を集約する。

設計指針:
  - 既存スクリプトの動作を変えないこと (= 既存の fetch_*.py から呼ばれてもよい
    し、v13.0 時点では呼ばれていなくてもよい。 v13.1 以降で順次リファクタする)
  - print のフォーマット ([OK]/[WARN]/[SKIP]) は既存スクリプトの慣習を踏襲
  - 例外は呼び出し元で扱う前提 (このモジュール内で握りつぶさない)

使い方:
    from scripts.common import (
        fred_observations,
        extract_close_series,
        log_ok, log_warn, log_skip,
        jst_today_iso, utc_now_iso,
    )
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

import pandas as pd
import requests

# ─────────────────────────────────────────────────────────
# 1. FRED API client
# ─────────────────────────────────────────────────────────

FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_META_URL = "https://api.stlouisfed.org/fred/series"


def fred_observations(
    series_id: str,
    *,
    api_key: str | None = None,
    observation_start: str | date | None = None,
    observation_end: str | date | None = None,
    units: str | None = None,
    frequency: str | None = None,
    aggregation_method: str | None = None,
    limit: int | None = None,
    sort_order: str | None = None,
    timeout: int = 15,
) -> list[dict[str, Any]]:
    """FRED 系列の observations を取得して [{date, value}, ...] のリストで返す。

    Args:
        series_id:           FRED 系列ID (例: "GDP", "DGS10")
        api_key:             FRED API キー。省略時は環境変数 FRED_API_KEY を使う
        observation_start:   "YYYY-MM-DD" or date (省略可)
        observation_end:     "YYYY-MM-DD" or date (省略可)
        units:               "lin" (default), "chg", "pch", "pc1", など (省略可)
        frequency:           "d", "w", "m", "q", "a" (省略可、ネイティブ頻度を使う)
        aggregation_method:  "avg" (default), "sum", "eop"
        limit:               最大返却数 (省略時は FRED デフォルト 100,000)
        sort_order:          "asc" (default) or "desc"
        timeout:             HTTP timeout 秒

    Returns:
        [{"date": "YYYY-MM-DD", "value": float | None}, ...]
        値が "." (FRED の N/A) の場合は None を入れる。

    Raises:
        ValueError:    api_key が見つからない場合
        requests.HTTPError: FRED API がエラーを返した場合
    """
    key = api_key or os.environ.get("FRED_API_KEY")
    if not key:
        raise ValueError("FRED_API_KEY が指定されておらず、環境変数にも存在しません")

    params: dict[str, Any] = {
        "series_id": series_id,
        "api_key": key,
        "file_type": "json",
    }
    if observation_start is not None:
        params["observation_start"] = str(observation_start)
    if observation_end is not None:
        params["observation_end"] = str(observation_end)
    if units is not None:
        params["units"] = units
    if frequency is not None:
        params["frequency"] = frequency
    if aggregation_method is not None:
        params["aggregation_method"] = aggregation_method
    if limit is not None:
        params["limit"] = str(limit)
    if sort_order is not None:
        params["sort_order"] = sort_order

    r = requests.get(FRED_BASE_URL, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()

    out: list[dict[str, Any]] = []
    for obs in data.get("observations", []):
        v_raw = obs.get("value", ".")
        try:
            v = None if v_raw in (".", "", None) else float(v_raw)
        except (TypeError, ValueError):
            v = None
        out.append({"date": obs.get("date"), "value": v})
    return out


def fred_latest_value(series_id: str, **kwargs: Any) -> tuple[str | None, float | None]:
    """FRED 系列の最新値 (None でない最後の値) を (date, value) で返す。"""
    obs = fred_observations(series_id, **kwargs)
    for row in reversed(obs):
        if row["value"] is not None:
            return row["date"], row["value"]
    return None, None


# ─────────────────────────────────────────────────────────
# 2. yfinance helper
# ─────────────────────────────────────────────────────────


def extract_close_series(df: pd.DataFrame) -> pd.Series:
    """yfinance の DataFrame から Close Series を取り出す (MultiIndex 対応)。

    yfinance は単一ティッカーでも .download() の auto_adjust や group_by の組み合
    わせで MultiIndex 列を返すことがあり、その吸収を担う。
    """
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
        # v13.4.1: pandas-stubs は df["Close"] を Series と型推論するが、yfinance の
        # MultiIndex ケースでは DataFrame が返ることがある (test_close_column_with_dataframe_value
        # でカバー済)。runtime 防御として残し、mypy には unreachable を抑制させる。
        if isinstance(s, pd.DataFrame):  # type: ignore[unreachable]
            return s.iloc[:, 0].dropna() if s.shape[1] > 0 else pd.Series(dtype="float64")  # type: ignore[unreachable]
        return s.dropna()

    # OHLC 形式のフォールバック (Close は 4 列目)
    if df.shape[1] >= 4:
        return df.iloc[:, 3].dropna()
    return pd.Series(dtype="float64")


# ─────────────────────────────────────────────────────────
# 3. 共通ロガー (既存の [OK]/[WARN]/[SKIP] 慣習を踏襲)
# ─────────────────────────────────────────────────────────


def log_ok(msg: str) -> None:
    """成功ログ。stdout に "[OK]   ..." 形式で出力。"""
    print(f"[OK]   {msg}")


def log_warn(msg: str) -> None:
    """警告ログ。stderr に "[WARN] ..." 形式で出力。"""
    print(f"[WARN] {msg}", file=sys.stderr)


def log_skip(msg: str) -> None:
    """スキップログ。stdout に "[SKIP] ..." 形式で出力。"""
    print(f"[SKIP] {msg}")


def log_info(msg: str) -> None:
    """情報ログ。stdout に "[INFO] ..." 形式で出力。"""
    print(f"[INFO] {msg}")


# ─────────────────────────────────────────────────────────
# 4. 日付・タイムゾーン処理
# ─────────────────────────────────────────────────────────

JST = timezone(timedelta(hours=9))


def jst_today_iso() -> str:
    """JST 基準の今日の日付を 'YYYY-MM-DD' 文字列で返す。

    archive ディレクトリ名や cadence 判定に使用。
    """
    return datetime.now(JST).strftime("%Y-%m-%d")


def jst_now() -> datetime:
    """JST タイムゾーン付きの datetime を返す。"""
    return datetime.now(JST)


def utc_now_iso() -> str:
    """UTC タイムゾーン付きの ISO 8601 文字列。

    data/*.json の generatedAt フィールドで使用。
    """
    return datetime.now(UTC).isoformat()


def utc_now() -> datetime:
    """UTC タイムゾーン付きの datetime を返す。"""
    return datetime.now(UTC)


# ─────────────────────────────────────────────────────────
# 5. 簡易バージョン情報
# ─────────────────────────────────────────────────────────

__version__ = "0.1.0"  # v13.0 で導入
