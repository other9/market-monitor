"""
fetch_news.py  (v6)

RSSから直近ニュースを集め、Claude API で:
  1. epigraph             : 冒頭引用
  2. headline_of_the_day  : 本日の一言サマリ
  3. news (7本)           : 市場を動かしたニュース + ソースURL
  4. funny_stories (3本)  : 市場関係者向け小話 + ソースURL
  5. charts_of_the_day (5-8候補): 注目チャートの候補を優先度順に列挙
                                (個別銘柄・指数・指標を自由に指定可)
  6. deep_dive            : 今日最も重要なニュース1本の解説記事
                            (背景・市場への含意・注視ポイント)

data/news.json に書き出す。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import feedparser
from anthropic import Anthropic

from chart_universe import CHART_UNIVERSE, prompt_list as chart_prompt_list, get_by_key


RSS_FEEDS: list[dict[str, str]] = [
    {"name": "Yahoo!ファイナンス",   "url": "https://news.yahoo.co.jp/rss/topics/business.xml"},
    {"name": "Reuters Japan Markets", "url": "https://assets.wor.jp/rss/rdf/reuters/markets.rdf"},
    {"name": "マネクリ",              "url": "https://media.monex.co.jp/list/feed"},
    {"name": "Reuters Business",     "url": "https://feeds.reuters.com/reuters/businessNews"},
    {"name": "MarketWatch Top",      "url": "https://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "CNBC Markets",         "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "Yahoo Finance US",     "url": "https://finance.yahoo.com/news/rssindex"},
]

OUTPUT_PATH = Path("data/news.json")

MODEL = "claude-opus-4-5"  # 深掘り解説の品質確保のため Opus を使用
MAX_TOKENS = 10000


def fetch_rss_items(max_per_feed: int = 25, hours_window: int = 36) -> list[dict[str, str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_window)
    items: list[dict[str, str]] = []

    for feed in RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed["url"])
        except Exception as e:
            print(f"[WARN] RSS fail: {feed['name']} {e}", file=sys.stderr)
            continue

        for entry in parsed.entries[:max_per_feed]:
            pub = entry.get("published_parsed") or entry.get("updated_parsed")
            if pub:
                pub_dt = datetime(*pub[:6], tzinfo=timezone.utc)
                if pub_dt < cutoff:
                    continue
                pub_iso = pub_dt.isoformat()
            else:
                pub_iso = ""

            title = entry.get("title", "").strip()
            summary = entry.get("summary", "").strip()
            for tag in ("<p>", "</p>", "<br>", "<br/>", "<br />"):
                summary = summary.replace(tag, " ")
            if len(summary) > 600:
                summary = summary[:600] + "…"

            if not title:
                continue

            items.append({
                "source":    feed["name"],
                "title":     title,
                "summary":   summary,
                "link":      entry.get("link", ""),
                "published": pub_iso,
            })

    print(f"[INFO] Collected {len(items)} items from {len(RSS_FEEDS)} feeds")
    return items


def build_system_prompt() -> str:
    universe_prompt = chart_prompt_list()
    return f"""あなたは金融市場のアナリスト兼エディターです。
直近24時間のニュース見出しを元に、マーケット日報の以下6要素を日本語で作成します。

ニュース一覧はインデックス番号 [N] 付きで提供されます。news / funny_stories / deep_dive では、
参照した元記事のインデックス番号を source_index で返してください（元記事URLの紐付けに使います）。

【要素1: epigraph】
過去24時間の市場の空気に合う、実在の名言または書籍からの引用。
- 出典は実在するものに限る（捏造禁止）
- 日本語訳で提示

【要素2: headline_of_the_day】
本日の一言サマリ。30字以内、絵文字禁止。

【要素3: news (7本)】
マーケットに影響を与えた／与えうる重要ニュース7本。選定基準:
- 中央銀行・金融政策・主要経済指標を最優先
- 地政学（戦争・制裁・外交）
- Magnificent 7 / メガバンク / 重要セクターの決算
- 原油・金・為替の大きな動き
- 純粋な個別企業ゴシップや企画記事は除外
- 各ニュースに source_index を必ず付ける

【要素4: funny_stories (3本)】
市場関係者がクスッとなる小話を3本、トーンを変えて:
  ① 皮肉・風刺系  ② 人間味・哀愁系  ③ 観察・再発見系
- 特定個人・属性への攻撃にはしない
- 各話 100〜180字
- ネタ元がある場合は source_index を付ける、ない場合は null

【要素5: charts_of_the_day (5〜8本、優先度順)】
今日のニュース文脈・市場の話題から「今日見るべき」チャート候補を**5〜8本、優先度順に**挙げる。
このリストから後段の Python スクリプトが **上から順に取得を試み、実際に取得できた上位3本**を
ダッシュボードに表示する。だから**多めに候補を挙げて欲しい**。

重要な指針:
- **指数・為替・商品・金利指標**: 候補リスト (下記) の key を使う
- **個別銘柄**: 候補リストにない場合でも、yfinance で取得可能な ticker を直接指定してよい
  (例: トヨタ決算が話題なら "7203.T", NVIDIAが話題なら "NVDA", テスラなら "TSLA")
- **FRED 指標**: ticker に FRED シリーズID (大文字英数) を指定し、source="fred" と明記
- 個別銘柄は米株・日本株・欧州株・中国株・新興国ETFなど**地理的に分散**させる
- 1日のテーマを違う角度から捉える組み合わせ (例: 原油ならWTI + 関連セクター + ハイイールド)

候補リスト (既存のプール、これ以外も指定可):
{universe_prompt}

【要素6: deep_dive (1本)】
今日最も重要で、掘り下げて解説する価値のあるニュースを**1本だけ**選び、解説記事を書く。
- 金融政策・地政学・政策転換・大型決算・市場構造変化など、単なる速報で終わらせず
  **背景から将来への含意まで**を見渡せる話題を選ぶ
- 「なぜこのニュースが今重要なのか」の大局観を読者に提供する
- 政治や政策が絡む場合も、党派性を排し市場インパクトに集中する

deep_dive の構成:
  - title          : 見出し (25〜40字、センセーショナルに走らず実直に)
  - lede           : サブタイトル/リード文 (80〜120字、記事全体の要約)
  - background     : 背景 (200〜300字、そのニュースの経緯と文脈)
  - implications   : 市場への含意 (200〜300字、短期/中期/長期どれかまたは複数の視点)
  - what_to_watch  : 注視すべきポイント (配列、3〜5個、今後のイベント・指標・数字)
  - related_keys   : 関連する市場指標の key (候補リストから2〜4個)
  - source_index   : 元記事のインデックス番号

出力は必ず以下の JSON 形式で、コードブロックや説明文なしで返してください:

{{
  "epigraph": {{ "quote": "...", "source": "...", "connection": "..." }},
  "headline_of_the_day": "...",
  "news": [ {{ "tag": "...", "headline": "...", "body": "...", "impact": ["..."], "source_index": 12 }} ],
  "funny_stories": [ {{ "kind": "...", "title": "...", "body": "...", "source_index": 7 }} ],
  "charts_of_the_day": [
    {{ "ticker": "NVDA", "source": "yf", "title": "NVIDIA", "rationale": "..." }},
    {{ "ticker": "sp500", "source": "universe", "title": "S&P 500", "rationale": "..." }},
    {{ "ticker": "BAMLH0A0HYM2", "source": "fred", "title": "HYスプレッド", "rationale": "..." }}
  ],
  "deep_dive": {{
    "title": "...",
    "lede": "...",
    "background": "...",
    "implications": "...",
    "what_to_watch": ["...", "...", "..."],
    "related_keys": ["sp500", "vix"],
    "source_index": 3
  }}
}}

source の値:
- "universe" : 候補リストの key を指定 (例: "sp500", "wti", "t10y2y")
- "yf"       : yfinance で取れる ticker を直接指定 (例: "7203.T", "NVDA", "^STOXX50E")
- "fred"     : FRED シリーズ ID を直接指定 (例: "DGS2", "MORTGAGE30US")
"""


def summarize_with_claude(items: list[dict[str, str]]) -> dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = Anthropic(api_key=api_key)

    lines = []
    for i, it in enumerate(items[:150]):
        lines.append(f"[{i}] ({it['source']}) {it['title']}")
        if it["summary"]:
            lines.append(f"    {it['summary']}")

    user_msg = (
        f"以下は直近24時間に配信された市場関連ニュースの見出し一覧です "
        f"（計{len(items)}件）。先頭の [N] がインデックス番号です。"
        f"システムプロンプトに従って JSON を返してください。\n\n"
        + "\n".join(lines)
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=build_system_prompt(),
        messages=[{"role": "user", "content": user_msg}],
    )

    text = "".join(b.text for b in msg.content if hasattr(b, "text")).strip()

    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip("` \n")

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse Claude response as JSON: {e}", file=sys.stderr)
        print(f"[ERROR] Raw text:\n{text[:2500]}", file=sys.stderr)
        raise


def attach_source_urls(payload: dict[str, Any], items: list[dict[str, str]]) -> dict[str, Any]:
    def _get(idx):
        if idx is None:
            return None, None
        try:
            i = int(idx)
            if 0 <= i < len(items):
                return items[i].get("link", ""), items[i].get("source", "")
        except (ValueError, TypeError):
            pass
        return None, None

    for n in payload.get("news", []):
        link, src = _get(n.get("source_index"))
        if link:
            n["link"] = link
            n["source"] = src

    for f in payload.get("funny_stories", []):
        link, src = _get(f.get("source_index"))
        if link:
            f["link"] = link
            f["source"] = src

    dd = payload.get("deep_dive")
    if dd:
        link, src = _get(dd.get("source_index"))
        if link:
            dd["link"] = link
            dd["source"] = src

    return payload


def normalize_chart_candidates(payload: dict[str, Any]) -> dict[str, Any]:
    """charts_of_the_day を正規化:
    - source="universe" の場合は CHART_UNIVERSE から引く → ticker/source書き換え
    - 重複排除
    - 最低3候補、最大10候補
    fetch_featured_charts.py 側でこのリストの上から順に試行する。
    """
    charts = payload.get("charts_of_the_day", [])
    cleaned = []
    seen_tickers = set()

    for c in charts:
        src  = c.get("source", "").lower()
        tick = c.get("ticker", "").strip()

        if src == "universe":
            uni = get_by_key(tick)
            if not uni:
                continue
            actual_src = uni["source"]
            actual_id  = uni["id"]
            name       = uni["name"]
            sub        = uni["sub"]
        elif src in ("yf", "fred"):
            actual_src = src
            actual_id  = tick
            name       = c.get("title") or tick
            sub        = ""
        else:
            continue

        dedup_key = f"{actual_src}:{actual_id}".upper()
        if dedup_key in seen_tickers:
            continue
        seen_tickers.add(dedup_key)

        cleaned.append({
            "source":    actual_src,
            "ticker":    actual_id,
            "title":     c.get("title") or name,
            "name":      name,
            "sub":       sub,
            "rationale": c.get("rationale", ""),
        })

    # 3本未満ならデフォルトを末尾に追加
    fallbacks = ["sp500", "usdjpy", "wti", "nikkei", "vix"]
    for k in fallbacks:
        if len(cleaned) >= 5:
            break
        uni = get_by_key(k)
        if not uni:
            continue
        dedup_key = f"{uni['source']}:{uni['id']}".upper()
        if dedup_key in seen_tickers:
            continue
        seen_tickers.add(dedup_key)
        cleaned.append({
            "source":    uni["source"],
            "ticker":    uni["id"],
            "title":     uni["name"],
            "name":      uni["name"],
            "sub":       uni["sub"],
            "rationale": "デフォルト候補 (Claude の指定数が不足)",
        })

    payload["charts_of_the_day"] = cleaned[:10]
    return payload


def main() -> None:
    items = fetch_rss_items()

    if not items:
        print("[WARN] No items fetched. Writing fallback.")
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "epigraph": {
                "quote": "最も重要なのは、分からないということを知っていることだ。",
                "source": "ソクラテス",
                "connection": "データ不在の朝は、己の無知を認めるところから始まる。",
            },
            "headline_of_the_day": "データ取得失敗",
            "news": [],
            "funny_stories": [
                {"kind": "皮肉", "title": "ニュースなき朝",
                 "body": "RSSが沈黙した日、ダッシュボードはかえって雄弁になる。空っぽの一覧を前に、トレーダーは『何も起きなかった』という最大級の事件を目撃する。"},
                {"kind": "人間味", "title": "データ失踪事件",
                 "body": "見出しが一本も来ない朝、スクリーンの前で人は一番落ち着かない。コーヒーを二杯注いで、結局自分のPFをリフレッシュし続けてしまう。"},
                {"kind": "観察", "title": "沈黙の指標",
                 "body": "ニュースフローの欠如もまた情報である、と経済学者は言う。しかしチャートだけを見続けた夜、人は何も言わない市場に話しかけ始めるのだ。"},
            ],
            "charts_of_the_day": [],
            "deep_dive": None,
        }
    else:
        summary = summarize_with_claude(items)
        summary = attach_source_urls(summary, items)
        summary = normalize_chart_candidates(summary)
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            **summary,
        }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH}: "
          f"{len(payload.get('news', []))} news + "
          f"{len(payload.get('funny_stories', []))} muse + "
          f"{len(payload.get('charts_of_the_day', []))} chart candidates + "
          f"{'1' if payload.get('deep_dive') else '0'} deep_dive")


if __name__ == "__main__":
    main()
