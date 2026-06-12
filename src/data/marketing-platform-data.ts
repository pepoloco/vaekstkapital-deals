// Platform attribution data — HubSpot Ads Campaign Manager exports
// Source A: 1 Jan 2025 – 10 Jun 2026 (all-time)  |  Attribution: Last ad interaction
// Source B: 1 Apr 2026 –  9 Jun 2026 (Q2 reference used to isolate year splits)
//
// Year split methodology:
//   2025 = campaigns whose names/start-dates place them in 2025 (all Paused by end of 2025)
//   2026 = campaigns whose names/start-dates place them in 2026 (Jan–Jun full-year amounts)
//   AT "BU AT - S: Download" spans years → 2025 ≈ all-time − Q2-2026; 2026 ≈ Q2-2026 portion
//
// SE dealValueClosed: 2025 stored in SEK (from campaign); 2026 converted from DKK (≈1.4993 SEK/DKK)
// AT dealValueClosed: 2025 revenue was 1 000 000 DKK → converted to EUR at ≈7.463 DKK/EUR

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
  totalSpend: number
  contacts: number       // HubSpot "Leads" column = new contacts created
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
      // Meta: DK + SE + AT + FI + NO — spend converted to DKK
      { platform: 'Meta',     totalSpend: 390538.79, leads: 1050, gradeD: 307, deals: 25, dealValueClosed: 21342126.32   },
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
    // Spend ≈ all-time minus Q2-2026 portion ("BU AT - S: Download" active since 2025)
    // Revenue: 1 000 000 DKK → 134 007 EUR at 7.463 DKK/EUR
    rows: [
      { platform: 'Meta', totalSpend: 10599.42, leads: 292, gradeD: 89, deals: 1, dealValueClosed: 134007.00 },
    ],
    campaigns: [
      { campaignName: 'BU AT - S: Download', platform: 'Meta', totalSpend: 10599.42, contacts: 292, gradeD: 89, deals: 1, dealValueClosed: 134007.00 },
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
      // Meta: DK + SE + AT — spend converted to DKK
      { platform: 'Meta',     totalSpend:  338796.79, leads: 190, gradeD: 249, deals: 9, dealValueClosed: 9401340.00    },
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
    currency: 'EUR',
    // No AT LinkedIn account in HubSpot Ads Manager
    // All three campaigns ran Apr–Jun 2026 (same amounts in both all-time and Q2 exports)
    rows: [
      { platform: 'Meta', totalSpend: 10003.99, leads: 2, gradeD: 26, deals: 0, dealValueClosed: null },
    ],
    campaigns: [
      { campaignName: 'BU AT - S: Download',          platform: 'Meta', totalSpend:   154.93, contacts: 2, gradeD:  1, deals: 0, dealValueClosed: null },
      { campaignName: 'General about Vaekstkapital',   platform: 'Meta', totalSpend:  5047.68, contacts: 0, gradeD:  0, deals: 0, dealValueClosed: null },
      { campaignName: 'BU AT - S: Direct',             platform: 'Meta', totalSpend:  4801.38, contacts: 0, gradeD: 25, deals: 0, dealValueClosed: null },
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
