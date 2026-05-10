// =====================================================
// StaleDataWarning — Actions 失敗時に最上部に出す警告バー
// =====================================================
//
// v12 で導入、v13.1 で MarketMonitor.jsx から切り出し。
// market.json と news.json の generatedAt のうち古い方を基準に、
// 36時間以上経過していれば赤いバーを表示する。
//
// 36時間の根拠: 24時間 cron + cron 遅延の余裕 + 1日のスキップ許容。
//

import { fmtDate } from "@/utils";

export function StaleDataWarning({ market, news }) {
  // generatedAt は ISO で入っている。最も古い (= 一番遅れている) ものを基準にする。
  const stamps = [market?.generatedAt, news?.generatedAt].filter(Boolean);
  if (stamps.length === 0) return null;

  const oldest = stamps
    .map((s) => new Date(s).getTime())
    .filter((t) => !isNaN(t))
    .reduce((a, b) => Math.min(a, b), Infinity);
  if (!isFinite(oldest)) return null;

  const ageH = (Date.now() - oldest) / (1000 * 3600);
  if (ageH < 36) return null; // 健全

  const days = Math.floor(ageH / 24);
  const hours = Math.floor(ageH - days * 24);
  const ageStr = days > 0 ? `${days}日 ${hours}時間` : `${Math.floor(ageH)}時間`;

  return (
    <div className="mm-stale-warning">
      <div className="mm-stale-warning-head">
        <span className="mm-stale-warning-icon">⚠</span>
        <span className="mm-stale-warning-title">DATA STALE</span>
      </div>
      <div className="mm-stale-warning-body">
        最終更新から <strong>{ageStr}</strong> 経過しています ({fmtDate(new Date(oldest).toISOString())})。
        GitHub Actions の日次更新が失敗している可能性があります。
      </div>
    </div>
  );
}
