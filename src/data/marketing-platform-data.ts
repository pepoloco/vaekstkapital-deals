// Platform attribution data — HubSpot Ads Campaign Manager exports
// Source A: 1 Jan 2025 – 10 Jun 2026 (all-time)  |  Attribution: Last ad interaction
// Source B: 1 Jan 2026 – 12 Jun 2026 (AT-only YTD, downloaded 12 Jun 2026)
//
// Year split methodology:
//   2025 = campaigns confirmed to have run only in 2025 (Paused, 2025 date in name)
//   2026 = campaigns confirmed from the AT YTD export + all-time comparison
//   AT: all three campaigns show identical spend in the 2026-YTD export as in all-time →
//       100 % of AT spend occurred in 2026. AT 2025 = zero.
//
// SE dealValueClosed: 2025 stored in SEK; 2026 converted from DKK (≈1.4993 SEK/DKK)

export interface PlatformRow {
  platform: 'Google' | 'LinkedIn' | 'Meta'
  totalSpend: number
  leads: number
  gradeD: number         // "# Grade D+" — MQL from HubSpot
  deals: number
  dealValueClosed: number | null
}

// Campaign-level row — used for markets that show per-campaign breakdown (AT)
export interface CampaignRow {
  campaignName: string
  platform: 'Google' | 'LinkedIn' | 'Meta'
  status: 'Active' | 'Paused'
  totalSpend: number
  contacts: number       // HubSpot "Total Contacts" column (all contacts associated with campaign)
  gradeD: number
  deals: number
  dealValueClosed: number | null
}

export interface MarketOverview {
  id: string
  market: string
  currency: 'DKK' | 'EUR' | 'SEK' | 'NOK'
  rows: PlatformRow[]
  campaigns?: CampaignRow[]  // if present, renders CampaignBreakdownTable instead of MarketTable
}

// ── 2025 (1 Jan – 31 Dec 2025) ───────────────────────────────────────────────

export const PLATFORM_DATA_2025: MarketOverview[] = [
  {
    id: 'all',
    market: 'All Markets',
    currency: 'DKK',
    rows: [
      // LinkedIn: DK + SE active in 2025; spend converted to DKK
      { platform: 'LinkedIn', totalSpend: 191252.26, leads:   44, gradeD:  25, deals:  1, dealValueClosed:   750000.00   },
      // Meta: DK + SE + FI + NO (AT ran entirely in 2026 — excluded from 2025)
      { platform: 'Meta',     totalSpend: 311467.12, leads: 758, gradeD: 218, deals: 24, dealValueClosed: 20342126.32   },
    ],
  },
  {
    id: 'dk',
    market: 'DK',
    currency: 'DKK',
    rows: [
      { platform: 'LinkedIn', totalSpend: 127435.79, leads:  30, gradeD:  17, deals:  1, dealValueClosed:   750000.00   },
      { platform: 'Meta',     totalSpend: 243165.92, leads: 535, gradeD: 147, deals: 20, dealValueClosed: 17457778.20   },
    ],
  },
  {
    id: 'se',
    market: 'SE',
    currency: 'SEK',
    rows: [
      { platform: 'LinkedIn', totalSpend:  95676.85, leads:  14, gradeD:   8, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:  99216.55, leads: 222, gradeD:  71, deals: 4, dealValueClosed: 4324360.00     },
    ],
  },
  {
    id: 'at',
    market: 'AT',
    currency: 'EUR',
    // No AT LinkedIn account in HubSpot Ads Manager
    // AT YTD export (Jan 1 – Jun 12 2026) shows same amounts as all-time → all spend was in 2026
    rows: [
      { platform: 'Meta', totalSpend: 0, leads: 0, gradeD: 0, deals: 0, dealValueClosed: null },
    ],
  },
  {
    id: 'fi',
    market: 'FI',
    currency: 'EUR',
    rows: [
      { platform: 'LinkedIn', totalSpend:      0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:      3.18, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null           },
    ],
  },
  {
    id: 'no',
    market: 'NO',
    currency: 'NOK',
    rows: [
      { platform: 'LinkedIn', totalSpend:      0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null           },
      { platform: 'Meta',     totalSpend:    333.34, leads:   1, gradeD:   0, deals: 0, dealValueClosed: null           },
    ],
  },
]

// ── 2026 (1 Jan – 10 Jun 2026) ───────────────────────────────────────────────

export const PLATFORM_DATA_2026: MarketOverview[] = [
  {
    id: 'all',
    market: 'All Markets',
    currency: 'DKK',
    rows: [
      // LinkedIn: zero spend across all markets in 2026
      { platform: 'LinkedIn', totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      // Meta: DK + SE + AT — spend converted to DKK; AT full YTD (156 375 DKK)
      { platform: 'Meta',     totalSpend:  420542.20, leads: 479, gradeD: 333, deals: 9, dealValueClosed: 9401340.00    },
    ],
  },
  {
    id: 'dk',
    market: 'DK',
    currency: 'DKK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      // Full Jan–Jun 2026 (includes campaigns starting Feb/Mar 2026)
      { platform: 'Meta',     totalSpend:  157653.82, leads:  55, gradeD:  67, deals: 4, dealValueClosed: 3530880.00    },
    ],
  },
  {
    id: 'se',
    market: 'SE',
    currency: 'SEK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      // Full Jan–Jun 2026; dealValueClosed = 5 870 460 DKK × 1.4993 SEK/DKK
      { platform: 'Meta',     totalSpend:  159689.96, leads: 133, gradeD: 156, deals: 5, dealValueClosed: 8801522.00    },
    ],
  },
  {
    id: 'at',
    market: 'AT',
    currency: 'DKK',
    // No AT LinkedIn account in HubSpot Ads Manager
    // Source: AT YTD export Jan 1 – Jun 12, 2026; spend converted EUR→DKK at 7.46 (HubSpot rate)
    // to match HubSpot's "Cost per Contact" column which reports in account currency (DKK)
    rows: [
      { platform: 'Meta', totalSpend: 156375.17, leads: 291, gradeD: 110, deals: 0, dealValueClosed: null },
    ],
    campaigns: [
      // contacts = HubSpot "Total Contacts" column from AT YTD export (Jun 12 2026)
      // totalSpend in DKK = EUR × 7.46 (HubSpot's conversion rate)
      { campaignName: 'BU AT - S: Download',         platform: 'Meta', status: 'Paused', totalSpend:  80227.45, contacts: 632, gradeD:  85, deals: 0, dealValueClosed: null },
      { campaignName: 'General about Vaekstkapital',  platform: 'Meta', status: 'Active', totalSpend:  40329.43, contacts:  73, gradeD:   0, deals: 0, dealValueClosed: null },
      { campaignName: 'BU AT - S: Direct',            platform: 'Meta', status: 'Paused', totalSpend:  35818.29, contacts:  69, gradeD:  25, deals: 0, dealValueClosed: null },
    ],
  },
  {
    id: 'fi',
    market: 'FI',
    currency: 'EUR',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
    ],
  },
  {
    id: 'no',
    market: 'NO',
    currency: 'NOK',
    rows: [
      { platform: 'LinkedIn', totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
      { platform: 'Meta',     totalSpend:       0.00, leads:   0, gradeD:   0, deals: 0, dealValueClosed: null          },
    ],
  },
]

// Legacy alias
export const PLATFORM_DATA = PLATFORM_DATA_2026
