"""
fetch_news.py
主要メディアの RSS から昨日のマーケット関連ニュースを集め、
Claude API で「市場を動かした7本」に要約・タグ付けし、
data/news.json に書き出す。

GitHub Actions で毎朝7時(JST)に実行される想定。
環境変数 ANTHROPIC_API_KEY が必要。
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


# ─────────────────────────────────────────────────────────
# 1. 取得する RSS フィード
#    日経は公式RSSを絞っているため、ロイター・Bloomberg・Yahooファイナンス日本・
#    MarketWatch などの公開フィードを使う。
# ─────────────────────────────────────────────────────────
RSS_FEEDS: list[dict[str, str]] = [
    # 日本語
    {"name": "Yahoo!ファイナンス",  "url": "https://news.yahoo.co.jp/rss/topics/business.xml"},
    {"name": "Reuters Japan Markets", "url": "https://assets.wor.jp/rss/rdf/reuters/markets.rdf"},
    {"name": "マネクリ",            "url": "https://media.monex.co.jp/list/feed"},
    # 英語
    {"name": "Reuters Business",    "url": "https://feeds.reuters.com/reuters/businessNews"},
    {"name": "MarketWatch Top",     "url": "https://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "CNBC Markets",        "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "Yahoo Finance US",    "url": "https://finance.yahoo.com/news/rssindex"},
]

OUTPUT_PATH = Path("data/news.json")

# 要約に使う Claude モデル
MODEL = "claude-opus-4-7"
MAX_TOKENS = 4000


# ─────────────────────────────────────────────────────────
# 2. RSS 取得
# ─────────────────────────────────────────────────────────
def fetch_rss_items(max_per_feed: int = 20, hours_window: int = 36) -> list[dict[str, str]]:
    """過去 hours_window 時間以内の記事をフラットなリストで返す。"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_window)
    items: list[dict[str, str]] = []

    for feed in RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed["url"])
        except Exception as e:
            print(f"[WARN] RSS fail: {feed['name']} {e}", file=sys.stderr)
            continue

        for entry in parsed.entries[:max_per_feed]:
            # 発行日の取り扱い
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
            # HTMLタグ雑に除去
            for tag in ("<p>", "</p>", "<br>", "<br/>", "<br />"):
                summary = summary.replace(tag, " ")
            # 長すぎる summary は切る
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


# ─────────────────────────────────────────────────────────
# 3. Claude で要約
# ─────────────────────────────────────────────────────────
SYSTEM_PROMPT = """あなたは金融市場のアナリストです。
直近24時間の生のニュース見出しから、グローバルマーケット（日本株・米国株・為替・金利・コモディティ）に
「実際に影響を与えた」または「今後影響しうる」重要ニュースを 7 本選び、
日本語で簡潔にまとめてください。

出力は必ず以下の JSON 形式で、コードブロックや説明文なしで返してください：

{
  "headline_of_the_day": "本日の一言サマリ（30字以内、絵文字なし）",
  "news": [
    {
      "tag": "GEOPOLITICS | EQUITY | RATES/FED | MONETARY POLICY | CORPORATE | COMMODITIES | FX | MACRO | OTHER のいずれか",
      "headline": "日本語の見出し（30〜45字）",
      "body": "日本語の本文（80〜130字）。具体的な数値・銘柄名・固有名詞を含める。",
      "impact": ["影響した指標の例 最大3つ", "例: S&P +1.05%", "例: WTI $92台"]
    }
  ]
}

選定基準:
1. 中央銀行・金融政策・主要経済指標を最優先
2. 地政学（戦争・制裁・外交）で市場が反応したもの
3. Magnificent 7・メガバンク・重要セクターの決算
4. 原油・金・為替の大きな動き
5. 重複する話題は最も重要な1本に集約
6. 純粋な個別企業ゴシップや速報性の低い企画記事は除外
"""


def summarize_with_claude(items: list[dict[str, str]]) -> dict[str, Any]:
    """RSSアイテムを Claude に投げて JSON で返してもらう。"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = Anthropic(api_key=api_key)

    # 生ニュースをコンパクトなテキストに圧縮
    lines = []
    for i, it in enumerate(items[:150]):  # 多すぎるとコンテキスト肥大
        lines.append(f"[{i}] ({it['source']}) {it['title']}")
        if it["summary"]:
            lines.append(f"    {it['summary']}")

    user_msg = (
        f"以下は直近24時間に配信された市場関連ニュースの見出し一覧です "
        f"（計{len(items)}件）。市場に影響を与えた／与えうる上位7本を選び、"
        f"JSON で返してください。\n\n"
        + "\n".join(lines)
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    # Claude の応答テキストを取り出し JSON にパース
    text = "".join(
        block.text for block in msg.content if hasattr(block, "text")
    ).strip()

    # 念のためコードブロックを剥がす
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip("` \n")

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse Claude response as JSON: {e}", file=sys.stderr)
        print(f"[ERROR] Raw text:\n{text[:1000]}", file=sys.stderr)
        raise


# ─────────────────────────────────────────────────────────
# 4. メイン
# ─────────────────────────────────────────────────────────
def main() -> None:
    items = fetch_rss_items()
    if not items:
        print("[WARN] No items fetched. Writing empty news.")
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "headline_of_the_day": "",
            "news": [],
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
    print(f"\nWrote {OUTPUT_PATH} ({len(payload.get('news', []))} news items)")


if __name__ == "__main__":
    main()
