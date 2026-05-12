// =====================================================
// SectionHeader — セクション見出し (v13.4.1 で抽出)
// =====================================================
//
// 10 セクションで使われていた `<div className="mm-section-tag">N. Title</div>`
// パターンを集約。同じスタイル + 後で anchor link / icon 追加するときに
// 1 箇所変更で済むようにする。
//
// 使い方:
//   <SectionHeader>1. 本日の注目チャート</SectionHeader>
//   <SectionHeader marker="▨">Market Muse</SectionHeader>
//
// 既存 CSS (.mm-section-tag) をそのまま利用するため、見た目は不変。
//

export function SectionHeader({ children, marker }) {
  // marker が与えられた場合は children の先頭に挿入する (例: "▨ Market Muse")。
  // 番号付きセクション (例: "1. 本日の注目チャート") は marker 不要で children だけで完結。
  return (
    <div className="mm-section-tag">
      {marker ? `${marker} ${children}` : children}
    </div>
  );
}
