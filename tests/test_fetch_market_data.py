"""tests/test_fetch_market_data.py — v13.4.2 で導入

fetch_market_data.py の統合テスト。
yfinance を mock して、ネットワーク呼び出し無しで主要パスをカバー。

設計:
  - pct_change は純関数なので mock 不要
  - fetch_daily / fetch_5y_daily は yf.download を mock
  - main() 全体は yf.download を mock + OUTPUT_PATH を tmp_path に差し替え

mock 戦略:
  yfinance.download は (date_index, columns=["Close",...]) の DataFrame を返す。
  最小サイズで Close 列だけ持つ DataFrame を返せばよい。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

# scripts/ を import path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.fetch_market_data import (  # noqa: E402 — sys.path 操作後の意図的な import
    fetch_5y_daily,
    fetch_daily,
    pct_change,
)


def _make_close_df(values: list[float], end_date: str = "2026-05-11") -> pd.DataFrame:
    """Close 列のみの DataFrame を生成 (yfinance.download の戻り値を模擬)。"""
    end = pd.Timestamp(end_date)
    idx = pd.date_range(end=end, periods=len(values), freq="B")  # 営業日
    return pd.DataFrame({"Close": values}, index=idx)


# ─────────────────────────────────────────────────────────
# pct_change (純関数)
# ─────────────────────────────────────────────────────────

class TestPctChange:
    def test_positive_change(self):
        # 100 → 110 = +10%
        assert pct_change(110.0, 100.0) == 10.0

    def test_negative_change(self):
        # 100 → 95 = -5%
        assert pct_change(95.0, 100.0) == -5.0

    def test_zero_then_returns_none(self):
        # ゼロ除算回避
        assert pct_change(100.0, 0) is None

    def test_yield_mode_returns_bp_diff(self):
        # is_yield=True は差分 (bp 風) を返す
        # 4.45 → 4.50 = +0.05
        assert pct_change(4.50, 4.45, is_yield=True) == 0.05

    def test_nan_inputs_return_none(self):
        assert pct_change(float("nan"), 100.0) is None
        assert pct_change(100.0, float("nan")) is None


# ─────────────────────────────────────────────────────────
# fetch_daily / fetch_5y_daily (yfinance mock)
# ─────────────────────────────────────────────────────────

class TestFetchDaily:
    def test_returns_dataframe_from_yfinance(self):
        """fetch_daily は yf.download を呼び出してそのまま返す。"""
        df_mock = _make_close_df([100.0, 101.0, 102.0])
        with patch("scripts.fetch_market_data.yf.download", return_value=df_mock) as m:
            result = fetch_daily("^GSPC")
        assert m.call_count == 1
        # 引数チェック
        args, kwargs = m.call_args
        assert args[0] == "^GSPC"
        assert kwargs.get("period") == "2y"
        assert kwargs.get("interval") == "1d"
        # 戻り値チェック
        assert result.equals(df_mock)


class TestFetch5yDaily:
    def test_returns_list_of_date_value_pairs(self):
        df_mock = _make_close_df([100.0, 101.5, 102.3])
        with patch("scripts.fetch_market_data.yf.download", return_value=df_mock):
            result = fetch_5y_daily("^N225")
        assert isinstance(result, list)
        assert len(result) == 3
        # 各要素は {d: "YYYY-MM-DD", v: float} の dict
        for entry in result:
            assert set(entry.keys()) == {"d", "v"}
            assert len(entry["d"]) == 10  # YYYY-MM-DD
            assert isinstance(entry["v"], float)

    def test_empty_dataframe_returns_empty_list(self):
        with patch("scripts.fetch_market_data.yf.download", return_value=pd.DataFrame()):
            assert fetch_5y_daily("INVALID") == []


# ─────────────────────────────────────────────────────────
# main() e2e (yfinance mock + OUTPUT_PATH 差し替え)
# ─────────────────────────────────────────────────────────

class TestMainE2E:
    def test_main_writes_valid_json(self, tmp_path, monkeypatch):
        """main() が data/market.json を正しい schema で書く。

        全 INSTRUMENTS / SECTORS / CHART_TICKERS に対して同じ mock DF を返す。
        OUTPUT_PATH を tmp_path に差し替えて実 data/ を汚さない。
        """
        # OUTPUT_PATH を tmp_path 内に差し替え
        out_path = tmp_path / "market.json"
        monkeypatch.setattr("scripts.fetch_market_data.OUTPUT_PATH", out_path)

        # yf.download mock: 全 ticker に対して同じ Close DataFrame
        df_mock = _make_close_df([100.0, 101.0, 102.0, 103.0, 104.0])

        with patch("scripts.fetch_market_data.yf.download", return_value=df_mock):
            from scripts.fetch_market_data import main
            main()

        # JSON 検証
        assert out_path.exists()
        payload = json.loads(out_path.read_text(encoding="utf-8"))

        # 最低限の schema チェック
        assert "generatedAt" in payload
        assert "indices" in payload
        assert "history" in payload
        assert "sectors" in payload

        # indices の各行は必須キーを持つ
        assert len(payload["indices"]) > 0
        for row in payload["indices"]:
            assert {"group", "name", "sub", "close", "asOf", "day", "week", "month", "sixM"} <= row.keys()
            assert isinstance(row["close"], (int, float))
            assert row["asOf"]  # 非空

        # generatedAt は ISO 8601 形式
        # (utc_now_iso() の戻り値)
        datetime.fromisoformat(payload["generatedAt"].replace("Z", "+00:00"))
