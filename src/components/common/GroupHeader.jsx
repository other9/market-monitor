// =====================================================
// GroupHeader — グループ見出し (v13.4.1 で抽出)
// =====================================================
//
// MacroBarometer / Valuations / FundingVol / SectorHeatmap / MarketTable の
// 5 セクションで使われていた以下のパターンを集約:
//
//   <div className="mm-group-head">
//     <div className="mm-group-title">{title}</div>
//     <div className="mm-group-marker">{marker}</div>
//   </div>
//
// 使い方:
//   <GroupHeader title="株式" marker="▽ Section" />
//   <GroupHeader title="金利・期待" marker={`▽ ${rows.length} indicators`} />
//
// style プロップは marginTop オーバーライド (FundingVol で使用) に対応。
//

export function GroupHeader({ title, marker, style }) {
  return (
    <div className="mm-group-head" style={style}>
      <div className="mm-group-title">{title}</div>
      <div className="mm-group-marker">{marker}</div>
    </div>
  );
}
