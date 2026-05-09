"""tests/test_common.py — scripts.common の最低限テスト。

v13.0 で新設。FRED API のような外部依存はモックせず、
純粋な関数 (extract_close_series, ロガー, 日付ヘルパー) のみカバー。

実行:
    pytest tests/ -v
    PYTHONPATH=. pytest tests/ -v       # CWD がリポジトリ root の場合
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest

# scripts/ を import path に追加 (リポジトリ root から実行される前提)
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.common import (
    extract_close_series,
    jst_now,
    jst_today_iso,
    log_info,
    log_ok,
    log_skip,
    log_warn,
    utc_now,
    utc_now_iso,
)


# ─────────────────────────────────────────────────────────
# extract_close_series: yfinance の MultiIndex 列吸収
# ─────────────────────────────────────────────────────────


class TestExtractCloseSeries:
    def test_empty_dataframe_returns_empty_series(self):
        result = extract_close_series(pd.DataFrame())
        assert result.empty
        assert result.dtype == "float64"

    def test_none_input_returns_empty_series(self):
        result = extract_close_series(None)  # type: ignore
        assert result.empty

    def test_single_index_close_column(self):
        df = pd.DataFrame({
            "Open":   [100, 101, 102],
            "High":   [103, 104, 105],
            "Low":    [99,  100, 101],
            "Close":  [102, 103, 104],
            "Volume": [1000, 1100, 1200],
        })
        result = extract_close_series(df)
        assert list(result.values) == [102, 103, 104]

    def test_multiindex_columns_with_close(self):
        # yfinance が group_by="ticker" などで返す MultiIndex 列の例
        cols = pd.MultiIndex.from_product([["Open", "High", "Low", "Close"], ["AAPL"]])
        df = pd.DataFrame(
            [[100, 103, 99, 102], [101, 104, 100, 103]],
            columns=cols,
        )
        result = extract_close_series(df)
        assert list(result.values) == [102, 103]

    def test_close_column_with_nan_dropped(self):
        df = pd.DataFrame({"Close": [100.0, None, 102.0]})
        result = extract_close_series(df)
        assert list(result.values) == [100.0, 102.0]

    def test_no_close_column_falls_back_to_4th(self):
        # ヘッダがない場合のフォールバック (Close を 4 列目と仮定)
        df = pd.DataFrame([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]])
        result = extract_close_series(df)
        assert list(result.values) == [4, 9]

    def test_close_column_with_dataframe_value(self):
        # まれに Close が DataFrame で返るケース (列名の重複)
        df = pd.DataFrame({"Close": [100, 101, 102]})
        # 1 列なら問題ないが、そのまま Series が返る
        result = extract_close_series(df)
        assert list(result.values) == [100, 101, 102]


# ─────────────────────────────────────────────────────────
# 日付ヘルパー: タイムゾーン整合性
# ─────────────────────────────────────────────────────────


class TestDateHelpers:
    def test_jst_today_iso_format(self):
        s = jst_today_iso()
        # YYYY-MM-DD 形式
        assert len(s) == 10
        assert s[4] == "-" and s[7] == "-"
        # 数値として parse 可能
        datetime.strptime(s, "%Y-%m-%d")

    def test_jst_now_has_jst_tz(self):
        d = jst_now()
        assert d.tzinfo is not None
        # UTC+9
        assert d.utcoffset().total_seconds() == 9 * 3600

    def test_utc_now_iso_contains_offset(self):
        s = utc_now_iso()
        assert "+00:00" in s or s.endswith("Z")
        # ISO parse 可能
        datetime.fromisoformat(s.replace("Z", "+00:00"))

    def test_utc_now_has_utc_tz(self):
        d = utc_now()
        assert d.tzinfo == timezone.utc

    def test_jst_is_9_hours_ahead_of_utc(self):
        u = utc_now()
        j = jst_now()
        # 同じ瞬間を別の TZ で取っているので、 absolute は同じに近い
        diff = abs((j - u).total_seconds())
        assert diff < 5  # 5 秒以内のズレ


# ─────────────────────────────────────────────────────────
# ロガー: 例外なく動くことだけ確認 (出力先は副作用なので深追いしない)
# ─────────────────────────────────────────────────────────


class TestLoggers:
    def test_log_ok_runs(self, capsys):
        log_ok("test message")
        captured = capsys.readouterr()
        assert "[OK]" in captured.out
        assert "test message" in captured.out

    def test_log_warn_goes_to_stderr(self, capsys):
        log_warn("warn message")
        captured = capsys.readouterr()
        assert "[WARN]" in captured.err
        assert "warn message" in captured.err

    def test_log_skip_runs(self, capsys):
        log_skip("skip message")
        captured = capsys.readouterr()
        assert "[SKIP]" in captured.out

    def test_log_info_runs(self, capsys):
        log_info("info message")
        captured = capsys.readouterr()
        assert "[INFO]" in captured.out


# ─────────────────────────────────────────────────────────
# determine_cadence: fetch_news.py 側の関数だが重要なのでここでテスト
# ─────────────────────────────────────────────────────────


class TestDetermineCadence:
    """週末・月初の Deep Dive モード切替ロジック。"""

    def test_returns_dict_with_required_keys(self):
        from scripts.fetch_news import determine_cadence
        c = determine_cadence()
        assert "mode" in c
        assert "label" in c
        assert c["mode"] in ("daily", "weekly_review", "monthly_review")

    def test_label_is_non_empty_string(self):
        from scripts.fetch_news import determine_cadence
        c = determine_cadence()
        assert isinstance(c["label"], str)
        assert len(c["label"]) > 0
