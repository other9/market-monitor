"""
chart_universe.py
「本日の注目チャート」の候補銘柄プール。

- fetch_news.py が Claude にこのリストを見せて3本選んでもらう
- fetch_market_data.py が選ばれたticker IDで履歴を取得する
- 新規候補を加えるときはここだけ編集すれば両方に反映される
"""

from __future__ import annotations


# source: "yf" = yfinance / "fred" = FRED API
# id    : データ取得に使うシンボル
# key   : JSONキーとして使う識別子 (英数とアンダースコア)
# name  : 画面に出す日本語名
# sub   : 単位や補足
# tags  : Claude が文脈から選びやすいように用途タグを付与
CHART_UNIVERSE: list[dict] = [
    # ── 株式 ──
    {"key": "nikkei",   "id": "^N225",    "source": "yf",   "name": "日経平均",         "sub": "INDEX · JPY",    "tags": ["日本株", "equity"]},
    {"key": "topix",    "id": "^TOPX",    "source": "yf",   "name": "TOPIX",           "sub": "INDEX · JPY",    "tags": ["日本株", "equity"]},
    {"key": "sp500",    "id": "^GSPC",    "source": "yf",   "name": "S&P 500",         "sub": "INDEX · USD",    "tags": ["米国株", "equity"]},
    {"key": "nasdaq",   "id": "^IXIC",    "source": "yf",   "name": "NASDAQ",          "sub": "INDEX · USD",    "tags": ["米国株", "equity", "ハイテク"]},
    {"key": "dow",      "id": "^DJI",     "source": "yf",   "name": "Dow Jones",       "sub": "INDEX · USD",    "tags": ["米国株", "equity"]},
    {"key": "russell",  "id": "^RUT",     "source": "yf",   "name": "Russell 2000",    "sub": "INDEX · USD",    "tags": ["米国株", "小型株"]},
    {"key": "sox",      "id": "^SOX",     "source": "yf",   "name": "SOX (半導体)",     "sub": "INDEX · USD",    "tags": ["半導体", "米国株", "ハイテク"]},
    {"key": "hsi",      "id": "^HSI",     "source": "yf",   "name": "ハンセン指数",     "sub": "INDEX · HKD",    "tags": ["中国株", "香港"]},

    # ── 為替 ──
    {"key": "usdjpy",   "id": "JPY=X",    "source": "yf",   "name": "USD/JPY",         "sub": "ドル円",         "tags": ["為替", "円"]},
    {"key": "eurjpy",   "id": "EURJPY=X", "source": "yf",   "name": "EUR/JPY",         "sub": "ユーロ円",       "tags": ["為替", "円"]},
    {"key": "eurusd",   "id": "EURUSD=X", "source": "yf",   "name": "EUR/USD",         "sub": "ユーロドル",     "tags": ["為替"]},
    {"key": "dxy",      "id": "DX-Y.NYB", "source": "yf",   "name": "ドル指数 (DXY)",   "sub": "INDEX",         "tags": ["為替", "ドル"]},

    # ── コモディティ ──
    {"key": "wti",      "id": "CL=F",     "source": "yf",   "name": "WTI原油",          "sub": "$ / bbl",       "tags": ["コモディティ", "エネルギー", "原油"]},
    {"key": "brent",    "id": "BZ=F",     "source": "yf",   "name": "Brent原油",        "sub": "$ / bbl",       "tags": ["コモディティ", "エネルギー", "原油"]},
    {"key": "gold",     "id": "GC=F",     "source": "yf",   "name": "金 (COMEX)",       "sub": "$ / oz",        "tags": ["コモディティ", "金", "安全資産"]},
    {"key": "silver",   "id": "SI=F",     "source": "yf",   "name": "銀",               "sub": "$ / oz",        "tags": ["コモディティ", "貴金属"]},
    {"key": "copper",   "id": "HG=F",     "source": "yf",   "name": "銅",               "sub": "$ / lb",        "tags": ["コモディティ", "景気敏感"]},
    {"key": "btc",      "id": "BTC-USD",  "source": "yf",   "name": "ビットコイン",     "sub": "BTC/USD",       "tags": ["暗号資産", "リスクオン"]},

    # ── 金利 / ボラティリティ ──
    {"key": "us10y",    "id": "^TNX",     "source": "yf",   "name": "米10年債利回り",   "sub": "%",            "tags": ["金利", "国債"]},
    {"key": "us02y",    "id": "^IRX",     "source": "yf",   "name": "米3ヶ月T-Bill",    "sub": "%",            "tags": ["金利", "短期金利"]},
    {"key": "us30y",    "id": "^TYX",     "source": "yf",   "name": "米30年債利回り",   "sub": "%",            "tags": ["金利", "長期金利"]},
    {"key": "vix",      "id": "^VIX",     "source": "yf",   "name": "VIX (恐怖指数)",    "sub": "INDEX",        "tags": ["ボラティリティ", "センチメント"]},

    # ── FRED マクロ ──
    {"key": "t10y2y",   "id": "T10Y2Y",       "source": "fred", "name": "10Y-2Y スプレッド",    "sub": "% · 景気指標",  "tags": ["金利", "景気", "逆イールド"]},
    {"key": "t10yie",   "id": "T10YIE",       "source": "fred", "name": "10Y ブレークイーブン", "sub": "% · 期待インフレ", "tags": ["インフレ期待", "金利"]},
    {"key": "dfii10",   "id": "DFII10",       "source": "fred", "name": "10Y 実質金利",         "sub": "% · TIPS",      "tags": ["金利", "実質金利"]},
    {"key": "hyoas",    "id": "BAMLH0A0HYM2", "source": "fred", "name": "HY 社債スプレッド",    "sub": "% · OAS",      "tags": ["信用", "クレジット", "リスクオフ"]},
    {"key": "igoas",    "id": "BAMLC0A0CM",   "source": "fred", "name": "IG 社債スプレッド",    "sub": "% · OAS",      "tags": ["信用", "クレジット"]},
    {"key": "nfci",     "id": "NFCI",         "source": "fred", "name": "Chicago Fed金融環境",  "sub": "週次 · z-score", "tags": ["金融環境", "リスク"]},
    {"key": "stlfsi",   "id": "STLFSI4",      "source": "fred", "name": "St. Louis金融ストレス", "sub": "週次 · z-score", "tags": ["金融ストレス", "リスク"]},
    {"key": "sofr",     "id": "SOFR",         "source": "fred", "name": "SOFR",                 "sub": "% · 短期金利",   "tags": ["金利", "短期金利"]},
    {"key": "dxy_bgs",  "id": "DTWEXBGS",     "source": "fred", "name": "ドル指数 (広義)",      "sub": "INDEX",        "tags": ["為替", "ドル", "新興国"]},
    {"key": "natgas",   "id": "DHHNGSP",      "source": "fred", "name": "天然ガス (Henry Hub)", "sub": "$ / MMBtu",    "tags": ["コモディティ", "エネルギー"]},
]


def get_by_key(key: str) -> dict | None:
    for c in CHART_UNIVERSE:
        if c["key"] == key:
            return c
    return None


def prompt_list() -> str:
    """Claude に渡す候補リストのテキスト表現。"""
    lines = []
    for c in CHART_UNIVERSE:
        tag_str = " / ".join(c["tags"])
        lines.append(f'- key="{c["key"]}" : {c["name"]} ({c["sub"]}) [tags: {tag_str}]')
    return "\n".join(lines)
