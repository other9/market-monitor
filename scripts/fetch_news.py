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
CB_PATH     = Path("data/central_banks.json")

MODEL = "claude-opus-4-5"  # 深掘り解説の品質確保のため Opus を使用
MAX_TOKENS = 12000


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


def build_system_prompt(cb_facts: str = "") -> str:
    universe_prompt = chart_prompt_list()
    cb_section = ""
    if cb_facts:
        cb_section = f"""

【参考: 中央銀行の最新ファクトデータ】
以下は FRED から取得した各中央銀行の政策金利の最新値です。
この情報を **要素9 (central_bank_watch)** で使ってください。

{cb_facts}
"""

    return f"""あなたは金融市場のアナリスト兼エディターです。
直近24時間のニュース見出しを元に、マーケット日報の以下9要素を日本語で作成します。{cb_section}

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

【要素7: economic_chart_of_the_day】
今日のニュース文脈や経済カレンダーを踏まえ、**経済指標や政治関連の時系列データ**を1つ選び、
FREDで取得可能な系列IDを指定する。これは「市場を動かしうる経済指標」や「政治情勢を数値で追える指標」を
グラフで見せるための枠。

選び方の例:
- 雇用統計が発表される週なら ICSA (初失業保険申請件数、週次) や PAYEMS (非農業部門雇用者数、月次)
- CPI発表週なら CPIAUCSL (CPI、月次) や CORESTICKM159SFRBATL (コアCPI)
- 大統領選・重要選挙の近くなら UMCSENT (ミシガン消費者信頼感、月次) や USPCE (個人消費支出)
- 地政学なら DCOILWTICO (WTI、日次、ヘッジ指標として) や DHHNGSP (天然ガス)
- 景気後退懸念が強まっているなら USREC (リセッション判定、月次) や INDPRO (鉱工業生産)
- ドル高環境なら DTWEXBGS (ドル広義指数、日次)
- 金融ストレスなら NFCI や STLFSI4 (週次)

返す内容:
  - series_id    : FREDシリーズID (例: "ICSA", "CPIAUCSL", "UMCSENT")
  - title        : グラフタイトル (20〜30字、日本語)
  - subtitle     : 副題/単位説明 (例: "週次, 千人", "前年比, %")
  - rationale    : なぜ今日この指標を見るべきか (60〜100字)
  - period_years : 時系列の期間 (整数、1〜10年、典型は3〜5年)

【要素8: valuation_view】
市場全体のバリュエーション（割高/中立/割安）について、その日の時点での見方を100〜180字でコメント。
「Shiller CAPEは依然30倍台で歴史的高水準だが、Fed Modelは10年金利低下でやや改善」のように、
**具体的な指標水準と直近の動きに触れる**。
- 単なる「割高です/割安です」ではなく、何故そう判断するかを述べる
- 直近のニュース（決算・金利動向・地政学）と関連付けてもよい
- 政治的バイアスを排し、データに基づく
- 中立的なトーン (アナリストレポート風)

返す内容:
  - stance     : "割高 (overvalued)" | "やや割高" | "中立" | "やや割安" | "割安 (undervalued)"
  - body       : 解説本文 (100〜180字)

【要素9: central_bank_watch (4本)】
中央銀行ウォッチ。**Fed / ECB / BOJ の3行は必ず含める**。加えて、その日のニュース文脈に最も関連する
**もう1行を BOE / BOC / SNB / RBA / RBNZ から選ぶ** (合計4行)。

各カードの構成:
  - code            : 銀行コード ("FED" | "ECB" | "BOJ" | "BOE" | "BOC" | "SNB" | "RBA" | "RBNZ")
  - last_decision   : 直近の政策決定の要約 (40〜70字)
                      例: "12月FOMCで25bp利下げ、来年3月会合まで様子見の姿勢を示した"
  - next_meeting    : 次回会合予定 (10〜30字、不明なら「未定」)
                      例: "1月28-29日 FOMC"
  - official_quotes : 直近の要人発言 (40〜80字、誰の発言かと内容)
                      例: "パウエル議長 12/18『データ次第でペース調整』、ハト派寄りの示唆"
  - market_view     : 市場の見方/織り込み (40〜80字、次回利上げ/利下げ確率や織り込み度)
                      例: "次回会合では据え置き予想が80%超、年内累計75bp利下げを織り込む"

選定基準:
- 上記4要素は具体的な数値や日付を含めること
- 推測や将来予想を断定的に書かず、「市場は…とみる」「議事録によれば…」など出典を匂わせる
- 政治的バイアスを排する
- 参考データの政策金利値を本文中で言及してOK (例: "ECB預金金利は4.00%で据え置き")

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
  }},
  "economic_chart_of_the_day": {{
    "series_id": "ICSA",
    "title": "...",
    "subtitle": "...",
    "rationale": "...",
    "period_years": 3
  }},
  "valuation_view": {{
    "stance": "やや割高",
    "body": "..."
  }},
  "central_bank_watch": [
    {{
      "code": "FED",
      "last_decision": "...",
      "next_meeting": "...",
      "official_quotes": "...",
      "market_view": "..."
    }},
    {{
      "code": "ECB",
      "last_decision": "...",
      "next_meeting": "...",
      "official_quotes": "...",
      "market_view": "..."
    }},
    {{
      "code": "BOJ",
      "last_decision": "...",
      "next_meeting": "...",
      "official_quotes": "...",
      "market_view": "..."
    }},
    {{
      "code": "BOE",
      "last_decision": "...",
      "next_meeting": "...",
      "official_quotes": "...",
      "market_view": "..."
    }}
  ]
}}

source の値:
- "universe" : 候補リストの key を指定 (例: "sp500", "wti", "t10y2y")
- "yf"       : yfinance で取れる ticker を直接指定 (例: "7203.T", "NVDA", "^STOXX50E")
- "fred"     : FRED シリーズ ID を直接指定 (例: "DGS2", "MORTGAGE30US")
"""


def load_cb_facts() -> str:
    """central_banks.json があれば、Claudeに渡す簡易ファクトテキストを生成。"""
    if not CB_PATH.exists():
        return ""
    try:
        cb_data = json.loads(CB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return ""

    lines = []
    for cb in cb_data.get("central_banks", []):
        code = cb.get("code", "")
        name = cb.get("name", "")
        rate_value = cb.get("rate_value")
        rate_name  = cb.get("rate_name", "")
        rate_asof  = cb.get("rate_asof", "")
        last_change_amount = cb.get("last_change_amount")
        last_change_date   = cb.get("last_change_date")
        next_hint = cb.get("next_meeting_hint", "")

        rate_str = f"{rate_value}%" if rate_value is not None else "未取得"
        change_str = ""
        if last_change_amount is not None and last_change_date:
            sign = "+" if last_change_amount > 0 else ""
            change_str = f", 直近の変動: {sign}{last_change_amount}% ({last_change_date})"

        lines.append(f"- {code} ({name}): {rate_name}={rate_str} (asOf {rate_asof}){change_str}. {next_hint}")

    return "\n".join(lines)


def summarize_with_claude(items: list[dict[str, str]]) -> dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = Anthropic(api_key=api_key)

    cb_facts = load_cb_facts()

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
        system=build_system_prompt(cb_facts),
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
