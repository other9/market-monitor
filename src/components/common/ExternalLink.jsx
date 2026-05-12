// =====================================================
// ExternalLink — 外部リンク (v13.4.1 で抽出)
// =====================================================
//
// `<a href={url} target="_blank" rel="noopener noreferrer">` の boilerplate を集約。
// rel="noopener noreferrer" は target="_blank" 時のセキュリティ・パフォーマンス必須
// 設定なので、ここで強制する。
//
// 4 箇所 (MarketMuse, DeepDive, News, AlternativesSpotlight) で使い回し。
//
// 使い方:
//   <ExternalLink href={url} className="mm-news-link">{title}</ExternalLink>
//
// className を渡せば既存の hover スタイル等を適用可能 (mm-muse-link 等)。
//

export function ExternalLink({ href, className, children, style, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      title={title}
    >
      {children}
    </a>
  );
}
