"""
fetch_news.py
RSSから直近ニュースを集め、Claude API で以下を一括生成:
  1. epigraph                : 冒頭引用
  2. headline_of_the_day     : 本日の一言サマリ
  3. news (7本)              : 市場を動かしたニュース（各ソースURL付き）
  4. funny_stories (3本)     : 市場関係者向けの小話（各ソースURL付き）
  5. charts_of_the_day (3本) : 注目チャート選定

data/news.json に書き出す。ANTHROPIC_API_KEY が必要。
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

MODEL = "claude-haiku-4-5"
MAX_TOKENS = 7000


def fetch_rss_items(max_per_feed: int = 20, hours_window: int = 36) -> list[dict[str, str]]:
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
            if len(summary) > 500:
                summary = summary[:500] + "…"

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
    universe = chart_prompt_list()
    return f"""あなたは金融市場のアナリスト兼エディターです。
直近24時間のニュース見出しを元に、マーケット日報の以下5要素を日本語で作成します。

ニュース一覧はインデックス番号 [N] 付きで提供されます。news と funny_stories では、
参照した元記事のインデックス番号を source_index で返してください (元記事URLの紐付けに使います)。

【要素1: epigraph】
過去24時間の市場の空気に合う、実在の名言または書籍からの引用。
- 出典は実在するものに限る（捏造禁止）
- 日本語訳で提示

【要素2: headline_of_the_day】
本日の一言サマリ。30字以内、絵文字禁止。

【要素3: news (7本)】
マーケットに影響を与えた／与えうる重要ニュース7本。
- 中央銀行・金融政策・主要経済指標を最優先
- 地政学（戦争・制裁・外交）
- Magnificent 7 / メガバンク / 重要セクターの決算
- 原油・金・為替の大きな動き
- 純粋な個別企業ゴシップや企画記事は除外
- **各ニュースには元記事のインデックス番号 source_index を必ず付けること**
  (記事一覧の先頭の [N] の数字をそのまま入れる)

【要素4: funny_stories (3本)】
市場関係者がクスッとなるような、皮肉・ユーモア・人間味のある小話を3本。
**トーンを変えて3本**:
  ① 皮肉・風刺系: 市場の矛盾や「お決まりの光景」を斜めから突く一言
  ② 人間味・哀愁系: トレーダーや投資家の不合理さ、滑稽なリアクション
  ③ 観察・再発見系: 市場の珍現象、奇妙な統計、意外なパターンなど
- 特定個人・属性への攻撃にはしない
- 各話 100〜180字
- **ニュース記事をネタに膨らませる場合は source_index を付ける**
  (完全にオリジナルな観察であれば source_index は null)

【要素5: charts_of_the_day (3本)】
候補リストから "key" をちょうど 3 本選ぶ。着眼点は多様に。

候補リスト:
{universe}

出力は必ず以下の JSON 形式で、コードブロックや説明文なしで返してください:

{{
  "epigraph": {{
    "quote": "...",
    "source": "...",
    "connection": "..."
  }},
  "headline_of_the_day": "...",
  "news": [
    {{
      "tag": "GEOPOLITICS | EQUITY | RATES/FED | MONETARY POLICY | CORPORATE | COMMODITIES | FX | MACRO | OTHER",
      "headline": "...",
      "body": "...",
      "impact": ["..."],
      "source_index": 12
    }}
  ],
  "funny_stories": [
    {{
      "kind": "皮肉 | 人間味 | 観察",
      "title": "...",
      "body": "...",
      "source_index": 7
    }},
    {{
      "kind": "人間味",
      "title": "...",
      "body": "...",
      "source_index": null
    }},
    {{
      "kind": "観察",
      "title": "...",
      "body": "...",
      "source_index": 23
    }}
  ],
  "charts_of_the_day": [
    {{
      "key": "...",
      "title": "...",
      "rationale": "..."
    }}
  ]
}}
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
        print(f"[ERROR] Raw text:\n{text[:2000]}", file=sys.stderr)
        raise


def attach_source_urls(payload: dict[str, Any], items: list[dict[str, str]]) -> dict[str, Any]:
    """source_index を見て news / funny_stories に link と source を付与。"""
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

    return payload


def validate_charts(payload: dict[str, Any]) -> dict[str, Any]:
    valid_keys = {c["key"] for c in CHART_UNIVERSE}
    charts = payload.get("charts_of_the_day", [])
    cleaned = []
    seen = set()
    for c in charts:
        k = c.get("key")
        if k in valid_keys and k not in seen:
            cleaned.append(c)
            seen.add(k)

    defaults = ["sp500", "usdjpy", "wti"]
    for k in defaults:
        if len(cleaned) >= 3:
            break
        if k not in seen:
            uni = get_by_key(k)
            cleaned.append({
                "key": k,
                "title": uni["name"],
                "rationale": "フォールバック（Claude の選定が不正）",
            })
            seen.add(k)

    payload["charts_of_the_day"] = cleaned[:3]
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
                 "body": "RSSが沈黙した日、ダッシュボードはかえって雄弁になる。空っぽの一覧を前に、トレーダーは『何も起きなかった』という最大級の事件を目撃する。",
                 "link": None, "source": None},
                {"kind": "人間味", "title": "データ失踪事件",
                 "body": "見出しが一本も来ない朝、スクリーンの前で人は一番落ち着かない。コーヒーを二杯注いで、結局自分のPFをリフレッシュし続けてしまう。",
                 "link": None, "source": None},
                {"kind": "観察", "title": "沈黙の指標",
                 "body": "ニュースフローの欠如もまた情報である、と経済学者は言う。しかしチャートだけを見続けた夜、人は何も言わない市場に話しかけ始めるのだ。",
                 "link": None, "source": None},
            ],
            "charts_of_the_day": [
                {"key": "sp500",  "title": "S&P 500",  "rationale": "デフォルト選定"},
                {"key": "usdjpy", "title": "USD/JPY",  "rationale": "デフォルト選定"},
                {"key": "wti",    "title": "WTI原油",   "rationale": "デフォルト選定"},
            ],
        }
    else:
        summary = summarize_with_claude(items)
        summary = attach_source_urls(summary, items)
        summary = validate_charts(summary)
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
          f"{len(payload.get('charts_of_the_day', []))} charts")


if __name__ == "__main__":
    main()
