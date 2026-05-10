// =====================================================
// Signed — 符号付き数値 (bp 差分など) を色付きで表示する mini-component
// =====================================================
//
// v13.1 で MarketMonitor.jsx から切り出し。
// d は小数桁 (デフォルト 3 桁、bp 表示なら 0 や 1 にすることが多い)。
//

import { fmtSigned, tone } from "@/utils";
import { FONT_MONO } from "@/theme";

export function Signed({ n, d = 3 }) {
  const c = tone(n);
  return (
    <span style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 12.5, color: c }}>
      {fmtSigned(n, d)}
    </span>
  );
}
