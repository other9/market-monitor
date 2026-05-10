// =====================================================
// Pct — 前日比などのパーセント値を色付きで表示する mini-component
// =====================================================
//
// v13.1 で MarketMonitor.jsx から切り出し。
// big=true で Ticker などに使う大きめサイズ。
//

import { fmtPct, tone } from "@/utils";
import { FONT_MONO } from "@/theme";

export function Pct({ n, big }) {
  const c = tone(n);
  return (
    <span style={{
      fontFamily: FONT_MONO,
      fontWeight: 500,
      fontSize: big ? 15 : 12.5,
      color: c,
      whiteSpace: "nowrap",
    }}>
      {fmtPct(n)}
    </span>
  );
}
