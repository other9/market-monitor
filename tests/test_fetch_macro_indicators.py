"""tests/test_fetch_macro_indicators.py — v13.4.2 で導入

fetch_macro_indicators.py の統合テスト。
FRED API (scripts.common.fred_observations) を mock してネットワーク呼び出し無しで主要パスをカバー。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

# scripts/ を import path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.fetch_macro_indicators import (  # noqa: E402 — sys.path 操作後の意図的な import
    diff_at,
    fetch_fred_series,
)


def _make_observations(values: list[tuple[str, float]]) -> list[dict]:
    """fred_observations の戻り値形式を模擬。

    各要素は {"date": "YYYY-MM-DD", "value": float, ...} (一部省略)。
    """
    return [{"date": d, "value": v} for d, v in values]


# ─────────────────────────────────────────────────────────
# fetch_fred_series (fred_observations mock)
# ─────────────────────────────────────────────────────────

class TestFetchFredSeries:
    def test_converts_observations_to_sorted_series(self):
        """fetch_fred_series は observation dict list を pd.Series に変換、index 昇順。"""
        # 意図的に降順で渡し、結果が昇順になることを確認
        obs = _make_observations([
            ("2026-05-11", 4.45),
            ("2026-05-10", 4.43),
            ("2026-05-09", 4.40),
        ])
        with patch(
            "scripts.fetch_macro_indicators.fred_observations",
            return_value=obs,
        ):
            s = fetch_fred_series("DGS10", api_key="test_key")
        assert isinstance(s, pd.Series)
        assert len(s) == 3
        # index は昇順
        assert list(s.index) == sorted(s.index)
        # 値が一致
        assert s.iloc[-1] == 4.45

    def test_skips_none_values(self):
        """value が None の observation はスキップする。"""
        obs = _make_observations([("2026-05-09", 4.40), ("2026-05-10", 4.43)])
        # value=None の要素を 1 件挿入
        obs.append({"date": "2026-05-11", "value": None})
        with patch(
            "scripts.fetch_macro_indicators.fred_observations",
            return_value=obs,
        ):
            s = fetch_fred_series("DGS10", api_key="test_key")
        assert len(s) == 2  # None は弾かれた

    def test_api_exception_returns_empty_series(self):
        """fred_observations が例外を投げたら empty Series を返す (継続可能)。"""
        with patch(
            "scripts.fetch_macro_indicators.fred_observations",
            side_effect=RuntimeError("FRED API down"),
        ):
            s = fetch_fred_series("DGS10", api_key="test_key")
        assert s.empty


# ─────────────────────────────────────────────────────────
# diff_at (Series 操作)
# ─────────────────────────────────────────────────────────

class TestDiffAt:
    def test_returns_value_at_days_back(self):
        idx = pd.date_range("2026-05-01", periods=10, freq="D")
        s = pd.Series(range(10), index=idx, dtype="float64")
        # 最後は 2026-05-10、3 日前は 2026-05-07 → value=6.0
        assert diff_at(s, 3) == 6.0

    def test_empty_series_returns_none(self):
        assert diff_at(pd.Series(dtype="float64"), 1) is None

    def test_target_before_oldest_returns_none(self):
        """days_back が古すぎて全データが新しい場合 None。"""
        idx = pd.date_range("2026-05-09", periods=3, freq="D")
        s = pd.Series([1.0, 2.0, 3.0], index=idx)
        # 1 年前なら全データが target より新しい → 該当なし → None
        assert diff_at(s, 365) is None


# ─────────────────────────────────────────────────────────
# main() e2e
# ─────────────────────────────────────────────────────────

class TestMainE2E:
    def test_main_writes_empty_payload_when_no_api_key(self, tmp_path, monkeypatch):
        """FRED_API_KEY 未設定時は error JSON を書いて return。"""
        # 環境変数を確実に未設定に
        monkeypatch.delenv("FRED_API_KEY", raising=False)
        out_path = tmp_path / "macro.json"
        monkeypatch.setattr("scripts.fetch_macro_indicators.OUTPUT_PATH", out_path)

        from scripts.fetch_macro_indicators import main
        main()

        assert out_path.exists()
        payload = json.loads(out_path.read_text(encoding="utf-8"))
        assert payload["indicators"] == []
        assert "error" in payload
        assert "FRED_API_KEY" in payload["error"]

    def test_main_writes_valid_json_with_mocked_fred(self, tmp_path, monkeypatch):
        """FRED モック下で main() が data/macro.json を正しい schema で書く。

        全 INDICATORS に対して同じ mock observations を返す。
        """
        monkeypatch.setenv("FRED_API_KEY", "test_key_12345")
        out_path = tmp_path / "macro.json"
        monkeypatch.setattr("scripts.fetch_macro_indicators.OUTPUT_PATH", out_path)

        # 2 年分の月次データを模擬 (各日 4.45 〜 4.50 の範囲)
        obs = _make_observations([
            (f"2024-{m:02d}-15", 4.40 + 0.01 * m) for m in range(1, 13)
        ] + [
            (f"2025-{m:02d}-15", 4.45 + 0.01 * m) for m in range(1, 13)
        ] + [
            ("2026-05-11", 4.55),
        ])

        with patch(
            "scripts.fetch_macro_indicators.fred_observations",
            return_value=obs,
        ):
            from scripts.fetch_macro_indicators import main
            main()

        assert out_path.exists()
        payload = json.loads(out_path.read_text(encoding="utf-8"))

        # schema チェック
        assert "generatedAt" in payload
        assert "indicators" in payload
        # 全 INDICATORS 分のエントリが書かれている
        assert len(payload["indicators"]) > 0

        # 各 entry は必須キーを持つ
        for entry in payload["indicators"]:
            assert {"id", "name", "group", "freq", "unit", "desc", "value", "diff1d", "diff7d", "diff30d", "asOf"} <= entry.keys()
            assert isinstance(entry["value"], (int, float))

        # generatedAt は ISO 8601
        datetime.fromisoformat(payload["generatedAt"].replace("Z", "+00:00"))
