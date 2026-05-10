import React, { useEffect, useState } from "react";
import "./MarketMonitor.css";

import { CHART_UNIVERSE_LABELS } from "@/theme";
import { safe } from "@/utils";
import { StaleDataWarning } from "@/components/common";
import {
  MastheadSection,
  FeaturedChartsSection,
  MarketTableSection,
  SectorHeatmapSection,
  MacroBarometerSection,
  FundingVolSection,
  ValuationsSection,
  CentralBanksSection,
  IndicatorChartsSection,
  NewsSection,
  ListedAltsSection,
  DeepDiveSection,
  EconomicChartSection,
  AlternativesSpotlightSection,
  MarketMuseSection,
  FooterSection,
} from "@/components/sections";

// =====================================================
// MARKET MONITOR — v13.1.3
//   • v12: Section numbering, Stale Data warning, Funding & Volatility, Listed Alts
//   • v13.1.0–.1: theme/utils/common を別ファイル化 + import 付け替え
//   • v13.1.2: 独立性の高い 6 セクションを @/components/sections/ に切り出し
//   • v13.1.3: 残り 10 セクションを @/components/sections/ に切り出し
//             (このファイルは 16 セクションを結線するオーケストレータに収束)
// =====================================================

// ─────────────────────────────────────────
// URL constants
// ─────────────────────────────────────────
const BASE = import.meta.env.BASE_URL || "/";
const MARKET_URL     = `${BASE}data/market.json`;
const NEWS_URL       = `${BASE}data/news.json`;
const MACRO_URL      = `${BASE}data/macro.json`;
const FEATURED_URL   = `${BASE}data/featured.json`;
const ECONOMIC_URL   = `${BASE}data/economic.json`;
const VALUATIONS_URL = `${BASE}data/valuations.json`;
const CB_URL         = `${BASE}data/central_banks.json`;
const ALTS_URL       = `${BASE}data/listed_alts.json`;

// =====================================================
// MAIN
// =====================================================
export default function MarketMonitor() {
  const [market,       setMarket]       = useState(null);
  const [news,         setNews]         = useState(null);
  const [macro,        setMacro]        = useState(null);
  const [featured,     setFeatured]     = useState(null);
  const [economic,     setEconomic]     = useState(null);
  const [valuations,   setValuations]   = useState(null);
  const [centralBanks, setCentralBanks] = useState(null);
  const [listedAlts,   setListedAlts]   = useState(null);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(MARKET_URL).then((r) => { if (!r.ok) throw new Error(`market.json: ${r.status}`); return r.json(); }),
      fetch(NEWS_URL).then((r) => { if (!r.ok) throw new Error(`news.json: ${r.status}`); return r.json(); }),
      safe(fetch(MACRO_URL).then((r) => { if (!r.ok) throw new Error(`macro.json: ${r.status}`); return r.json(); })),
      safe(fetch(FEATURED_URL).then((r) => { if (!r.ok) throw new Error(`featured.json: ${r.status}`); return r.json(); })),
      safe(fetch(ECONOMIC_URL).then((r) => { if (!r.ok) throw new Error(`economic.json: ${r.status}`); return r.json(); })),
      safe(fetch(VALUATIONS_URL).then((r) => { if (!r.ok) throw new Error(`valuations.json: ${r.status}`); return r.json(); })),
      safe(fetch(CB_URL).then((r) => { if (!r.ok) throw new Error(`central_banks.json: ${r.status}`); return r.json(); })),
      safe(fetch(ALTS_URL).then((r) => { if (!r.ok) throw new Error(`listed_alts.json: ${r.status}`); return r.json(); })),
    ])
      .then(([m, n, ma, f, e, v, cb, la]) => {
        setMarket(m); setNews(n); setMacro(ma); setFeatured(f);
        setEconomic(e); setValuations(v); setCentralBanks(cb); setListedAlts(la);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="mm-root"><div className="mm-error">データ読み込みエラー: {error}</div></div>;
  if (!market || !news) return <div className="mm-root"><div className="mm-loading">Loading market data…</div></div>;

  const cadence = news.cadence || { mode: "daily" };
  const factsByCode = Object.fromEntries(
    (centralBanks?.central_banks || []).map((c) => [c.code, c])
  );

  return (
    <div className="mm-root">
      <StaleDataWarning market={market} news={news} />

      <MastheadSection news={news} market={market} />

      <FeaturedChartsSection featured={featured} />

      <MarketTableSection market={market} news={news} />
      <SectorHeatmapSection sectors={market.sectors} />

      <MacroBarometerSection macro={macro} />

      <FundingVolSection market={market} macro={macro} />

      <ValuationsSection valuations={valuations} />

      <CentralBanksSection
        watch={news.central_bank_watch || []}
        factsByCode={factsByCode}
      />

      <IndicatorChartsSection market={market} />

      <NewsSection news={news} />

      <ListedAltsSection alts={listedAlts} />

      <DeepDiveSection
        article={news.deep_dive}
        chartUniverse={CHART_UNIVERSE_LABELS}
        cadence={cadence}
      />

      <EconomicChartSection econ={economic} />

      <AlternativesSpotlightSection
        pePd={news.pe_pd_view}
        realAssets={news.real_assets_view}
      />

      <MarketMuseSection news={news} />

      <FooterSection />
    </div>
  );
}
