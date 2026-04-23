"""
fetch_news.py  (enhanced)

主要メディアの RSS から直近のマーケットニュースを集め、
Claude API で以下を一括生成：
  1. epigraph         : 市場の空気に合う名言・書籍からの引用
  2. headline_of_the_day : 本日の一言サマリ
  3. news (7本)       : 市場を動かしたニュース
  4. funny_story      : 市場関係者がクスッとくる小話

data/news.json に書き出す。環境変数 ANTHROPIC_API_KEY が必要。
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


RSS_FEEDS: list[dict[str, str]] = [
    {"name": "Yahoo!ファイナンス",  "url": "https://news.yahoo.co.jp/rss/topics/business.xml"},
    {"name": "Reuters Japan Markets", "url": "https://assets.wor.jp/rss/rdf/reuters/markets.rdf"},
    {"name": "マネクリ",            "url": "https://media.monex.co.jp/list/feed"},
    {"name": "Reuters Business",    "url": "https://feeds.reuters.com/reuters/businessNews"},
    {"name": "MarketWatch Top",     "url": "https://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "CNBC Markets",        "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "Yahoo Finance US",    "url": "https://finance.yahoo.com/news/rssindex"},
]

OUTPUT_PATH = Path("data/news.json")

MODEL = "claude-opus-4-5"
MAX_TOKENS = 5000


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


SYSTEM_PROMPT = """あなたは金融市場のアナリスト兼エディターです。
直近24時間のニュース見出しを元に、マーケット日報の以下4要素を日本語で作成します。

【要素1: epigraph (冒頭引用)】
過去24時間の市場の空気（高揚・不安・混迷・楽観など）に合う、実在の名言または書籍からの引用を選ぶ。
- 出典は実在するものに限る（捏造禁止）
- 文学・哲学・経済学・投資家の言葉など、ジャンルは自由
- 今日の市場にピタリとくる選定を心がける
- 引用文は原文が英語等でも、日本語訳で提示する

【要素2: headline_of_the_day】
本日の一言サマリ。30字以内、絵文字禁止。

【要素3: news (7本)】
マーケットに影響を与えた／与えうる重要ニュース7本。選定基準：
- 中央銀行・金融政策・主要経済指標を最優先
- 地政学（戦争・制裁・外交）で市場が反応したもの
- Magnificent 7 / メガバンク / 重要セクターの決算
- 原油・金・為替の大きな動き
- 純粋な個別企業ゴシップや企画記事は除外

【要素4: funny_story】
市場関係者がクスッとなるような、皮肉・ユーモア・人間味のある小話を1つ。
- ニュースそのものをネタにしたウィットに富んだ観察、市場の珍事件、人間の不合理な行動、
  トレーダー／エコノミスト／CEOの迷言、奇妙な指標、業界の内輪ネタなど
- 実在のニュースから膨らませる場合は事実に基づく範囲で
- 毒舌すぎず、特定個人や属性への攻撃にはしない
- 120〜200字程度

出力は必ず以下の JSON 形式で、コードブロックや説明文なしで返してください：

{
  "epigraph": {
    "quote": "引用文（日本語）",
    "source": "著者名・書籍名・発言年など",
    "connection": "なぜこの引用が今日の市場に合うのか（40〜60字で）"
  },
  "headline_of_the_day": "本日の一言サマリ",
  "news": [
    {
      "tag": "GEOPOLITICS | EQUITY | RATES/FED | MONETARY POLICY | CORPORATE | COMMODITIES | FX | MACRO | OTHER",
      "headline": "日本語の見出し（30〜45字）",
      "body": "日本語の本文（80〜130字）。具体的な数値・銘柄名・固有名詞を含める。",
      "impact": ["影響した指標の例 最大3つ"]
    }
  ],
  "funny_story": {
    "title": "小話のタイトル（15〜25字）",
    "body": "本文（120〜200字）"
  }
}
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
        f"（計{len(items)}件）。システムプロンプトに従って JSON を返してください。\n\n"
        + "\n".join(lines)
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = "".join(
        block.text for block in msg.content if hasattr(block, "text")
    ).strip()

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


def main() -> None:
    items = fetch_rss_items()

    if not items:
        print("[WARN] No items fetched. Writing fallback news.")
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "epigraph": {
                "quote": "最も重要なのは、分からないということを知っていることだ。",
                "source": "ソクラテス",
                "connection": "データ不在の朝は、己の無知を認めるところから始まる。",
            },
            "headline_of_the_day": "データ取得失敗",
            "news": [],
            "funny_story": {
                "title": "ニュースがない日の沈黙",
                "body": "RSSが一本も拾えない日、トレーダーは早朝のコーヒーを二杯飲み直す。チャートだけが雄弁で、記者クラブは眠り、Bloombergだけが健気に点滅している。",
            },
        }
    else:
        summary = summarize_with_claude(items)
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            **summary,
        }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_PATH} ({len(payload.get('news', []))} news items + epigraph + funny_story)")


if __name__ == "__main__":
    main()
